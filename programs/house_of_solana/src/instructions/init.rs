use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::access_control::{
    CreateGroupCpiBuilder, CreatePermissionCpiBuilder,
    MAGICBLOCK_PERMISSION_PROGRAM_ID,
};
use crate::constants::*;
use crate::errors::HouseError;
use crate::state::*;

pub fn handle_initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.bump = ctx.bumps.vault;
    msg!("Vault initialized");
    Ok(())
}

pub fn handle_initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
    let player = &mut ctx.accounts.player;
    require!(!player.initialized, HouseError::AlreadyInitialized);

    player.authority = ctx.accounts.authority.key();
    player.balance = DEFAULT_BALANCE;
    player.total_deposited = 0;
    player.total_withdrawn = 0;
    player.total_bets = 0;
    player.total_wins = 0;
    player.total_losses = 0;
    player.total_wagered = 0;
    player.total_won = 0;
    player.initialized = true;
    player.bump = ctx.bumps.player;

    msg!("Player initialized with {} chips", DEFAULT_BALANCE);
    Ok(())
}

pub fn handle_setup_permissions(ctx: Context<SetupPermissions>) -> Result<()> {
    let coin_toss_pda = ctx.accounts.coin_toss.key();
    let authority_key = ctx.accounts.authority.key();

    CreateGroupCpiBuilder::new(&ctx.accounts.permission_program)
        .group(&ctx.accounts.group)
        .payer(&ctx.accounts.authority)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .id(authority_key)
        .members(vec![authority_key])
        .invoke()?;

    let bump = ctx.bumps.coin_toss;
    let seeds: &[&[u8]] = &[
        COIN_TOSS_SEED,
        ctx.accounts.authority.key.as_ref(),
        &[bump],
    ];

    CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
        .permission(&ctx.accounts.permission_coin_toss)
        .delegated_account(&ctx.accounts.coin_toss.to_account_info())
        .group(&ctx.accounts.group)
        .payer(&ctx.accounts.authority)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .invoke_signed(&[seeds])?;

    msg!("Permissions set up: CoinToss {} restricted to player {}", coin_toss_pda, authority_key);
    Ok(())
}

pub fn handle_initialize_blackjack(ctx: Context<InitializeBlackjack>) -> Result<()> {
    let bj = &mut ctx.accounts.blackjack;
    bj.player = ctx.accounts.authority.key();
    bj.player_cards = vec![];
    bj.dealer_cards = vec![];
    bj.bet_amount = 0;
    bj.status = BlackjackStatus::Idle;
    bj.result = BlackjackResult::None;
    bj.bump = ctx.bumps.blackjack;
    msg!("Blackjack state initialized");
    Ok(())
}

// ===== CONTEXTS =====

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Vault::INIT_SPACE, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + Player::INIT_SPACE, seeds = [PLAYER_SEED, authority.key().as_ref()], bump)]
    pub player: Account<'info, Player>,
    #[account(init, payer = authority, space = 8 + CoinToss::INIT_SPACE, seeds = [COIN_TOSS_SEED, authority.key().as_ref()], bump)]
    pub coin_toss: Account<'info, CoinToss>,
    #[account(init, payer = authority, space = 8 + BlackjackState::INIT_SPACE, seeds = [BLACKJACK_SEED, authority.key().as_ref()], bump)]
    pub blackjack: Account<'info, BlackjackState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeBlackjack<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(init, payer = authority, space = 8 + BlackjackState::INIT_SPACE, seeds = [BLACKJACK_SEED, authority.key().as_ref()], bump)]
    pub blackjack: Account<'info, BlackjackState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetupPermissions<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [COIN_TOSS_SEED, authority.key().as_ref()], bump)]
    pub coin_toss: Account<'info, CoinToss>,
    /// CHECK: Group PDA
    #[account(mut)]
    pub group: AccountInfo<'info>,
    /// CHECK: Permission PDA for coin_toss
    #[account(mut)]
    pub permission_coin_toss: AccountInfo<'info>,
    /// CHECK: MagicBlock Permission Program
    #[account(address = MAGICBLOCK_PERMISSION_PROGRAM_ID)]
    pub permission_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
