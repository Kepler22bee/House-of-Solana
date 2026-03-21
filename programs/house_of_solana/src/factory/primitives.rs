use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum Target {
    Player,
    Dealer,
    Shared,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum Visibility {
    Public,
    Hidden,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum CompareRule {
    HigherWins,
    LowerWins,
    ClosestTo { target_value: u8 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum Op {
    Gt,
    Lt,
    Eq,
    Gte,
    Lte,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum Condition {
    ValueGt { target: Target, value: u8 },
    ValueLt { target: Target, value: u8 },
    ValueEq { target: Target, value: u8 },
    CounterEq { id: u8, value: u8 },
    CounterGt { id: u8, value: u8 },
    ChoiceWas { choice_bit: u8 },
    SlotMatch { count: u8 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, InitSpace)]
pub enum GameAction {
    // === Randomness (needs VRF) ===
    DealCards { count: u8, to: Target, visibility: Visibility },
    RollDice { sides: u8, count: u8, to: Target },
    SpinSlots { reels: u8, symbols: u8 },
    RandomNumber { min: u8, max: u8, to: Target },

    // === Player interaction (pauses execution) ===
    AwaitChoice { options_mask: u16 },

    // === Comparison / Logic ===
    CompareHands { rule: CompareRule },
    CheckThreshold { target: Target, op: Op, value: u8 },
    CheckChoice { choice_bit: u8, jump_if_yes: u8, jump_if_no: u8 },
    Jump { step: u8 },

    // === Hand manipulation ===
    SumValues { target: Target },
    ApplyDrawRule { target: Target, hit_below: u8 },
    RevealHidden { target: Target },

    // === Settlement ===
    Payout { multiplier_bps: u16 },
    PayoutIf { condition: Condition, multiplier_bps: u16 },
    Lose,
    Push,
    StreakMultiplier { base_bps: u16, per_win_bps: u16 },

    // === State ===
    SetCounter { id: u8, value: u8 },
    IncrementCounter { id: u8 },
    ResetValues { target: Target },

    // === Multiplayer ===
    DealToSeat { seat: u8, count: u8, visibility: Visibility },
    AwaitTurn { seat: u8 },
    CompareSeats,
    PayoutSeat { seat: u8, multiplier_bps: u16 },
}

/// Choice bits for AwaitChoice options_mask
pub const CHOICE_HIT: u16 = 1 << 0;
pub const CHOICE_STAND: u16 = 1 << 1;
pub const CHOICE_FOLD: u16 = 1 << 2;
pub const CHOICE_RAISE: u16 = 1 << 3;
pub const CHOICE_CHECK: u16 = 1 << 4;
pub const CHOICE_HIGHER: u16 = 1 << 5;
pub const CHOICE_LOWER: u16 = 1 << 6;
pub const CHOICE_RED: u16 = 1 << 7;
pub const CHOICE_BLACK: u16 = 1 << 8;
pub const CHOICE_ODD: u16 = 1 << 9;
pub const CHOICE_EVEN: u16 = 1 << 10;
pub const CHOICE_SPLIT: u16 = 1 << 11;
pub const CHOICE_DOUBLE: u16 = 1 << 12;
