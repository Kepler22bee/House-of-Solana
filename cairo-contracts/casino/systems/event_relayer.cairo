use starknet::ContractAddress;

#[starknet::interface]
pub trait IEventRelayer<T> {
    fn emit_bet_placed(
        ref self: T,
        player: ContractAddress,
        game: ContractAddress,
        token_id: u64,
    );
    fn emit_bet_settled(
        ref self: T,
        player: ContractAddress,
        token_id: u64,
        won: bool,
        score: u32,
    );
}

#[dojo::contract]
pub mod event_relayer {
    use super::IEventRelayer;
    use starknet::ContractAddress;
    use dojo::event::EventStorage;

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct BetPlaced {
        #[key]
        pub player: ContractAddress,
        pub game: ContractAddress,
        pub token_id: u64,
    }

    #[derive(Copy, Drop, Serde)]
    #[dojo::event]
    pub struct BetSettled {
        #[key]
        pub player: ContractAddress,
        pub token_id: u64,
        pub won: bool,
        pub score: u32,
    }

    #[abi(embed_v0)]
    impl EventRelayerImpl of IEventRelayer<ContractState> {
        fn emit_bet_placed(
            ref self: ContractState,
            player: ContractAddress,
            game: ContractAddress,
            token_id: u64,
        ) {
            let mut world = self.world_default();
            world.emit_event(@BetPlaced { player, game, token_id });
        }

        fn emit_bet_settled(
            ref self: ContractState,
            player: ContractAddress,
            token_id: u64,
            won: bool,
            score: u32,
        ) {
            let mut world = self.world_default();
            world.emit_event(@BetSettled { player, token_id, won, score });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"cairo_casino")
        }
    }
}
