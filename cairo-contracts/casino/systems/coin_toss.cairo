use starknet::ContractAddress;

#[starknet::interface]
pub trait ICoinToss<T> {
    fn initialize(
        ref self: T,
        creator_address: ContractAddress,
        token_address: ContractAddress,
        vrf_provider_address: ContractAddress,
    );
    fn flip(ref self: T, token_id: u64, choice: u8);
}

#[dojo::contract]
pub mod coin_toss {
    use super::ICoinToss;
    use starknet::{ContractAddress, get_contract_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use dojo::model::ModelStorage;

    use game_components_minigame::minigame::MinigameComponent;
    use game_components_minigame::interface::{IMinigameTokenData, IMinigameDetails};
    use game_components_minigame::structs::GameDetail;
    use openzeppelin_introspection::src5::SRC5Component;

    use cairo_casino::models::CoinTossGame;
    use cairo_casino::vrf::{IVrfProviderDispatcher, IVrfProviderDispatcherTrait, Source};

    // Components
    component!(path: MinigameComponent, storage: minigame, event: MinigameEvent);
    component!(path: SRC5Component, storage: src5, event: SRC5Event);

    #[abi(embed_v0)]
    impl MinigameImpl = MinigameComponent::MinigameImpl<ContractState>;
    impl MinigameInternalImpl = MinigameComponent::InternalImpl<ContractState>;

    #[abi(embed_v0)]
    impl SRC5Impl = SRC5Component::SRC5Impl<ContractState>;

    #[storage]
    struct Storage {
        #[substorage(v0)]
        minigame: MinigameComponent::Storage,
        #[substorage(v0)]
        src5: SRC5Component::Storage,
        initialized: bool,
        vrf_provider: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        #[flat]
        MinigameEvent: MinigameComponent::Event,
        #[flat]
        SRC5Event: SRC5Component::Event,
    }

    // IMinigameTokenData — reads game state from Dojo models
    #[abi(embed_v0)]
    impl TokenDataImpl of IMinigameTokenData<ContractState> {
        fn score(self: @ContractState, token_id: u64) -> u32 {
            let world = self.world_default();
            let game: CoinTossGame = world.read_model(token_id);
            game.score
        }

        fn game_over(self: @ContractState, token_id: u64) -> bool {
            let world = self.world_default();
            let game: CoinTossGame = world.read_model(token_id);
            game.over
        }
    }

    // IMinigameDetails — NFT metadata for the game token
    #[abi(embed_v0)]
    impl DetailsImpl of IMinigameDetails<ContractState> {
        fn token_name(self: @ContractState, token_id: u64) -> ByteArray {
            "Coin Toss"
        }

        fn token_description(self: @ContractState, token_id: u64) -> ByteArray {
            let world = self.world_default();
            let game: CoinTossGame = world.read_model(token_id);
            if !game.over {
                return "Coin Toss - Awaiting flip";
            }
            if game.won {
                "Coin Toss - Winner! 2x payout"
            } else {
                "Coin Toss - Better luck next time"
            }
        }

        fn game_details(self: @ContractState, token_id: u64) -> Span<GameDetail> {
            let world = self.world_default();
            let game: CoinTossGame = world.read_model(token_id);

            let choice_str: ByteArray = if game.choice == 0 {
                "Heads"
            } else {
                "Tails"
            };
            let result_str: ByteArray = if !game.over {
                "Pending"
            } else if game.result == 0 {
                "Heads"
            } else {
                "Tails"
            };
            let outcome_str: ByteArray = if !game.over {
                "In Progress"
            } else if game.won {
                "Won"
            } else {
                "Lost"
            };

            array![
                GameDetail { name: "Choice", value: choice_str },
                GameDetail { name: "Result", value: result_str },
                GameDetail { name: "Outcome", value: outcome_str },
            ]
                .span()
        }
    }

    #[abi(embed_v0)]
    impl CoinTossImpl of ICoinToss<ContractState> {
        fn initialize(
            ref self: ContractState,
            creator_address: ContractAddress,
            token_address: ContractAddress,
            vrf_provider_address: ContractAddress,
        ) {
            assert!(!self.initialized.read(), "Already initialized");
            self.initialized.write(true);
            self.vrf_provider.write(vrf_provider_address);

            self
                .minigame
                .initializer(
                    creator_address,
                    "Coin Toss",
                    "Flip a coin, double or nothing",
                    "Cairo Casino",
                    "Cairo Casino",
                    "Casino",
                    "",
                    Option::None,     // color
                    Option::None,     // client_url
                    Option::None,     // renderer_address
                    Option::None,     // settings_address
                    Option::None,     // objectives_address
                    token_address,
                );
        }

        fn flip(ref self: ContractState, token_id: u64, choice: u8) {
            assert!(choice == 0 || choice == 1, "Choice must be 0 (heads) or 1 (tails)");

            // EGS: verify caller owns this token
            self.minigame.assert_token_ownership(token_id);

            // EGS pre-action: validates token is playable
            self.minigame.pre_action(token_id);

            // Cartridge VRF: consume verifiable randomness
            let vrf = IVrfProviderDispatcher {
                contract_address: self.vrf_provider.read(),
            };
            let random = vrf.consume_random(Source::Nonce(get_contract_address()));
            let random_u256: u256 = random.into();
            let result: u8 = (random_u256 % 2).try_into().unwrap();

            let won = choice == result;
            let score = if won { 2_u32 } else { 0_u32 };

            // Write game result to Dojo model
            let mut world = self.world_default();
            world
                .write_model(
                    @CoinTossGame { token_id, choice, result, won, over: true, score },
                );

            // EGS post-action: syncs score to token, triggers metagame callback
            self.minigame.post_action(token_id);
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"cairo_casino")
        }
    }
}
