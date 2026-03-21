// -- Dojo Tests --
// Uses snforge with a test world. Key patterns: spawn_test_world for setup,
// start_cheat_* for deterministic control, write_model_test for state injection.
#[cfg(test)]
mod tests {
    use dojo::model::{ModelStorage, ModelStorageTest};
    use dojo::world::WorldStorageTrait;
    use dojo_snf_test::{
        spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef,
        WorldStorageTestTrait,
    };
    use snforge_std::{start_cheat_block_timestamp_global, start_cheat_caller_address};
    use starknet::ContractAddress;

    use starter::systems::actions::{IActionsDispatcher, IActionsDispatcherTrait};
    use starter::systems::actions::{has_content, dig_outcome, Tile};
    use starter::models::{Player, Direction};

    const PLAYER: felt252 = 'PLAYER';

    // Declares which models, events, and contracts exist in the test world — must match the contract.
    fn namespace_def() -> NamespaceDef {
        NamespaceDef {
            namespace: "starter",
            resources: [
                TestResource::Model("Player"),
                TestResource::Event("Moved"),
                TestResource::Event("Dug"),
                TestResource::Event("LevelUp"),
                TestResource::Event("GameOver"),
                TestResource::Contract("actions"),
            ]
                .span(),
        }
    }

    // Grants write permission on the "starter" namespace, mirroring dojo_dev.toml's [writers].
    fn contract_defs() -> Span<ContractDef> {
        [
            ContractDefTrait::new(@"starter", @"actions")
                .with_writer_of([dojo::utils::bytearray_hash(@"starter")].span()),
        ]
            .span()
    }

    fn caller() -> ContractAddress {
        PLAYER.try_into().unwrap()
    }

    fn make_player(player: ContractAddress, x: u8, y: u8, health: u8, gold: u32) -> @Player {
        @Player { player, x, y, health, gold, level: 1, dug: 0, best: 0 }
    }

    // Standard Dojo test setup: create world, sync permissions, resolve contract via DNS, set caller.
    fn setup() -> (dojo::world::WorldStorage, IActionsDispatcher) {
        let ndef = namespace_def();
        let mut world = spawn_test_world([ndef].span());
        world.sync_perms_and_inits(contract_defs());
        let (contract_address, _) = world.dns(@"actions").unwrap();
        let actions = IActionsDispatcher { contract_address };
        start_cheat_caller_address(contract_address, caller());
        (world, actions)
    }

    fn setup_spawned() -> (dojo::world::WorldStorage, IActionsDispatcher) {
        let (world, actions) = setup();
        actions.spawn();
        (world, actions)
    }

    // Find a tile with or without content for the given player/level.
    fn find_tile(player: ContractAddress, level: u32, want_content: bool) -> (u8, u8) {
        let mut tx: u8 = 0;
        while tx < 10 {
            let mut ty: u8 = 0;
            while ty < 10 {
                if has_content(player, level, tx, ty) == want_content {
                    return (tx, ty);
                }
                ty += 1;
            };
            tx += 1;
        };
        panic!("no matching tile found")
    }

    // Brute-forces a timestamp that produces the desired dig outcome, letting us test both paths.
    fn find_timestamp_for(
        player: ContractAddress, x: u8, y: u8, outcome: Tile, level: u32,
    ) -> u64 {
        let mut t: u64 = 0;
        while t < 1000 {
            if dig_outcome(player, x, y, t, level) == outcome {
                return t;
            }
            t += 1;
        };
        panic!("no timestamp found for outcome")
    }

    #[test]
    fn test_spawn() {
        let (world, actions) = setup();
        actions.spawn();
        let p: Player = world.read_model(caller());
        assert!(p.x == 0 && p.y == 0, "should start at origin");
        assert!(p.health == 100, "should have 100 health");
        assert!(p.gold == 0, "should have 0 gold");
        assert!(p.level == 1, "should be level 1");
        assert!(p.dug == 0, "no tiles dug");
    }

    #[test]
    fn test_move_costs_health() {
        let (world, actions) = setup_spawned();
        actions.move(Direction::Right);
        let p: Player = world.read_model(caller());
        assert!(p.x == 1, "x should be 1");
        assert!(p.y == 0, "y should be 0");
        assert!(p.health == 99, "health should be 99");
    }

    #[test]
    fn test_move_clamps_at_boundary() {
        let (world, actions) = setup_spawned();
        actions.move(Direction::Left);
        let p: Player = world.read_model(caller());
        assert!(p.x == 0, "x should stay 0");

        actions.move(Direction::Down);
        let p: Player = world.read_model(caller());
        assert!(p.y == 0, "y should stay 0");
    }

    #[test]
    fn test_move_clamps_at_max() {
        let (mut world, actions) = setup_spawned();
        // write_model_test bypasses permissions — test-only way to inject arbitrary state.
        world
            .write_model_test(
                make_player(caller(), 9, 9, 100, 0),
            );
        actions.move(Direction::Right);
        let p: Player = world.read_model(caller());
        assert!(p.x == 9, "x should stay 9");

        actions.move(Direction::Up);
        let p: Player = world.read_model(caller());
        assert!(p.y == 9, "y should stay 9");
    }

    #[test]
    fn test_move_all_directions() {
        let (mut world, actions) = setup_spawned();
        world
            .write_model_test(
                make_player(caller(), 5, 5, 100, 0),
            );

        actions.move(Direction::Right);
        let p: Player = world.read_model(caller());
        assert!(p.x == 6 && p.y == 5, "right");

        actions.move(Direction::Up);
        let p: Player = world.read_model(caller());
        assert!(p.x == 6 && p.y == 6, "up");

        actions.move(Direction::Left);
        let p: Player = world.read_model(caller());
        assert!(p.x == 5 && p.y == 6, "left");

        actions.move(Direction::Down);
        let p: Player = world.read_model(caller());
        assert!(p.x == 5 && p.y == 5, "down");
    }

    #[test]
    #[should_panic(expected: "game over")]
    fn test_move_when_dead_panics() {
        let (mut world, actions) = setup_spawned();
        world
            .write_model_test(
                make_player(caller(), 5, 5, 0, 0),
            );
        actions.move(Direction::Right);
    }

    #[test]
    fn test_move_to_zero_health() {
        let (mut world, actions) = setup_spawned();
        world
            .write_model_test(
                make_player(caller(), 0, 0, 1, 0),
            );
        actions.move(Direction::Right);
        let p: Player = world.read_model(caller());
        assert!(p.health == 0, "health should be 0");
    }

    #[test]
    #[should_panic(expected: "nothing here")]
    fn test_dig_empty_tile_panics() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (ex, ey) = find_tile(player, 1, false);
        world
            .write_model_test(
                make_player(player, ex, ey, 100, 0),
            );
        actions.dig();
    }

    #[test]
    #[should_panic(expected: "already dug")]
    fn test_dig_twice_panics() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (cx, cy) = find_tile(player, 1, true);
        let gold_ts = find_timestamp_for(player, cx, cy, Tile::Gold, 1);
        start_cheat_block_timestamp_global(gold_ts);
        world
            .write_model_test(
                make_player(player, cx, cy, 100, 0),
            );
        actions.dig();
        actions.dig(); // should panic
    }

    #[test]
    fn test_dig_gold() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (cx, cy) = find_tile(player, 1, true);
        let gold_ts = find_timestamp_for(player, cx, cy, Tile::Gold, 1);
        start_cheat_block_timestamp_global(gold_ts);
        world
            .write_model_test(
                make_player(player, cx, cy, 100, 0),
            );
        actions.dig();
        let p: Player = world.read_model(player);
        assert!(p.gold == 10, "should gain 10 gold");
        assert!(p.health == 100, "health unchanged");
    }

    #[test]
    fn test_dig_bomb() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (cx, cy) = find_tile(player, 1, true);
        let bomb_ts = find_timestamp_for(player, cx, cy, Tile::Bomb, 1);
        start_cheat_block_timestamp_global(bomb_ts);
        world
            .write_model_test(
                make_player(player, cx, cy, 100, 0),
            );
        actions.dig();
        let p: Player = world.read_model(player);
        assert!(p.gold == 0, "gold unchanged");
        assert!(p.health == 90, "should lose 10 health");
    }

    #[test]
    fn test_level_up() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (cx, cy) = find_tile(player, 1, true);
        let gold_ts = find_timestamp_for(player, cx, cy, Tile::Gold, 1);
        start_cheat_block_timestamp_global(gold_ts);
        world
            .write_model_test(
                make_player(player, cx, cy, 50, 90),
            );
        actions.dig();
        let p: Player = world.read_model(player);
        assert!(p.level == 2, "should be level 2");
        assert!(p.gold == 100, "gold should be preserved");
        assert!(p.health == 100, "health should reset to 100");
        assert!(p.x == 0 && p.y == 0, "position should reset");
        assert!(p.dug == 0, "dug should reset");
    }

    #[test]
    fn test_level_up_gold_accumulates() {
        let (mut world, actions) = setup_spawned();
        let player = caller();
        let (cx, cy) = find_tile(player, 1, true);
        let gold_ts = find_timestamp_for(player, cx, cy, Tile::Gold, 1);
        start_cheat_block_timestamp_global(gold_ts);
        world
            .write_model_test(
                make_player(player, cx, cy, 50, 95),
            );
        actions.dig();
        let p: Player = world.read_model(player);
        assert!(p.level == 2, "should be level 2");
        assert!(p.gold == 105, "gold should accumulate");
    }

    #[test]
    fn test_spawn_resets_after_game_over() {
        let (mut world, actions) = setup_spawned();
        world
            .write_model_test(
                @Player { player: caller(), x: 5, y: 5, health: 0, gold: 50, level: 3, dug: 7, best: 250 },
            );
        actions.spawn();
        let p: Player = world.read_model(caller());
        assert!(p.health == 100 && p.gold == 0 && p.level == 1, "should fully reset");
        assert!(p.best == 250, "best should be preserved");
    }
}
