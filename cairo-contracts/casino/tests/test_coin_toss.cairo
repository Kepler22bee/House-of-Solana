use dojo::model::{ModelStorage, ModelStorageTest};
use dojo::world::WorldStorageTrait;
use dojo_snf_test::{
    spawn_test_world, NamespaceDef, TestResource, ContractDefTrait, ContractDef,
    WorldStorageTestTrait,
};
use snforge_std::start_cheat_caller_address;
use starknet::ContractAddress;

use game_components_minigame::interface::{
    IMinigameTokenDataDispatcher, IMinigameTokenDataDispatcherTrait,
    IMinigameDetailsDispatcher, IMinigameDetailsDispatcherTrait,
};
use game_components_minigame::structs::GameDetail;
use cairo_casino::systems::coin_toss::{ICoinTossDispatcher, ICoinTossDispatcherTrait};
use cairo_casino::models::CoinTossGame;

const PLAYER: felt252 = 'PLAYER';
const CREATOR: felt252 = 'CREATOR';

fn namespace_def() -> NamespaceDef {
    NamespaceDef {
        namespace: "cairo_casino",
        resources: [
            TestResource::Model("CoinTossGame"),
            TestResource::Contract("coin_toss"),
        ]
            .span(),
    }
}

fn contract_defs() -> Span<ContractDef> {
    [
        ContractDefTrait::new(@"cairo_casino", @"coin_toss")
            .with_writer_of([dojo::utils::bytearray_hash(@"cairo_casino")].span()),
    ]
        .span()
}

fn caller() -> ContractAddress {
    PLAYER.try_into().unwrap()
}

fn creator() -> ContractAddress {
    CREATOR.try_into().unwrap()
}

fn setup() -> (dojo::world::WorldStorage, ICoinTossDispatcher) {
    let ndef = namespace_def();
    let mut world = spawn_test_world([ndef].span());
    world.sync_perms_and_inits(contract_defs());
    let (contract_address, _) = world.dns(@"coin_toss").unwrap();
    let coin_toss = ICoinTossDispatcher { contract_address };
    start_cheat_caller_address(contract_address, caller());
    (world, coin_toss)
}

// Helper to extract GameDetail value by name
fn find_detail(details: Span<GameDetail>, name: ByteArray) -> ByteArray {
    let mut i = 0;
    while i < details.len() {
        let d = details.at(i);
        if d.name == @name {
            return d.value.clone();
        }
        i += 1;
    };
    panic!("detail not found")
}

// =============================================
// IMinigameTokenData: score & game_over
// =============================================

#[test]
fn test_score_default_zero() {
    let (_world, coin_toss) = setup();
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 0, "default score should be 0");
}

#[test]
fn test_game_over_default_false() {
    let (_world, coin_toss) = setup();
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(!td.game_over(1), "default game_over should be false");
}

#[test]
fn test_score_after_win() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 2, "winning score should be 2");
    assert!(td.game_over(1), "game should be over");
}

#[test]
fn test_score_after_loss() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 1, won: false, over: true, score: 0 },
        );
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 0, "losing score should be 0");
    assert!(td.game_over(1), "game should be over after loss");
}

// =============================================
// IMinigameDetails: token_name
// =============================================

#[test]
fn test_token_name() {
    let (_world, coin_toss) = setup();
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    assert!(details.token_name(1) == "Coin Toss", "name should be 'Coin Toss'");
}

// =============================================
// IMinigameDetails: token_description
// =============================================

#[test]
fn test_description_pending() {
    let (_world, coin_toss) = setup();
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    assert!(
        details.token_description(1) == "Coin Toss - Awaiting flip",
        "pending game should show awaiting flip",
    );
}

#[test]
fn test_description_won() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    assert!(
        details.token_description(1) == "Coin Toss - Winner! 2x payout", "win description",
    );
}

#[test]
fn test_description_lost() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 1, result: 0, won: false, over: true, score: 0 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    assert!(
        details.token_description(1) == "Coin Toss - Better luck next time", "loss description",
    );
}

// =============================================
// IMinigameDetails: game_details VALUE checks
// =============================================

#[test]
fn test_game_details_pending_values() {
    let (_world, coin_toss) = setup();
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    let gd = details.game_details(1);
    assert!(gd.len() == 3, "should have 3 game details");
    // Default model: choice=0 → "Heads", not over → "Pending" / "In Progress"
    assert!(find_detail(gd, "Choice") == "Heads", "default choice should be Heads");
    assert!(find_detail(gd, "Result") == "Pending", "pending result");
    assert!(find_detail(gd, "Outcome") == "In Progress", "pending outcome");
}

#[test]
fn test_game_details_won_heads_values() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    let gd = details.game_details(1);
    assert!(find_detail(gd, "Choice") == "Heads", "chose heads");
    assert!(find_detail(gd, "Result") == "Heads", "result heads");
    assert!(find_detail(gd, "Outcome") == "Won", "outcome won");
}

#[test]
fn test_game_details_won_tails_values() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 1, result: 1, won: true, over: true, score: 2 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    let gd = details.game_details(1);
    assert!(find_detail(gd, "Choice") == "Tails", "chose tails");
    assert!(find_detail(gd, "Result") == "Tails", "result tails");
    assert!(find_detail(gd, "Outcome") == "Won", "outcome won");
}

#[test]
fn test_game_details_lost_chose_heads_got_tails() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 1, won: false, over: true, score: 0 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    let gd = details.game_details(1);
    assert!(find_detail(gd, "Choice") == "Heads", "chose heads");
    assert!(find_detail(gd, "Result") == "Tails", "result tails");
    assert!(find_detail(gd, "Outcome") == "Lost", "outcome lost");
}

#[test]
fn test_game_details_lost_chose_tails_got_heads() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 1, result: 0, won: false, over: true, score: 0 },
        );
    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    let gd = details.game_details(1);
    assert!(find_detail(gd, "Choice") == "Tails", "chose tails");
    assert!(find_detail(gd, "Result") == "Heads", "result heads");
    assert!(find_detail(gd, "Outcome") == "Lost", "outcome lost");
}

// =============================================
// Multiple tokens: independence
// =============================================

#[test]
fn test_multiple_tokens_independent() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    world
        .write_model_test(
            @CoinTossGame {
                token_id: 2, choice: 1, result: 0, won: false, over: true, score: 0,
            },
        );
    // Token 3 not written — should be default

    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 2, "token 1 won");
    assert!(td.score(2) == 0, "token 2 lost");
    assert!(td.score(3) == 0, "token 3 default");
    assert!(td.game_over(1), "token 1 over");
    assert!(td.game_over(2), "token 2 over");
    assert!(!td.game_over(3), "token 3 not over");
}

#[test]
fn test_multiple_tokens_descriptions_independent() {
    let (mut world, coin_toss) = setup();
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    world
        .write_model_test(
            @CoinTossGame {
                token_id: 2, choice: 1, result: 0, won: false, over: true, score: 0,
            },
        );

    let details = IMinigameDetailsDispatcher { contract_address: coin_toss.contract_address };
    assert!(
        details.token_description(1) == "Coin Toss - Winner! 2x payout", "token 1 won desc",
    );
    assert!(
        details.token_description(2) == "Coin Toss - Better luck next time", "token 2 lost desc",
    );
    assert!(
        details.token_description(3) == "Coin Toss - Awaiting flip", "token 3 pending desc",
    );
}

// =============================================
// Score consistency: win always 2, loss always 0
// =============================================

#[test]
fn test_win_score_is_always_two() {
    let (mut world, coin_toss) = setup();
    // Win with heads
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: true, over: true, score: 2 },
        );
    // Win with tails
    world
        .write_model_test(
            @CoinTossGame { token_id: 2, choice: 1, result: 1, won: true, over: true, score: 2 },
        );
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 2, "heads win score 2");
    assert!(td.score(2) == 2, "tails win score 2");
}

#[test]
fn test_loss_score_is_always_zero() {
    let (mut world, coin_toss) = setup();
    // Loss: chose heads, got tails
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 1, won: false, over: true, score: 0 },
        );
    // Loss: chose tails, got heads
    world
        .write_model_test(
            @CoinTossGame { token_id: 2, choice: 1, result: 0, won: false, over: true, score: 0 },
        );
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(td.score(1) == 0, "heads loss score 0");
    assert!(td.score(2) == 0, "tails loss score 0");
}

// =============================================
// Initialization (requires EGS token — see note)
// =============================================
// Note: initialize() calls MinigameComponent.initializer() which interacts with the
// token_address contract (checks IMinigame interface). Full integration testing requires
// deploying FullTokenContract + MinigameRegistryContract. Our toolchain (Cairo 2.13.1,
// snforge 0.51.2) doesn't have denshokan_testing helpers, so full EGS integration
// tests would need manual contract deployment with serialized constructor args.

// =============================================
// Flip validation
// =============================================

#[test]
#[should_panic(expected: "Choice must be 0 (heads) or 1 (tails)")]
fn test_flip_invalid_choice_2() {
    let (_world, coin_toss) = setup();
    coin_toss.flip(1, 2);
}

#[test]
#[should_panic(expected: "Choice must be 0 (heads) or 1 (tails)")]
fn test_flip_invalid_choice_255() {
    let (_world, coin_toss) = setup();
    coin_toss.flip(1, 255);
}

// =============================================
// Model state: verify all fields round-trip
// =============================================

#[test]
fn test_model_all_fields_heads_win() {
    let (mut world, _coin_toss) = setup();
    let game = CoinTossGame { token_id: 42, choice: 0, result: 0, won: true, over: true, score: 2 };
    world.write_model_test(@game);
    let read: CoinTossGame = world.read_model(42_u64);
    assert!(read.token_id == 42, "token_id");
    assert!(read.choice == 0, "choice");
    assert!(read.result == 0, "result");
    assert!(read.won, "won");
    assert!(read.over, "over");
    assert!(read.score == 2, "score");
}

#[test]
fn test_model_all_fields_tails_loss() {
    let (mut world, _coin_toss) = setup();
    let game = CoinTossGame {
        token_id: 99, choice: 1, result: 0, won: false, over: true, score: 0,
    };
    world.write_model_test(@game);
    let read: CoinTossGame = world.read_model(99_u64);
    assert!(read.token_id == 99, "token_id");
    assert!(read.choice == 1, "choice");
    assert!(read.result == 0, "result");
    assert!(!read.won, "not won");
    assert!(read.over, "over");
    assert!(read.score == 0, "score");
}

#[test]
fn test_model_default_state() {
    let (world, _coin_toss) = setup();
    let read: CoinTossGame = world.read_model(999_u64);
    assert!(read.token_id == 999, "token_id is key");
    assert!(read.choice == 0, "default choice 0");
    assert!(read.result == 0, "default result 0");
    assert!(!read.won, "default not won");
    assert!(!read.over, "default not over");
    assert!(read.score == 0, "default score 0");
}

// =============================================
// Model overwrite: second write replaces first
// =============================================

#[test]
fn test_model_overwrite() {
    let (mut world, coin_toss) = setup();
    // Write initial state
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 0, won: false, over: false, score: 0 },
        );
    let td = IMinigameTokenDataDispatcher { contract_address: coin_toss.contract_address };
    assert!(!td.game_over(1), "not over yet");

    // Overwrite with completed game
    world
        .write_model_test(
            @CoinTossGame { token_id: 1, choice: 0, result: 1, won: false, over: true, score: 0 },
        );
    assert!(td.game_over(1), "now over");
    assert!(td.score(1) == 0, "lost");
}
