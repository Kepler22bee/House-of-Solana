use anchor_lang::prelude::*;
use crate::errors::HouseError;
use crate::state::Vault;
use crate::constants::VAULT_SEED;
use super::primitives::GameAction;
use super::state::*;

pub fn handle_propose_game(
    ctx: Context<ProposeGame>,
    id: u64,
    co_creator: Pubkey,
    name: [u8; 32],
    description: [u8; 128],
    steps: Vec<GameAction>,
    min_bet: u64,
    max_bet: u64,
    creator_fee_bps: u16,
    fee_split_bps: u16,
) -> Result<()> {
    require!(steps.len() <= MAX_STEPS, HouseError::BetTooLarge);
    require!(creator_fee_bps <= 2000, HouseError::BetTooLarge);
    require!(fee_split_bps <= 10000, HouseError::BetTooLarge);

    let proposal = &mut ctx.accounts.proposal;
    proposal.id = id;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.co_creator = co_creator;
    proposal.name = name;
    proposal.description = description;
    proposal.steps = steps;
    proposal.min_bet = min_bet;
    proposal.max_bet = max_bet;
    proposal.creator_fee_bps = creator_fee_bps;
    proposal.fee_split_bps = fee_split_bps;
    proposal.status = ProposalStatus::Pending;
    proposal.created_at = Clock::get()?.unix_timestamp;
    proposal.bump = ctx.bumps.proposal;

    msg!("Game proposed: id={}, co_creator={}", id, co_creator);
    Ok(())
}

pub fn handle_accept_proposal(ctx: Context<AcceptProposal>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.status == ProposalStatus::Pending, HouseError::AlreadySettled);
    require!(proposal.co_creator == ctx.accounts.co_creator.key(), HouseError::Unauthorized);

    proposal.status = ProposalStatus::Accepted;

    // Create template from proposal
    let template = &mut ctx.accounts.template;
    template.id = proposal.id;
    template.creator = proposal.proposer;
    template.co_creator = proposal.co_creator;
    template.name = proposal.name;
    template.description = proposal.description;
    template.steps = proposal.steps.clone();
    template.min_bet = proposal.min_bet;
    template.max_bet = proposal.max_bet;
    template.creator_fee_bps = proposal.creator_fee_bps;
    template.total_plays = 0;
    template.total_volume = 0;
    template.active = true;
    template.bump = ctx.bumps.template;

    msg!("Proposal {} accepted, template created", proposal.id);
    Ok(())
}

pub fn handle_reject_proposal(ctx: Context<RejectProposal>) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    require!(proposal.status == ProposalStatus::Pending, HouseError::AlreadySettled);
    require!(proposal.co_creator == ctx.accounts.co_creator.key(), HouseError::Unauthorized);

    proposal.status = ProposalStatus::Rejected;
    msg!("Proposal {} rejected", proposal.id);
    Ok(())
}

// ===== CONTEXTS =====

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct ProposeGame<'info> {
    #[account(mut)]
    pub proposer: Signer<'info>,

    #[account(
        init,
        payer = proposer,
        space = 8 + GameProposal::INIT_SPACE,
        seeds = [PROPOSAL_SEED, &id.to_le_bytes()],
        bump,
    )]
    pub proposal: Account<'info, GameProposal>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptProposal<'info> {
    #[account(mut)]
    pub co_creator: Signer<'info>,

    #[account(mut)]
    pub proposal: Account<'info, GameProposal>,

    /// Vault pays rent for the template
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = co_creator,
        space = 8 + GameTemplate::INIT_SPACE,
        seeds = [TEMPLATE_SEED, &proposal.id.to_le_bytes()],
        bump,
    )]
    pub template: Account<'info, GameTemplate>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RejectProposal<'info> {
    pub co_creator: Signer<'info>,
    #[account(mut)]
    pub proposal: Account<'info, GameProposal>,
}
