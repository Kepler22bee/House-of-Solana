use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::PLAYER_SEED;
use crate::errors::HouseError;
use crate::state::Player;
use super::state::*;
use super::executor::{execute_steps, StepResult};

/// Start a game from a template
pub fn handle_start_game(ctx: Context<StartGame>, bet_amount: u64) -> Result<()> {
    let template = &ctx.accounts.template;
    require!(template.active, HouseError::Unauthorized);
    require!(bet_amount >= template.min_bet, HouseError::BetTooSmall);
    require!(bet_amount <= template.max_bet, HouseError::BetTooLarge);

    let player = &mut ctx.accounts.player;
    require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

    // Deduct bet
    player.balance -= bet_amount;
    player.total_bets += 1;
    player.total_wagered += bet_amount;

    // Calculate fees
    let house_fee = (bet_amount as u128 * HOUSE_FEE_BPS as u128 / 10000) as u64;
    let creator_fee = (bet_amount as u128 * template.creator_fee_bps as u128 / 10000) as u64;
    let effective_bet = bet_amount.saturating_sub(house_fee).saturating_sub(creator_fee);

    // Initialize session
    let session = &mut ctx.accounts.session;
    session.player = ctx.accounts.authority.key();
    session.template = template.key();
    session.current_step = 0;
    session.bet_amount = bet_amount;
    session.effective_bet = effective_bet;
    session.last_choice = 0;
    session.player_values = vec![];
    session.dealer_values = vec![];
    session.shared_values = vec![];
    session.counters = [0; 4];
    session.status = SessionStatus::Active;
    session.result_multiplier_bps = 0;
    session.streak = 0;

    // Try executing steps — first step likely needs VRF
    let result = execute_steps(session, &template.steps, None);

    match result {
        StepResult::NeedVrf => {
            // Request VRF
            let ix = create_request_randomness_ix(RequestRandomnessParams {
                payer: ctx.accounts.authority.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: crate::instruction::CallbackGame::DISCRIMINATOR.to_vec(),
                caller_seed: [session.current_step; 32],
                accounts_metas: Some(vec![
                    SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
                    SerializableAccountMeta { pubkey: ctx.accounts.session.key(), is_signer: false, is_writable: true },
                    SerializableAccountMeta { pubkey: template.key(), is_signer: false, is_writable: true },
                ]),
                ..Default::default()
            });
            ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;
        }
        StepResult::WaitingForChoice => {
            // Will wait for player_choice instruction
        }
        StepResult::Settled { multiplier_bps } => {
            settle(player, session, effective_bet, multiplier_bps);
        }
        StepResult::Lost => {
            player.total_losses += 1;
            session.status = SessionStatus::Settled;
        }
        StepResult::Pushed => {
            player.balance += effective_bet;
            session.status = SessionStatus::Settled;
        }
        StepResult::Continue => {}
    }

    // Update template stats
    let template = &mut ctx.accounts.template;
    template.total_plays += 1;
    template.total_volume += bet_amount;

    msg!("Game started: template={}, bet={}, effective={}", template.id, bet_amount, effective_bet);
    Ok(())
}

/// VRF callback — continues execution with randomness
pub fn handle_callback_game(ctx: Context<CallbackGame>, randomness: [u8; 32]) -> Result<()> {
    let session = &mut ctx.accounts.session;
    let template = &ctx.accounts.template;

    require!(
        session.status == SessionStatus::WaitingForVrf,
        HouseError::NoActiveHand
    );

    session.status = SessionStatus::Active;
    let result = execute_steps(session, &template.steps, Some(&randomness));

    let player = &mut ctx.accounts.player;
    match result {
        StepResult::NeedVrf => {
            // Shouldn't happen right after getting VRF, but handle gracefully
            session.status = SessionStatus::WaitingForVrf;
        }
        StepResult::WaitingForChoice => {}
        StepResult::Settled { multiplier_bps } => {
            let eff = session.effective_bet;
            settle(player, session, eff, multiplier_bps);
        }
        StepResult::Lost => {
            player.total_losses += 1;
            session.status = SessionStatus::Settled;
        }
        StepResult::Pushed => {
            let eff = session.effective_bet;
            player.balance += eff;
            session.status = SessionStatus::Settled;
        }
        StepResult::Continue => {}
    }

    Ok(())
}

/// Player makes a choice (hit/stand/fold/etc)
pub fn handle_player_choice(ctx: Context<PlayerChoice>, choice_bit: u8) -> Result<()> {
    let session = &mut ctx.accounts.session;
    require!(
        session.status == SessionStatus::WaitingForChoice,
        HouseError::NotPlayerTurn
    );

    session.last_choice = choice_bit;
    session.current_step += 1; // move past AwaitChoice
    session.status = SessionStatus::Active;

    let template = &ctx.accounts.template;
    let result = execute_steps(session, &template.steps, None);

    let player = &mut ctx.accounts.player;
    match result {
        StepResult::NeedVrf => {
            // Request VRF
            let ix = create_request_randomness_ix(RequestRandomnessParams {
                payer: ctx.accounts.authority.key(),
                oracle_queue: ctx.accounts.oracle_queue.key(),
                callback_program_id: crate::ID,
                callback_discriminator: crate::instruction::CallbackGame::DISCRIMINATOR.to_vec(),
                caller_seed: [session.current_step; 32],
                accounts_metas: Some(vec![
                    SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
                    SerializableAccountMeta { pubkey: ctx.accounts.session.key(), is_signer: false, is_writable: true },
                    SerializableAccountMeta { pubkey: template.key(), is_signer: false, is_writable: true },
                ]),
                ..Default::default()
            });
            ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;
        }
        StepResult::WaitingForChoice => {}
        StepResult::Settled { multiplier_bps } => {
            let eff = session.effective_bet;
            settle(player, session, eff, multiplier_bps);
        }
        StepResult::Lost => {
            player.total_losses += 1;
            session.status = SessionStatus::Settled;
        }
        StepResult::Pushed => {
            let eff = session.effective_bet;
            player.balance += eff;
            session.status = SessionStatus::Settled;
        }
        StepResult::Continue => {}
    }

    Ok(())
}

fn settle(player: &mut Player, session: &mut GameSession, effective_bet: u64, multiplier_bps: u16) {
    let payout = (effective_bet as u128 * multiplier_bps as u128 / 10000) as u64;
    player.balance += payout;
    player.total_wins += 1;
    player.total_won += payout;
    session.status = SessionStatus::Settled;
    msg!("Settled: payout={} ({}bps of {})", payout, multiplier_bps, effective_bet);
}

// ===== CONTEXTS =====

#[vrf]
#[derive(Accounts)]
pub struct StartGame<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == authority.key() @ HouseError::Unauthorized,
    )]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,

    #[account(
        init_if_needed,
        payer = authority,
        space = 8 + GameSession::INIT_SPACE,
        seeds = [SESSION_SEED, authority.key().as_ref()],
        bump,
    )]
    pub session: Account<'info, GameSession>,

    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackGame<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    #[account(mut)]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub session: Account<'info, GameSession>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,
}

#[vrf]
#[derive(Accounts)]
pub struct PlayerChoice<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == authority.key() @ HouseError::Unauthorized,
    )]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,

    #[account(
        mut,
        seeds = [SESSION_SEED, authority.key().as_ref()],
        bump = session.bump,
    )]
    pub session: Account<'info, GameSession>,

    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
