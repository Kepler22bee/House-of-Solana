use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::PLAYER_SEED;
use crate::errors::HouseError;
use crate::state::Player;
use super::primitives::*;
use super::state::*;

/// Seat 1 creates a table and deposits chips
pub fn handle_create_table(ctx: Context<CreateTable>, id: u64, bet_amount: u64) -> Result<()> {
    let template = &ctx.accounts.template;
    require!(template.active, HouseError::Unauthorized);
    require!(bet_amount >= template.min_bet, HouseError::BetTooSmall);
    require!(bet_amount <= template.max_bet, HouseError::BetTooLarge);

    let player = &mut ctx.accounts.player;
    require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

    player.balance -= bet_amount;

    let table = &mut ctx.accounts.table;
    table.id = id;
    table.template = template.key();
    table.seat1 = ctx.accounts.authority.key();
    table.seat2 = Pubkey::default();
    table.seat1_values = vec![];
    table.seat2_values = vec![];
    table.shared_values = vec![];
    table.pot = bet_amount;
    table.seat1_bet = bet_amount;
    table.seat2_bet = 0;
    table.current_turn = 0;
    table.current_step = 0;
    table.last_choice = [0; 2];
    table.status = TableStatus::WaitingSeat;
    table.winner = 0;
    table.turn_deadline = 0;
    table.bump = ctx.bumps.table;

    msg!("Table {} created by {}, bet={}", id, ctx.accounts.authority.key(), bet_amount);
    Ok(())
}

/// Seat 2 joins and matches the bet. Game starts with VRF request.
pub fn handle_join_table(ctx: Context<JoinTable>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    require!(table.status == TableStatus::WaitingSeat, HouseError::HandInProgress);
    require!(table.seat1 != ctx.accounts.authority.key(), HouseError::Unauthorized);

    let bet_amount = table.seat1_bet;
    let player = &mut ctx.accounts.player;
    require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

    player.balance -= bet_amount;
    table.seat2 = ctx.accounts.authority.key();
    table.seat2_bet = bet_amount;
    table.pot += bet_amount;
    table.status = TableStatus::WaitingVrf;

    // Calculate fees
    let total_bets = table.pot;
    let house_fee = (total_bets as u128 * HOUSE_FEE_BPS as u128 / 10000) as u64;
    table.pot = total_bets.saturating_sub(house_fee);

    // Request VRF for initial deal
    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.authority.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::TableCallback::DISCRIMINATOR.to_vec(),
        caller_seed: [table.id as u8; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta { pubkey: ctx.accounts.seat1_player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.table.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.template.key(), is_signer: false, is_writable: true },
        ]),
        ..Default::default()
    });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

    msg!("Seat 2 joined. Game starting.");
    Ok(())
}

/// VRF callback — executes template steps with randomness
pub fn handle_table_callback(ctx: Context<TableCallback>, randomness: [u8; 32]) -> Result<()> {
    require!(ctx.accounts.table.status == TableStatus::WaitingVrf, HouseError::NoActiveHand);

    // Copy steps to avoid borrow conflict between template and table
    let steps: Vec<GameAction> = ctx.accounts.template.steps.clone();
    let table = &mut ctx.accounts.table;
    table.status = TableStatus::Active;
    let mut rand_idx: usize = 0;
    let mut settle_winner: Option<(u8, u64)> = None; // (winner_seat, pot)

    let mut iterations: u8 = 0;
    loop {
        if iterations >= 64 || table.current_step as usize >= steps.len() {
            break;
        }
        iterations += 1;

        match &steps[table.current_step as usize] {
            GameAction::DealToSeat { seat, count, visibility: _ } => {
                let vals = if *seat == 1 { &mut table.seat1_values } else { &mut table.seat2_values };
                for _ in 0..*count {
                    if rand_idx >= 32 || vals.len() >= 16 { break; }
                    vals.push(crate::state::card_from_random(randomness[rand_idx]));
                    rand_idx += 1;
                }
                table.current_step += 1;
            }
            GameAction::DealCards { count, to, visibility: _ } => {
                let vals = match to {
                    Target::Player => &mut table.seat1_values,
                    Target::Dealer => &mut table.seat2_values,
                    Target::Shared => &mut table.shared_values,
                };
                for _ in 0..*count {
                    if rand_idx >= 32 || vals.len() >= 16 { break; }
                    vals.push(crate::state::card_from_random(randomness[rand_idx]));
                    rand_idx += 1;
                }
                table.current_step += 1;
            }
            GameAction::RollDice { sides, count, to } => {
                let vals = match to {
                    Target::Player => &mut table.seat1_values,
                    Target::Dealer => &mut table.seat2_values,
                    Target::Shared => &mut table.shared_values,
                };
                for _ in 0..*count {
                    if rand_idx >= 32 || vals.len() >= 16 { break; }
                    vals.push((randomness[rand_idx] % *sides) + 1);
                    rand_idx += 1;
                }
                table.current_step += 1;
            }
            GameAction::AwaitTurn { seat } => {
                table.current_turn = *seat;
                table.status = TableStatus::WaitingTurn;
                table.turn_deadline = Clock::get()?.unix_timestamp + TURN_TIMEOUT_SECS;
                break;
            }
            GameAction::CompareSeats => {
                let v1: u16 = table.seat1_values.iter().map(|&v| v as u16).sum();
                let v2: u16 = table.seat2_values.iter().map(|&v| v as u16).sum();
                table.winner = if v1 > v2 { 1 } else if v2 > v1 { 2 } else { 3 };
                table.current_step += 1;
            }
            GameAction::PayoutSeat { seat, multiplier_bps: _ } => {
                let winner_seat = if *seat == 0 { table.winner } else { *seat };
                settle_winner = Some((winner_seat, table.pot));
                table.status = TableStatus::Settled;
                table.pot = 0;
                break;
            }
            GameAction::RevealHidden { .. } => { table.current_step += 1; }
            _ => { table.current_step += 1; }
        }
    }

    // Settle outside the loop to avoid borrow conflict
    if let Some((winner_seat, pot)) = settle_winner {
        let p1 = &mut ctx.accounts.seat1_player;
        let p2 = &mut ctx.accounts.seat2_player;
        if winner_seat == 1 {
            p1.balance += pot; p1.total_wins += 1; p1.total_won += pot;
            p2.total_losses += 1;
        } else if winner_seat == 2 {
            p2.balance += pot; p2.total_wins += 1; p2.total_won += pot;
            p1.total_losses += 1;
        } else {
            let half = pot / 2;
            p1.balance += half; p2.balance += pot - half;
        }
        msg!("Table settled. Winner: seat {}", winner_seat);
    }

    Ok(())
}

/// Current turn player submits their action
pub fn handle_table_action(ctx: Context<TableAction>, choice_bit: u8) -> Result<()> {
    // Capture keys before mutable borrows
    let authority_key = ctx.accounts.authority.key();
    let oracle_key = ctx.accounts.oracle_queue.key();
    let p1_key = ctx.accounts.seat1_player.key();
    let p2_key = ctx.accounts.seat2_player.key();
    let table_key = ctx.accounts.table.key();
    let template_key = ctx.accounts.template.key();
    let steps: Vec<GameAction> = ctx.accounts.template.steps.clone();

    let table = &mut ctx.accounts.table;
    require!(table.status == TableStatus::WaitingTurn, HouseError::NotPlayerTurn);

    let expected_seat = if table.current_turn == 1 { table.seat1 } else { table.seat2 };
    require!(authority_key == expected_seat, HouseError::Unauthorized);

    let seat_idx = if table.current_turn == 1 { 0usize } else { 1usize };
    table.last_choice[seat_idx] = choice_bit;
    table.current_step += 1;

    let mut need_vrf = false;

    if (table.current_step as usize) < steps.len() {
        match &steps[table.current_step as usize] {
            GameAction::AwaitTurn { seat } => {
                table.current_turn = *seat;
                table.status = TableStatus::WaitingTurn;
                table.turn_deadline = Clock::get()?.unix_timestamp + TURN_TIMEOUT_SECS;
                msg!("Now seat {}'s turn", seat);
            }
            _ => {
                table.status = TableStatus::WaitingVrf;
                need_vrf = true;
            }
        }
    }

    let current_step = table.current_step;
    drop(table); // release mutable borrow

    if need_vrf {
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: authority_key,
            oracle_queue: oracle_key,
            callback_program_id: crate::ID,
            callback_discriminator: crate::instruction::TableCallback::DISCRIMINATOR.to_vec(),
            caller_seed: [current_step; 32],
            accounts_metas: Some(vec![
                SerializableAccountMeta { pubkey: p1_key, is_signer: false, is_writable: true },
                SerializableAccountMeta { pubkey: p2_key, is_signer: false, is_writable: true },
                SerializableAccountMeta { pubkey: table_key, is_signer: false, is_writable: true },
                SerializableAccountMeta { pubkey: template_key, is_signer: false, is_writable: true },
            ]),
            ..Default::default()
        });
        ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;
    }

    msg!("Action submitted: choice {}", choice_bit);
    Ok(())
}

/// Anyone can call this if the current turn player times out
pub fn handle_table_timeout(ctx: Context<TableTimeout>) -> Result<()> {
    let table = &mut ctx.accounts.table;
    require!(table.status == TableStatus::WaitingTurn, HouseError::NoActiveHand);

    let now = Clock::get()?.unix_timestamp;
    require!(now > table.turn_deadline, HouseError::NotPlayerTurn);

    // Timed out player loses — other player gets the pot
    let loser_seat = table.current_turn;
    let pot = table.pot;

    if loser_seat == 1 {
        table.winner = 2;
        ctx.accounts.seat2_player.balance += pot;
        ctx.accounts.seat2_player.total_wins += 1;
        ctx.accounts.seat1_player.total_losses += 1;
    } else {
        table.winner = 1;
        ctx.accounts.seat1_player.balance += pot;
        ctx.accounts.seat1_player.total_wins += 1;
        ctx.accounts.seat2_player.total_losses += 1;
    }

    table.pot = 0;
    table.status = TableStatus::Settled;
    msg!("Seat {} timed out. Seat {} wins the pot.", loser_seat, table.winner);
    Ok(())
}

// ===== CONTEXTS =====

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct CreateTable<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,

    pub template: Account<'info, GameTemplate>,

    #[account(init, payer = authority, space = 8 + Table::INIT_SPACE, seeds = [TABLE_SEED, &id.to_le_bytes()], bump)]
    pub table: Account<'info, Table>,

    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct JoinTable<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,

    /// Seat 1's player account (to update stats on settlement)
    #[account(mut)]
    pub seat1_player: Account<'info, Player>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,

    #[account(mut)]
    pub table: Account<'info, Table>,

    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TableCallback<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    #[account(mut)]
    pub seat1_player: Account<'info, Player>,

    #[account(mut)]
    pub seat2_player: Account<'info, Player>,

    #[account(mut)]
    pub table: Account<'info, Table>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,
}

#[vrf]
#[derive(Accounts)]
pub struct TableAction<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(mut)]
    pub seat1_player: Account<'info, Player>,

    #[account(mut)]
    pub seat2_player: Account<'info, Player>,

    #[account(mut)]
    pub template: Account<'info, GameTemplate>,

    #[account(mut)]
    pub table: Account<'info, Table>,

    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TableTimeout<'info> {
    pub authority: Signer<'info>,

    #[account(mut)]
    pub seat1_player: Account<'info, Player>,

    #[account(mut)]
    pub seat2_player: Account<'info, Player>,

    #[account(mut)]
    pub table: Account<'info, Table>,
}
