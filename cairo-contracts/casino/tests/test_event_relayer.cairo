use dojo::world::WorldStorageTrait;
use dojo_snf_test::{
    spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef,
    WorldStorageTestTrait,
};
use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;

use cairo_casino::systems::event_relayer::{IEventRelayerDispatcher, IEventRelayerDispatcherTrait};

const PLAYER: felt252 = 'PLAYER';

fn namespace_def() -> NamespaceDef {
    NamespaceDef {
        namespace: "cairo_casino",
        resources: [
            TestResource::Event("BetPlaced"),
            TestResource::Event("BetSettled"),
            TestResource::Contract("event_relayer"),
        ]
            .span(),
    }
}

fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(@"cairo_casino", @"event_relayer")
            .with_writer_of([dojo::utils::bytearray_hash(@"cairo_casino")].span()),
    ]
        .span()
}

fn caller() -> ContractAddress {
    PLAYER.try_into().unwrap()
}

fn setup() -> (dojo::world::WorldStorage, IEventRelayerDispatcher) {
    let ndef = namespace_def();
    let mut world = spawn_test_world([ndef].span());
    world.sync_perms_and_inits(contract_defs());
    let (contract_address, _) = world.dns(@"event_relayer").unwrap();
    let relayer = IEventRelayerDispatcher { contract_address };
    start_cheat_caller_address(contract_address, caller());
    (world, relayer)
}

// =============================================
// Basic event emission (no panic)
// =============================================

#[test]
fn test_emit_bet_placed() {
    let (_world, relayer) = setup();
    let game_addr: ContractAddress = 'GAME'.try_into().unwrap();
    relayer.emit_bet_placed(caller(), game_addr, 1);
}

#[test]
fn test_emit_bet_settled_won() {
    let (_world, relayer) = setup();
    relayer.emit_bet_settled(caller(), 1, true, 2);
}

#[test]
fn test_emit_bet_settled_lost() {
    let (_world, relayer) = setup();
    relayer.emit_bet_settled(caller(), 1, false, 0);
}

// =============================================
// Multiple events in sequence
// =============================================

#[test]
fn test_emit_multiple_bets() {
    let (_world, relayer) = setup();
    let game_addr: ContractAddress = 'GAME'.try_into().unwrap();
    relayer.emit_bet_placed(caller(), game_addr, 1);
    relayer.emit_bet_placed(caller(), game_addr, 2);
    relayer.emit_bet_placed(caller(), game_addr, 3);
    relayer.emit_bet_settled(caller(), 1, true, 2);
    relayer.emit_bet_settled(caller(), 2, false, 0);
    relayer.emit_bet_settled(caller(), 3, true, 2);
}

// =============================================
// Different callers can emit events
// =============================================

#[test]
fn test_emit_from_different_players() {
    let (_world, relayer) = setup();
    let player2: ContractAddress = 'PLAYER2'.try_into().unwrap();
    let game_addr: ContractAddress = 'GAME'.try_into().unwrap();

    relayer.emit_bet_placed(caller(), game_addr, 1);
    relayer.emit_bet_placed(player2, game_addr, 2);
    relayer.emit_bet_settled(caller(), 1, true, 2);
    relayer.emit_bet_settled(player2, 2, false, 0);
}

// =============================================
// Edge cases
// =============================================

#[test]
fn test_emit_bet_settled_zero_score_win() {
    let (_world, relayer) = setup();
    // Edge: won=true but score=0 (shouldn't happen in practice, but contract allows it)
    relayer.emit_bet_settled(caller(), 1, true, 0);
}

#[test]
fn test_emit_bet_settled_high_score() {
    let (_world, relayer) = setup();
    relayer.emit_bet_settled(caller(), 1, true, 100);
}

#[test]
fn test_emit_bet_placed_token_id_zero() {
    let (_world, relayer) = setup();
    let game_addr: ContractAddress = 'GAME'.try_into().unwrap();
    relayer.emit_bet_placed(caller(), game_addr, 0);
}
