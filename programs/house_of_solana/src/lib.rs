use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::ephemeral;

pub mod constants;
pub mod errors;
pub mod state;
pub mod games;
pub mod instructions;

pub use constants::*;
pub use errors::*;
pub use state::*;
pub use games::*;
pub use instructions::*;

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
    pub fn commit_player(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
    pub fn commit_coin_toss(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
    pub fn commit_blackjack(ctx: Context<CommitPda>) -> Result<()> {
        instructions::delegation::handle_commit_account(ctx)
    }
}
