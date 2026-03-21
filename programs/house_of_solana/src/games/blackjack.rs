use anchor_lang::prelude::*;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;
use crate::constants::*;
use crate::errors::HouseError;
use crate::state::*;

/// Start a new blackjack hand — requests VRF for initial 4 cards
pub fn handle_start_hand(ctx: Context<StartHand>, bet_amount: u64) -> Result<()> {
    require!(bet_amount >= MIN_BET, HouseError::BetTooSmall);
    require!(bet_amount <= MAX_BET, HouseError::BetTooLarge);

    let player = &mut ctx.accounts.player;
    require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

    let bj = &mut ctx.accounts.blackjack;
    require!(
        bj.status == BlackjackStatus::Idle || bj.status == BlackjackStatus::Settled,
        HouseError::HandInProgress
    );

    // Deduct bet
    player.balance -= bet_amount;
    player.total_bets += 1;
    player.total_wagered += bet_amount;

    // Reset blackjack state
    bj.player = ctx.accounts.authority.key();
    bj.player_cards = vec![];
    bj.dealer_cards = vec![];
    bj.bet_amount = bet_amount;
    bj.status = BlackjackStatus::Dealing;
    bj.result = BlackjackResult::None;

    // Request VRF for 4 initial cards
    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.authority.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::CallbackDeal::DISCRIMINATOR.to_vec(),
        caller_seed: [42; 32], // arbitrary seed
        accounts_metas: Some(vec![
            SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.blackjack.key(), is_signer: false, is_writable: true },
        ]),
        ..Default::default()
    });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

    msg!("Blackjack hand started, bet={}", bet_amount);
    Ok(())
}

/// VRF callback — deals initial 4 cards
pub fn handle_callback_deal(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
    let bj = &mut ctx.accounts.blackjack;
    require!(bj.status == BlackjackStatus::Dealing, HouseError::NoActiveHand);

    // Deal 4 cards from randomness bytes
    let p1 = card_from_random(randomness[0]);
    let d1 = card_from_random(randomness[1]);
    let p2 = card_from_random(randomness[2]);
    let d2 = card_from_random(randomness[3]); // hole card — hidden in TEE

    bj.player_cards = vec![p1, p2];
    bj.dealer_cards = vec![d1, d2];

    let player_val = hand_value(&bj.player_cards);
    let dealer_val = hand_value(&bj.dealer_cards);

    // Check natural blackjack
    if player_val == 21 && dealer_val == 21 {
        bj.status = BlackjackStatus::Settled;
        bj.result = BlackjackResult::Push;
        // Return bet (push)
        let player = &mut ctx.accounts.player;
        player.balance += bj.bet_amount;
        msg!("Both blackjack — Push!");
    } else if player_val == 21 {
        bj.status = BlackjackStatus::Settled;
        bj.result = BlackjackResult::Blackjack;
        // 2.5x payout for natural blackjack
        let payout = bj.bet_amount * 5 / 2;
        let player = &mut ctx.accounts.player;
        player.balance += payout;
        player.total_wins += 1;
        player.total_won += payout;
        msg!("BLACKJACK! Payout: {}", payout);
    } else if dealer_val == 21 {
        bj.status = BlackjackStatus::Settled;
        bj.result = BlackjackResult::DealerWin;
        let player = &mut ctx.accounts.player;
        player.total_losses += 1;
        msg!("Dealer blackjack. You lose.");
    } else {
        bj.status = BlackjackStatus::PlayerTurn;
        msg!("Cards dealt. Player: {} ({}), Dealer shows: {}", player_val, card_name(p1), card_name(d1));
    }

    Ok(())
}

/// Player hits — requests VRF for 1 card
pub fn handle_hit(ctx: Context<Hit>) -> Result<()> {
    let bj = &ctx.accounts.blackjack;
    require!(bj.status == BlackjackStatus::PlayerTurn, HouseError::NotPlayerTurn);
    require!(bj.player_cards.len() < MAX_CARDS, HouseError::HandFull);

    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.authority.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::CallbackHit::DISCRIMINATOR.to_vec(),
        caller_seed: [bj.player_cards.len() as u8; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.blackjack.key(), is_signer: false, is_writable: true },
        ]),
        ..Default::default()
    });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

    msg!("Hit requested");
    Ok(())
}

/// VRF callback for hit — adds card, checks bust
pub fn handle_callback_hit(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
    let bj = &mut ctx.accounts.blackjack;
    require!(bj.status == BlackjackStatus::PlayerTurn, HouseError::NotPlayerTurn);

    let new_card = card_from_random(randomness[0]);
    bj.player_cards.push(new_card);

    let player_val = hand_value(&bj.player_cards);
    msg!("Hit: {} (total: {})", card_name(new_card), player_val);

    if player_val > 21 {
        // Bust
        bj.status = BlackjackStatus::Settled;
        bj.result = BlackjackResult::PlayerBust;
        let player = &mut ctx.accounts.player;
        player.total_losses += 1;
        msg!("BUST! Player loses.");
    }
    // Otherwise still PlayerTurn

    Ok(())
}

/// Player stands — requests VRF for dealer draws
pub fn handle_stand(ctx: Context<Stand>) -> Result<()> {
    let bj = &mut ctx.accounts.blackjack;
    require!(bj.status == BlackjackStatus::PlayerTurn, HouseError::NotPlayerTurn);

    bj.status = BlackjackStatus::DealerTurn;

    let ix = create_request_randomness_ix(RequestRandomnessParams {
        payer: ctx.accounts.authority.key(),
        oracle_queue: ctx.accounts.oracle_queue.key(),
        callback_program_id: crate::ID,
        callback_discriminator: crate::instruction::CallbackStand::DISCRIMINATOR.to_vec(),
        caller_seed: [99; 32],
        accounts_metas: Some(vec![
            SerializableAccountMeta { pubkey: ctx.accounts.player.key(), is_signer: false, is_writable: true },
            SerializableAccountMeta { pubkey: ctx.accounts.blackjack.key(), is_signer: false, is_writable: true },
        ]),
        ..Default::default()
    });
    ctx.accounts.invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

    msg!("Stand — dealer's turn");
    Ok(())
}

/// VRF callback for stand — dealer draws until >= 17, then settle
pub fn handle_callback_stand(ctx: Context<CallbackBlackjack>, randomness: [u8; 32]) -> Result<()> {
    let bj = &mut ctx.accounts.blackjack;
    require!(bj.status == BlackjackStatus::DealerTurn, HouseError::NoActiveHand);

    // Dealer draws cards from randomness bytes until >= 17
    let mut rand_idx = 0;
    while hand_value(&bj.dealer_cards) < 17 && bj.dealer_cards.len() < MAX_CARDS && rand_idx < 28 {
        let new_card = card_from_random(randomness[rand_idx + 4]); // skip first 4 bytes
        bj.dealer_cards.push(new_card);
        rand_idx += 1;
    }

    let player_val = hand_value(&bj.player_cards);
    let dealer_val = hand_value(&bj.dealer_cards);

    msg!("Dealer: {} | Player: {}", dealer_val, player_val);

    let player = &mut ctx.accounts.player;

    if dealer_val > 21 {
        bj.result = BlackjackResult::DealerBust;
        let payout = bj.bet_amount * 2;
        player.balance += payout;
        player.total_wins += 1;
        player.total_won += payout;
        msg!("Dealer busts! Payout: {}", payout);
    } else if player_val > dealer_val {
        bj.result = BlackjackResult::PlayerWin;
        let payout = bj.bet_amount * 2;
        player.balance += payout;
        player.total_wins += 1;
        player.total_won += payout;
        msg!("Player wins! Payout: {}", payout);
    } else if dealer_val > player_val {
        bj.result = BlackjackResult::DealerWin;
        player.total_losses += 1;
        msg!("Dealer wins.");
    } else {
        bj.result = BlackjackResult::Push;
        player.balance += bj.bet_amount;
        msg!("Push — bet returned.");
    }

    bj.status = BlackjackStatus::Settled;
    Ok(())
}

// ===== CONTEXTS =====

#[vrf]
#[derive(Accounts)]
pub struct StartHand<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [BLACKJACK_SEED, authority.key().as_ref()], bump)]
    pub blackjack: Account<'info, BlackjackState>,
    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct Hit<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [BLACKJACK_SEED, authority.key().as_ref()], bump)]
    pub blackjack: Account<'info, BlackjackState>,
    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct Stand<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [PLAYER_SEED, authority.key().as_ref()], bump = player.bump, constraint = player.authority == authority.key() @ HouseError::Unauthorized)]
    pub player: Account<'info, Player>,
    #[account(mut, seeds = [BLACKJACK_SEED, authority.key().as_ref()], bump)]
    pub blackjack: Account<'info, BlackjackState>,
    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackBlackjack<'info> {
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,
    #[account(mut)]
    pub player: Account<'info, Player>,
    #[account(mut)]
    pub blackjack: Account<'info, BlackjackState>,
}
