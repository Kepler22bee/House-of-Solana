use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::*;
use crate::errors::HouseError;
use crate::state::*;

pub fn handle_flip_coin(ctx: Context<FlipCoin>, choice: u8, bet_amount: u64) -> Result<()> {
    let coin_side = CoinSide::from_u8(choice).ok_or(HouseError::InvalidChoice)?;
    require!(bet_amount >= MIN_BET, HouseError::BetTooSmall);
    require!(bet_amount <= MAX_BET, HouseError::BetTooLarge);

    let player = &mut ctx.accounts.player;
    require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

    let coin_toss = &mut ctx.accounts.coin_toss;
    require!(coin_toss.status != TossStatus::Pending, HouseError::TossAlreadyPending);

    player.balance -= bet_amount;
    player.total_bets += 1;
    player.total_wagered += bet_amount;

    coin_toss.player = ctx.accounts.authority.key();
    coin_toss.choice = coin_side.to_u8();
    coin_toss.bet_amount = bet_amount;
    coin_toss.won = false;
    coin_toss.status = TossStatus::Pending;

    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.authority.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::CallbackFlipCoin::DISCRIMINATOR.to_vec(),
        caller_seed: [choice; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.coin_toss.key(), is_signer: false, is_writable: true },
        ]),
        ..Default::default()
    });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

    msg!("Coin toss placed: {} on {:?}, bet={}", ctx.accounts.authority.key(), coin_side, bet_amount);
    Ok(())
}

pub fn handle_callback_flip_coin(ctx: Context<CallbackFlipCoin>, randomness: [u8; 32]) -> Result<()> {
    let coin_toss = &mut ctx.accounts.coin_toss;
    require!(coin_toss.status == TossStatus::Pending, HouseError::NoPendingToss);

    let result = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 0, 1);
    coin_toss.result = result;
    coin_toss.won = coin_toss.choice == result;
    coin_toss.status = TossStatus::Settled;

    let player = &mut ctx.accounts.player;
    if coin_toss.won {
        let payout = coin_toss.bet_amount * 2;
        player.balance += payout;
        player.total_wins += 1;
        player.total_won += payout;
        msg!("Coin toss WON! Payout: {}", payout);
    } else {
        player.total_losses += 1;
        msg!("Coin toss LOST. House keeps the bet.");
    }
    Ok(())
}

// ===== CONTEXTS =====

#[vrf]
#[derive(Accounts)]
pub struct FlipCoin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [COIN_TOSS_SEED, authority.key().as_ref()], bump)]
    pub coin_toss: Account<'info, CoinToss>,
    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackFlipCoin<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub coin_toss: Account<'info, CoinToss>,
}
