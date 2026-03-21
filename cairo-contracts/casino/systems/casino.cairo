use starknet::ContractAddress;

#[starknet::interface]
pub trait ICasino<T> {
    fn initialize(
        ref self: T,
        owner: ContractAddress,
        token_address: ContractAddress,
        fee_token: ContractAddress,
        coin_toss: ContractAddress,
        event_relayer: ContractAddress,
        context_address: Option<ContractAddress>,
    );
    fn place_bet(ref self: T, choice: u8, player_name: Option<felt252>) -> u64;
    fn settle(ref self: T, token_id: u64);
    fn deposit(ref self: T, amount: u256);
    fn withdraw(ref self: T, amount: u256);
    fn house_balance(self: @T) -> u256;
    fn bet_amount(self: @T, token_id: u64) -> u256;
    fn coin_toss_address(self: @T) -> ContractAddress;
    fn event_relayer_address(self: @T) -> ContractAddress;
}

#[dojo::contract]
pub mod casino {
    use super::ICasino;
    use crate::systems::event_relayer::{IEventRelayerDispatcher, IEventRelayerDispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess,
    };

    use game_components_metagame::metagame::MetagameComponent;
    use game_components_minigame::interface::{
        IMinigameTokenDataDispatcher, IMinigameTokenDataDispatcherTrait,
    };
    use openzeppelin_interfaces::erc20::{IERC20Dispatcher, IERC20DispatcherTrait};
    use openzeppelin_introspection::src5::SRC5Component;

    const DEFAULT_BET: u256 = 1_000_000_000_000_000; // 0.001 STRK (1e15 wei)

    // Components
    component!(path: MetagameComponent, storage: metagame, event: MetagameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl MetagameImpl = MetagameComponent::MetagameImpl<ContractState>;
    impl MetagameInternalImpl = MetagameComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        metagame: MetagameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        initialized: bool,
        owner: ContractAddress,
        fee_token: ContractAddress,
        coin_toss: ContractAddress,
        event_relayer: ContractAddress,
        house_balance: u256,
        bets: Map<u64, u256>,           // token_id -> bet amount
        bet_player: Map<u64, ContractAddress>, // token_id -> player
        settled: Map<u64, bool>,         // token_id -> already settled
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MetagameEvent: MetagameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    #[abi(embed_v0)]
    impl CasinoImpl of ICasino<ContractState> {
        fn initialize(
            ref self: ContractState,
            owner: ContractAddress,
            token_address: ContractAddress,
            fee_token: ContractAddress,
            coin_toss: ContractAddress,
            event_relayer: ContractAddress,
            context_address: Option<ContractAddress>,
        ) {
            assert!(!self.initialized.read(), "Already initialized");
            self.initialized.write(true);
            self.metagame.initializer(context_address, token_address);
            self.owner.write(owner);
            self.fee_token.write(fee_token);
            self.coin_toss.write(coin_toss);
            self.event_relayer.write(event_relayer);
        }
        /// Player places a bet and receives a game token.
        /// Requires prior ERC20 approval of DEFAULT_BET to this contract.
        fn place_bet(ref self: ContractState, choice: u8, player_name: Option<felt252>) -> u64 {
            assert!(choice == 0 || choice == 1, "Choice must be 0 (heads) or 1 (tails)");

            let caller = get_caller_address();
            let this = get_contract_address();

            // Transfer bet from player to casino
            let fee_token = IERC20Dispatcher { contract_address: self.fee_token.read() };
            let transferred = fee_token.transfer_from(caller, this, DEFAULT_BET);
            assert!(transferred, "Bet transfer failed");

            // Add to house balance
            self.house_balance.write(self.house_balance.read() + DEFAULT_BET);

            // Mint game token via MetagameComponent
            let token_id = self
                .metagame
                .mint(
                    Option::Some(self.coin_toss.read()), // game_address
                    player_name,
                    Option::None,
                    Option::None,
                    Option::None,
                    Option::None,
                    Option::None,
                    Option::None,
                    Option::None,
                    caller,
                    false,
                );

            // Record bet
            self.bets.write(token_id, DEFAULT_BET);
            self.bet_player.write(token_id, caller);

            let event_relayer = self.event_relayer.read();
            if event_relayer.into() != 0 {
                let relayer = IEventRelayerDispatcher { contract_address: event_relayer };
                relayer.emit_bet_placed(caller, self.coin_toss.read(), token_id);
            }

            token_id
        }

        /// Settle a completed game. Pays out winner from house balance.
        /// Anyone can call this — it checks game_over from the coin_toss contract.
        fn settle(ref self: ContractState, token_id: u64) {
            assert!(!self.settled.read(token_id), "Already settled");

            let bet = self.bets.read(token_id);
            assert!(bet > 0, "No bet found");

            // Read game state from coin_toss
            let game_data = IMinigameTokenDataDispatcher {
                contract_address: self.coin_toss.read(),
            };
            assert!(game_data.game_over(token_id), "Game not over yet");

            self.settled.write(token_id, true);

            let score = game_data.score(token_id);
            if score > 0 {
                // Winner: payout = bet * score (2x for coin toss)
                let payout: u256 = bet * score.into();
                let current_house = self.house_balance.read();
                assert!(current_house >= payout, "House cannot cover payout");

                self.house_balance.write(current_house - payout);

                let player = self.bet_player.read(token_id);
                let fee_token = IERC20Dispatcher { contract_address: self.fee_token.read() };
                let transferred = fee_token.transfer(player, payout);
                assert!(transferred, "Payout transfer failed");
            }
            // If score == 0, house keeps the bet (already added to house_balance)

            let event_relayer = self.event_relayer.read();
            if event_relayer.into() != 0 {
                let relayer = IEventRelayerDispatcher { contract_address: event_relayer };
                relayer.emit_bet_settled(self.bet_player.read(token_id), token_id, score > 0, score);
            }
        }

        /// Owner deposits ETH to fund the house bankroll.
        fn deposit(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Only owner");

            let fee_token = IERC20Dispatcher { contract_address: self.fee_token.read() };
            let transferred = fee_token.transfer_from(caller, get_contract_address(), amount);
            assert!(transferred, "Deposit transfer failed");

            self.house_balance.write(self.house_balance.read() + amount);
        }

        /// Owner withdraws ETH from house bankroll.
        fn withdraw(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            assert!(caller == self.owner.read(), "Only owner");

            let current = self.house_balance.read();
            assert!(current >= amount, "Insufficient house balance");

            self.house_balance.write(current - amount);

            let fee_token = IERC20Dispatcher { contract_address: self.fee_token.read() };
            let transferred = fee_token.transfer(caller, amount);
            assert!(transferred, "Withdraw transfer failed");
        }

        fn house_balance(self: @ContractState) -> u256 {
            self.house_balance.read()
        }

        fn bet_amount(self: @ContractState, token_id: u64) -> u256 {
            self.bets.read(token_id)
        }

        fn coin_toss_address(self: @ContractState) -> ContractAddress {
            self.coin_toss.read()
        }

        fn event_relayer_address(self: @ContractState) -> ContractAddress {
            self.event_relayer.read()
        }
    }
}
