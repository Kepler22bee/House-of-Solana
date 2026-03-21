use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use crate::constants::*;

pub fn handle_delegate_player(ctx: Context<DelegatePda>) -> Result<()> {
    ctx.accounts.delegate_pda(
        &ctx.accounts.payer,
        &[PLAYER_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;
    msg!("Player delegated to TEE ER");
    Ok(())
}

pub fn handle_delegate_coin_toss(ctx: Context<DelegatePda>) -> Result<()> {
    ctx.accounts.delegate_pda(
        &ctx.accounts.payer,
        &[COIN_TOSS_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;
    msg!("Coin toss delegated to TEE ER");
    Ok(())
}

pub fn handle_delegate_blackjack(ctx: Context<DelegatePda>) -> Result<()> {
    ctx.accounts.delegate_pda(
        &ctx.accounts.payer,
        &[BLACKJACK_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;
    msg!("Blackjack delegated to TEE ER");
    Ok(())
}

pub fn handle_commit_account(ctx: Context<CommitPda>) -> Result<()> {
    commit_and_undelegate_accounts(
        &ctx.accounts.payer,
        vec![&ctx.accounts.pda.to_account_info()],
        &ctx.accounts.magic_context,
        &ctx.accounts.magic_program,
    )?;
    msg!("Account committed and undelegated");
    Ok(())
}

// ===== CONTEXTS =====

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitPda<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The PDA to commit/undelegate
    #[account(mut)]
    pub pda: AccountInfo<'info>,
}
