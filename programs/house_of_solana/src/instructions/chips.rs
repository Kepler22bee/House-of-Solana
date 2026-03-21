use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::constants::*;
use crate::errors::HouseError;
use crate::state::*;

pub fn handle_buy_chips(ctx: Context<BuyChips>, lamports: u64) -> Result<()> {
    require!(lamports > 0, HouseError::ZeroDeposit);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        ),
        lamports,
    )?;

    let chips = lamports / LAMPORTS_PER_CHIP;
    let player = &mut ctx.accounts.player;
    player.balance += chips;
    player.total_deposited += lamports;

    msg!("Bought {} chips for {} lamports", chips, lamports);
    Ok(())
}

pub fn handle_cash_out(ctx: Context<CashOut>, chips: u64) -> Result<()> {
    require!(chips > 0, HouseError::ZeroDeposit);

    let player = &mut ctx.accounts.player;
    require!(player.balance >= chips, HouseError::InsufficientChips);

    let lamports = chips * LAMPORTS_PER_CHIP;
    let vault_info = ctx.accounts.vault.to_account_info();
    require!(vault_info.lamports() >= lamports, HouseError::VaultInsufficient);

    **vault_info.try_borrow_mut_lamports()? -= lamports;
    **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += lamports;

    player.balance -= chips;
    player.total_withdrawn += lamports;

    msg!("Cashed out {} chips for {} lamports", chips, lamports);
    Ok(())
}

// ===== CONTEXTS =====

#[derive(Accounts)]
pub struct BuyChips<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,
    pub system_program: Program<'info, System>,
}
