use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod state;
pub mod games;
pub mod instructions;
pub mod factory;

pub use constants::*;
pub use errors::*;
pub use state::*;
pub use games::*;
pub use instructions::*;
pub use factory::*;

declare_id!("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");

#[ephemeral]
#[program]
pub mod house_of_solana {
    use super::*;

    // ===== INIT =====
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        instructions::init::handle_initialize_vault(ctx)
    }
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        instructions::init::handle_initialize_player(ctx)
    }
    pub fn initialize_blackjack(ctx: Context<InitializeBlackjack>) -> Result<()> {
        instructions::init::handle_initialize_blackjack(ctx)
    }
    pub fn setup_permissions(ctx: Context<SetupPermissions>) -> Result<()> {
        instructions::init::handle_setup_permissions(ctx)
    }

    // ===== CHIPS =====
    pub fn buy_chips(ctx: Context<BuyChips>, lamports: u64) -> Result<()> {
        instructions::chips::handle_buy_chips(ctx, lamports)
    }
    pub fn cash_out(ctx: Context<CashOut>, chips: u64) -> Result<()> {
        instructions::chips::handle_cash_out(ctx, chips)
    }

    // ===== COIN TOSS =====
    pub fn flip_coin(ctx: Context<FlipCoin>, choice: u8, bet_amount: u64) -> Result<()> {
        games::coin_toss::handle_flip_coin(ctx, choice, bet_amount)
    }
    pub fn callback_flip_coin(ctx: Context<CallbackFlipCoin>, randomness: [u8; 32]) -> Result<()> {
        games::coin_toss::handle_callback_flip_coin(ctx, randomness)
    }

    // ===== BLACKJACK =====
    pub fn start_hand(ctx: Context<StartHand>, bet_amount: u64) -> Result<()> {
        games::blackjack::handle_start_hand(ctx, bet_amount)
    }
    pub fn callback_deal(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
        games::blackjack::handle_callback_deal(ctx, randomness)
    }
    pub fn hit(ctx: Context<Hit>) -> Result<()> {
        games::blackjack::handle_hit(ctx)
    }
    pub fn callback_hit(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
        games::blackjack::handle_callback_hit(ctx, randomness)
    }
    pub fn stand(ctx: Context<Stand>) -> Result<()> {
        games::blackjack::handle_stand(ctx)
    }
    pub fn callback_stand(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
        games::blackjack::handle_callback_stand(ctx, randomness)
    }

    // ===== GAME FACTORY =====
    pub fn create_template(
        ctx: Context<CreateTemplate>,
        id: u64,
        name: [u8; 32],
        description: [u8; 128],
        steps: Vec<factory::primitives::GameAction>,
        min_bet: u64,
        max_bet: u64,
        creator_fee_bps: u16,
    ) -> Result<()> {
        factory::templates::handle_create_template(ctx, id, name, description, steps, min_bet, max_bet, creator_fee_bps)
    }
    pub fn deactivate_template(ctx: Context<DeactivateTemplate>) -> Result<()> {
        factory::templates::handle_deactivate_template(ctx)
    }
    pub fn start_game(ctx: Context<StartGame>, bet_amount: u64) -> Result<()> {
        factory::gameplay::handle_start_game(ctx, bet_amount)
    }
    pub fn callback_game(ctx: Context<CallbackGame>, randomness: [u8; 32]) -> Result<()> {
        factory::gameplay::handle_callback_game(ctx, randomness)
    }
    pub fn player_choice(ctx: Context<PlayerChoice>, choice_bit: u8) -> Result<()> {
        factory::gameplay::handle_player_choice(ctx, choice_bit)
    }
    pub fn propose_game(
        ctx: Context<ProposeGame>,
        id: u64,
        co_creator: Pubkey,
        name: [u8; 32],
        description: [u8; 128],
        steps: Vec<factory::primitives::GameAction>,
        min_bet: u64,
        max_bet: u64,
        creator_fee_bps: u16,
        fee_split_bps: u16,
    ) -> Result<()> {
        factory::negotiation::handle_propose_game(ctx, id, co_creator, name, description, steps, min_bet, max_bet, creator_fee_bps, fee_split_bps)
    }
    pub fn accept_proposal(ctx: Context<AcceptProposal>) -> Result<()> {
        factory::negotiation::handle_accept_proposal(ctx)
    }
    pub fn reject_proposal(ctx: Context<RejectProposal>) -> Result<()> {
        factory::negotiation::handle_reject_proposal(ctx)
    }

    // ===== MULTIPLAYER TABLES =====
    pub fn create_table(ctx: Context<CreateTable>, id: u64, bet_amount: u64) -> Result<()> {
        factory::multiplayer::handle_create_table(ctx, id, bet_amount)
    }
    pub fn join_table(ctx: Context<JoinTable>) -> Result<()> {
        factory::multiplayer::handle_join_table(ctx)
    }
    pub fn table_callback(ctx: Context<TableCallback>, randomness: [u8; 32]) -> Result<()> {
        factory::multiplayer::handle_table_callback(ctx, randomness)
    }
    pub fn table_action(ctx: Context<TableAction>, choice_bit: u8) -> Result<()> {
        factory::multiplayer::handle_table_action(ctx, choice_bit)
    }
    pub fn table_timeout(ctx: Context<TableTimeout>) -> Result<()> {
        factory::multiplayer::handle_table_timeout(ctx)
    }

    // ===== DELEGATION =====
    pub fn delegate_player(ctx: Context<DelegatePda>) -> Result<()> {
        instructions::delegation::handle_delegate_player(ctx)
    }
    pub fn delegate_coin_toss(ctx: Context<DelegatePda>) -> Result<()> {
        instructions::delegation::handle_delegate_coin_toss(ctx)
    }
    pub fn delegate_blackjack(ctx: Context<DelegatePda>) -> Result<()> {
        instructions::delegation::handle_delegate_blackjack(ctx)
    }
    pub fn delegate_session(ctx: Context<DelegatePda>) -> Result<()> {
        instructions::delegation::handle_delegate_session(ctx)
    }
    pub fn commit_player(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
    pub fn commit_coin_toss(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
    pub fn commit_blackjack(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
    pub fn commit_session(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }

    // ===== DYNAMIC PERMISSIONS =====
    pub fn setup_session_permission(ctx: Context<SetupSessionPermission>) -> Result<()> {
        instructions::delegation::handle_setup_session_permission(ctx)
    }
    pub fn setup_table_permission(ctx: Context<SetupTablePermission>) -> Result<()> {
        instructions::delegation::handle_setup_table_permission(ctx)
    }
}
