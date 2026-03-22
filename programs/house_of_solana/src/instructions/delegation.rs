use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_rollups_sdk::access_control::instructions::CreatePermissionCpiBuilder;
use ephemeral_rollups_sdk::access_control::structs::{
    Member, MembersArgs,
    AUTHORITY_FLAG, TX_LOGS_FLAG, TX_BALANCES_FLAG, TX_MESSAGE_FLAG,
};
use ephemeral_rollups_sdk::consts::PERMISSION_PROGRAM_ID;
use crate::constants::*;
use crate::factory::state::{SESSION_SEED, TABLE_SEED};

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

pub fn handle_delegate_session(ctx: Context<DelegatePda>) -> Result<()> {
    ctx.accounts.delegate_pda(
        &ctx.accounts.payer,
        &[SESSION_SEED, ctx.accounts.payer.key().as_ref()],
        DelegateConfig {
            validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
            ..Default::default()
        },
    )?;
    msg!("Game session delegated to TEE ER");
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

/// Create a permission for a game session (dynamic account)
pub fn handle_setup_session_permission(ctx: Context<SetupSessionPermission>) -> Result<()> {
    let authority_key = ctx.accounts.authority.key();

    let all_flags = AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG;
    let members_args = MembersArgs {
        members: Some(vec![Member {
            flags: all_flags,
            pubkey: authority_key,
        }]),
    };

    let bump = ctx.bumps.session;
    let seeds: &[&[u8]] = &[
        SESSION_SEED,
        ctx.accounts.authority.key.as_ref(),
        &[bump],
    ];

    CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
        .permissioned_account(&ctx.accounts.session.to_account_info())
        .permission(&ctx.accounts.permission_session)
        .payer(&ctx.accounts.authority)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .args(members_args)
        .invoke_signed(&[seeds])?;

    msg!("Session permission created for player {}", authority_key);
    Ok(())
}

/// Create a permission for a multiplayer table (dynamic account)
pub fn handle_setup_table_permission(ctx: Context<SetupTablePermission>) -> Result<()> {
    let table_id = ctx.accounts.table.id;

    let seat1 = ctx.accounts.table.seat1;
    let seat2 = ctx.accounts.table.seat2;

    // Both players get full access to the table
    let all_flags = AUTHORITY_FLAG | TX_LOGS_FLAG | TX_BALANCES_FLAG | TX_MESSAGE_FLAG;
    let members_args = MembersArgs {
        members: Some(vec![
            Member { flags: all_flags, pubkey: seat1 },
            Member { flags: all_flags, pubkey: seat2 },
        ]),
    };

    let bump = ctx.bumps.table;
    let id_bytes = table_id.to_le_bytes();
    let seeds: &[&[u8]] = &[
        TABLE_SEED,
        &id_bytes,
        &[bump],
    ];

    CreatePermissionCpiBuilder::new(&ctx.accounts.permission_program)
        .permissioned_account(&ctx.accounts.table.to_account_info())
        .permission(&ctx.accounts.permission_table)
        .payer(&ctx.accounts.authority)
        .system_program(&ctx.accounts.system_program.to_account_info())
        .args(members_args)
        .invoke_signed(&[seeds])?;

    msg!("Table {} permission created for seats {} and {}", table_id, seat1, seat2);
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

#[derive(Accounts)]
pub struct SetupSessionPermission<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// CHECK: Session PDA
    #[account(mut, seeds = [SESSION_SEED, authority.key().as_ref()], bump)]
    pub session: AccountInfo<'info>,
    /// CHECK: Permission PDA for session
    #[account(mut)]
    pub permission_session: AccountInfo<'info>,
    /// CHECK: MagicBlock Permission Program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetupTablePermission<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    /// The table account
    #[account(mut, seeds = [TABLE_SEED, &table.id.to_le_bytes()], bump)]
    pub table: Account<'info, crate::factory::state::Table>,
    /// CHECK: Permission PDA for table
    #[account(mut)]
    pub permission_table: AccountInfo<'info>,
    /// CHECK: MagicBlock Permission Program
    #[account(address = PERMISSION_PROGRAM_ID)]
    pub permission_program: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}
