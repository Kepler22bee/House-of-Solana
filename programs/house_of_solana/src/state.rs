use anchor_lang::prelude::*;
use crate::constants::MAX_CARDS;

// ===== COIN TOSS =====

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum CoinSide {
    Heads,
    Tails,
}

impl CoinSide {
    pub fn from_u8(val: u8) -> Option<Self> {
        match val {
            0 => Some(CoinSide::Heads),
            1 => Some(CoinSide::Tails),
            _ => None,
        }
    }

    pub fn to_u8(&self) -> u8 {
        match self {
            CoinSide::Heads => 0,
            CoinSide::Tails => 1,
        }
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum TossStatus {
    Idle,
    Pending,
    Settled,
}

// ===== BLACKJACK =====

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum BlackjackStatus {
    Idle,
    Dealing,
    PlayerTurn,
    DealerTurn,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug, InitSpace)]
pub enum BlackjackResult {
    None,
    PlayerWin,
    DealerWin,
    Push,
    Blackjack,
    PlayerBust,
    DealerBust,
}

// ===== ACCOUNTS =====

#[account]
#[derive(InitSpace)]
pub struct Player {
    pub authority: Pubkey,
    pub balance: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    pub total_bets: u32,
    pub total_wins: u32,
    pub total_losses: u32,
    pub total_wagered: u64,
    pub total_won: u64,
    pub initialized: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CoinToss {
    pub player: Pubkey,
    pub choice: u8,
    pub result: u8,
    pub bet_amount: u64,
    pub won: bool,
    pub status: TossStatus,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Vault {
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct BlackjackState {
    pub player: Pubkey,
    #[max_len(10)]
    pub player_cards: Vec<u8>,
    #[max_len(10)]
    pub dealer_cards: Vec<u8>,
    pub bet_amount: u64,
    pub status: BlackjackStatus,
    pub result: BlackjackResult,
    pub bump: u8,
}

// ===== BLACKJACK HELPERS =====

/// Calculate hand value with soft ace handling
pub fn hand_value(cards: &[u8]) -> u8 {
    let mut total: u16 = 0;
    let mut aces: u8 = 0;
    for &card in cards {
        if card == 0 { continue; }
        let rank = ((card - 1) % 13) + 1; // 1-13
        if rank == 1 {
            aces += 1;
            total += 11;
        } else if rank >= 10 {
            total += 10;
        } else {
            total += rank as u16;
        }
    }
    while total > 21 && aces > 0 {
        total -= 10;
        aces -= 1;
    }
    if total > 255 { 255 } else { total as u8 }
}

/// Derive a card (1-52) from a byte of randomness
pub fn card_from_random(byte: u8) -> u8 {
    (byte % 52) + 1 // 1-52
}

/// Get display string for a card
pub fn card_name(card: u8) -> &'static str {
    if card == 0 { return "?"; }
    let rank = ((card - 1) % 13) + 1;
    match rank {
        1 => "A",
        2 => "2",
        3 => "3",
        4 => "4",
        5 => "5",
        6 => "6",
        7 => "7",
        8 => "8",
        9 => "9",
        10 => "10",
        11 => "J",
        12 => "Q",
        13 => "K",
        _ => "?",
    }
}
