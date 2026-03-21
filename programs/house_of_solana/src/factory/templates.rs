use anchor_lang::prelude::*;
use crate::errors::HouseError;
use crate::state::Vault;
use crate::constants::VAULT_SEED;
use super::primitives::GameAction;
use super::state::*;

pub fn handle_create_template(
    ctx: Context<CreateTemplate>,
    id: u64,
    name: [u8; 32],
    description: [u8; 128],
    steps: Vec<GameAction>,
    min_bet: u64,
    max_bet: u64,
    creator_fee_bps: u16,
) -> Result<()> {
    require!(steps.len() <= MAX_STEPS, HouseError::BetTooLarge); // reuse error
    require!(min_bet > 0 && max_bet >= min_bet, HouseError::BetTooSmall);
    require!(creator_fee_bps <= 2000, HouseError::BetTooLarge); // max 20% creator fee

    let template = &mut ctx.accounts.template;
    template.id = id;
    template.creator = ctx.accounts.creator.key();
    template.co_creator = Pubkey::default();
    template.name = name;
    template.description = description;
    template.steps = steps;
    template.min_bet = min_bet;
    template.max_bet = max_bet;
    template.creator_fee_bps = creator_fee_bps;
    template.total_plays = 0;
    template.total_volume = 0;
    template.active = true;
    template.bump = ctx.bumps.template;

    msg!("Game template created: id={}", id);
    Ok(())
}

pub fn handle_deactivate_template(ctx: Context<DeactivateTemplate>) -> Result<()> {
    let template = &mut ctx.accounts.template;
    require!(
        template.creator == ctx.accounts.creator.key(),
        HouseError::Unauthorized
    );
    template.active = false;
    msg!("Template {} deactivated", template.id);
    Ok(())
}

// ===== CONTEXTS =====

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateTemplate<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    /// Vault pays rent for the template account
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = creator, // creator fronts rent, but house model means vault could reimburse
        space = 8 + GameTemplate::INIT_SPACE,
        seeds = [TEMPLATE_SEED, &id.to_le_bytes()],
        bump,
    )]
    pub template: Account<'info, GameTemplate>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateTemplate<'info> {
    pub creator: Signer<'info>,
    #[account(mut)]
    pub template: Account<'info, GameTemplate>,
}
