use crate::state::card_from_random;
use super::primitives::*;
use super::state::*;

use super::state::MAX_ITERATIONS;

pub enum StepResult {
    Continue,
    NeedVrf,
    WaitingForChoice,
    Settled { multiplier_bps: u16 },
    Lost,
    Pushed,
}

/// Get the computed value (simple sum) for a target's values.
/// Uses plain sum — works for dice, random numbers, and card ranks.
/// For blackjack-style card scoring, use the hardcoded blackjack game instead.
fn target_value(session: &GameSession, target: &Target) -> u8 {
    let vals = match target {
        Target::Player => &session.player_values,
        Target::Dealer => &session.dealer_values,
        Target::Shared => &session.shared_values,
    };
    let mut sum: u16 = 0;
    for &v in vals {
        if v > 0 { sum += v as u16; }
    }
    if sum > 255 { 255 } else { sum as u8 }
}

fn get_values_mut<'a>(session: &'a mut GameSession, target: &Target) -> &'a mut Vec<u8> {
    match target {
        Target::Player => &mut session.player_values,
        Target::Dealer => &mut session.dealer_values,
        Target::Shared => &mut session.shared_values,
    }
}

fn eval_condition(session: &GameSession, condition: &Condition) -> bool {
    match condition {
        Condition::ValueGt { target, value } => target_value(session, target) > *value,
        Condition::ValueLt { target, value } => target_value(session, target) < *value,
        Condition::ValueEq { target, value } => target_value(session, target) == *value,
        Condition::CounterEq { id, value } => {
            let idx = *id as usize;
            idx < MAX_COUNTERS && session.counters[idx] == *value
        }
        Condition::CounterGt { id, value } => {
            let idx = *id as usize;
            idx < MAX_COUNTERS && session.counters[idx] > *value
        }
        Condition::ChoiceWas { choice_bit } => session.last_choice == *choice_bit,
        Condition::SlotMatch { count } => {
            // Count matching values in shared_values
            if session.shared_values.is_empty() { return false; }
            let first = session.shared_values[0];
            let matches = session.shared_values.iter().filter(|&&v| v == first).count();
            matches >= *count as usize
        }
    }
}

fn eval_op(lhs: u8, op: &Op, rhs: u8) -> bool {
    match op {
        Op::Gt => lhs > rhs,
        Op::Lt => lhs < rhs,
        Op::Eq => lhs == rhs,
        Op::Gte => lhs >= rhs,
        Op::Lte => lhs <= rhs,
    }
}

/// Execute steps from current_step until we need VRF, player choice, or settlement.
/// `randomness` is Some if we just got VRF back, None if starting fresh or after a choice.
pub fn execute_steps(
    session: &mut GameSession,
    steps: &[GameAction],
    randomness: Option<&[u8; 32]>,
) -> StepResult {
    let mut rand_idx: usize = 0;
    let mut iterations: u8 = 0;

    loop {
        if iterations >= MAX_ITERATIONS {
            return StepResult::Lost; // safety: too many iterations
        }
        iterations += 1;

        if session.current_step as usize >= steps.len() {
            return StepResult::Lost; // ran out of steps
        }

        let step = &steps[session.current_step as usize];

        match step {
            GameAction::DealCards { count, to, visibility: _ } => {
                let rand = match randomness {
                    Some(r) => r,
                    None => {
                        session.status = SessionStatus::WaitingForVrf;
                        return StepResult::NeedVrf;
                    }
                };
                let vals = get_values_mut(session, to);
                for _ in 0..*count {
                    if rand_idx >= 32 || vals.len() >= MAX_VALUES { break; }
                    vals.push(card_from_random(rand[rand_idx]));
                    rand_idx += 1;
                }
                session.current_step += 1;
            }

            GameAction::RollDice { sides, count, to } => {
                let rand = match randomness {
                    Some(r) => r,
                    None => {
                        session.status = SessionStatus::WaitingForVrf;
                        return StepResult::NeedVrf;
                    }
                };
                let vals = get_values_mut(session, to);
                for _ in 0..*count {
                    if rand_idx >= 32 || vals.len() >= MAX_VALUES { break; }
                    let die = (rand[rand_idx] % *sides) + 1;
                    vals.push(die);
                    rand_idx += 1;
                }
                session.current_step += 1;
            }

            GameAction::SpinSlots { reels, symbols } => {
                let rand = match randomness {
                    Some(r) => r,
                    None => {
                        session.status = SessionStatus::WaitingForVrf;
                        return StepResult::NeedVrf;
                    }
                };
                session.shared_values.clear();
                for _ in 0..*reels {
                    if rand_idx >= 32 { break; }
                    let sym = (rand[rand_idx] % *symbols) + 1;
                    session.shared_values.push(sym);
                    rand_idx += 1;
                }
                session.current_step += 1;
            }

            GameAction::RandomNumber { min, max, to } => {
                let rand = match randomness {
                    Some(r) => r,
                    None => {
                        session.status = SessionStatus::WaitingForVrf;
                        return StepResult::NeedVrf;
                    }
                };
                if rand_idx < 32 {
                    let range = (*max as u16) - (*min as u16) + 1;
                    let val = *min + (rand[rand_idx] % range as u8);
                    let vals = get_values_mut(session, to);
                    vals.push(val);
                    rand_idx += 1;
                }
                session.current_step += 1;
            }

            GameAction::AwaitChoice { options_mask: _ } => {
                session.status = SessionStatus::WaitingForChoice;
                return StepResult::WaitingForChoice;
            }

            GameAction::CompareHands { rule } => {
                let p = target_value(session, &Target::Player);
                let d = target_value(session, &Target::Dealer);
                let player_wins = match rule {
                    CompareRule::HigherWins => p > d,
                    CompareRule::LowerWins => p < d,
                    CompareRule::ClosestTo { target_value: t } => {
                        let p_dist = (*t as i16 - p as i16).unsigned_abs();
                        let d_dist = (*t as i16 - d as i16).unsigned_abs();
                        p_dist < d_dist
                    }
                };
                if p == d && matches!(rule, CompareRule::HigherWins | CompareRule::LowerWins) {
                    session.current_step += 1;
                    // Skip next step (payout), fall through to push/lose
                } else if player_wins {
                    session.current_step += 1; // go to payout
                } else {
                    session.current_step += 2; // skip payout, go to lose
                }
            }

            GameAction::CheckThreshold { target, op, value } => {
                let val = target_value(session, target);
                if eval_op(val, op, *value) {
                    session.current_step += 1; // condition true: execute next step
                } else {
                    session.current_step += 2; // condition false: skip next step
                }
            }

            GameAction::CheckChoice { choice_bit, jump_if_yes, jump_if_no } => {
                if session.last_choice == *choice_bit {
                    session.current_step = *jump_if_yes;
                } else {
                    session.current_step = *jump_if_no;
                }
            }

            GameAction::Jump { step } => {
                session.current_step = *step;
            }

            GameAction::SumValues { target } => {
                // Already computed dynamically via target_value()
                session.current_step += 1;
            }

            GameAction::ApplyDrawRule { target, hit_below } => {
                let rand = match randomness {
                    Some(r) => r,
                    None => {
                        session.status = SessionStatus::WaitingForVrf;
                        return StepResult::NeedVrf;
                    }
                };
                // Draw cards until value >= hit_below
                let mut safety = 0u8;
                loop {
                    let val = target_value(session, target);
                    if val >= *hit_below || safety >= 10 || rand_idx >= 32 { break; }
                    let card = card_from_random(rand[rand_idx]);
                    let vals = get_values_mut(session, target);
                    vals.push(card);
                    rand_idx += 1;
                    safety += 1;
                }
                session.current_step += 1;
            }

            GameAction::RevealHidden { target: _ } => {
                // In TEE context, this makes hidden values readable
                // On-chain this is a no-op (state is already there, just marked hidden)
                session.current_step += 1;
            }

            GameAction::Payout { multiplier_bps } => {
                session.result_multiplier_bps = *multiplier_bps;
                session.status = SessionStatus::Settled;
                return StepResult::Settled { multiplier_bps: *multiplier_bps };
            }

            GameAction::PayoutIf { condition, multiplier_bps } => {
                if eval_condition(session, condition) {
                    session.result_multiplier_bps = *multiplier_bps;
                    session.status = SessionStatus::Settled;
                    return StepResult::Settled { multiplier_bps: *multiplier_bps };
                }
                session.current_step += 1;
            }

            GameAction::Lose => {
                session.status = SessionStatus::Settled;
                return StepResult::Lost;
            }

            GameAction::Push => {
                session.status = SessionStatus::Settled;
                return StepResult::Pushed;
            }

            GameAction::StreakMultiplier { base_bps, per_win_bps } => {
                let total = *base_bps as u32 + (*per_win_bps as u32 * session.streak as u32);
                let capped = if total > 65535 { 65535u16 } else { total as u16 };
                session.result_multiplier_bps = capped;
                session.status = SessionStatus::Settled;
                return StepResult::Settled { multiplier_bps: capped };
            }

            GameAction::SetCounter { id, value } => {
                let idx = *id as usize;
                if idx < MAX_COUNTERS { session.counters[idx] = *value; }
                session.current_step += 1;
            }

            GameAction::IncrementCounter { id } => {
                let idx = *id as usize;
                if idx < MAX_COUNTERS { session.counters[idx] = session.counters[idx].saturating_add(1); }
                session.current_step += 1;
            }

            GameAction::ResetValues { target } => {
                get_values_mut(session, target).clear();
                session.current_step += 1;
            }

            // Multiplayer-only actions — skip in single-player executor
            GameAction::DealToSeat { .. }
            | GameAction::AwaitTurn { .. }
            | GameAction::CompareSeats
            | GameAction::PayoutSeat { .. } => {
                session.current_step += 1;
            }
        }
    }
}
