use anchor_lang::prelude::*;
use super::primitives::GameAction;

// === HARD CAPS ===
// Agent level — limits what agents can create
pub const MAX_STEPS: usize = 16;      // max actions per game template
pub const MAX_VALUES: usize = 10;     // max cards/dice per hand
pub const MAX_COUNTERS: usize = 4;    // general purpose counters
pub const MAX_SEATS: u8 = 2;          // max players per table

// Program level — limits runtime execution
pub const MAX_ITERATIONS: u8 = 32;    // max steps executed per VRF callback
pub const MAX_VRF_BYTES: usize = 32;  // randomness bytes available per callback
pub const TURN_TIMEOUT_SECS: i64 = 30;

// Fees
pub const HOUSE_FEE_BPS: u16 = 500;   // 5% of volume

pub const TEMPLATE_SEED: &[u8] = b"template";
pub const SESSION_SEED: &[u8] = b"session";
pub const PROPOSAL_SEED: &[u8] = b"proposal";
pub const TABLE_SEED: &[u8] = b"table";
pub const CREATOR_VAULT_SEED: &[u8] = b"creator_vault";

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum SessionStatus {
    Active,
    WaitingForVrf,
    WaitingForChoice,
    Settled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum ProposalStatus {
    Pending,
    Accepted,
    Rejected,
    Countered,
}

#[account]
#[derive(InitSpace)]
pub struct GameTemplate {
    pub id: u64,
    pub creator: Pubkey,
    pub co_creator: Pubkey, // Pubkey::default() if solo
    pub name: [u8; 32],
    pub description: [u8; 128],
    #[max_len(16)]
    pub steps: Vec<GameAction>,
    pub min_bet: u64,
    pub max_bet: u64,
    pub creator_fee_bps: u16,
    pub total_plays: u64,
    pub total_volume: u64,
    pub active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GameSession {
    pub player: Pubkey,
    pub template: Pubkey,
    pub current_step: u8,
    pub bet_amount: u64,
    pub effective_bet: u64, // after house + creator fees
    pub last_choice: u8,
    #[max_len(16)]
    pub player_values: Vec<u8>,
    #[max_len(16)]
    pub dealer_values: Vec<u8>,
    #[max_len(16)]
    pub shared_values: Vec<u8>,
    pub counters: [u8; 4],
    pub status: SessionStatus,
    pub result_multiplier_bps: u16,
    pub streak: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GameProposal {
    pub id: u64,
    pub proposer: Pubkey,
    pub co_creator: Pubkey,
    pub name: [u8; 32],
    pub description: [u8; 128],
    #[max_len(16)]
    pub steps: Vec<GameAction>,
    pub min_bet: u64,
    pub max_bet: u64,
    pub creator_fee_bps: u16,
    pub fee_split_bps: u16, // % to proposer (10000 - this goes to co_creator)
    pub status: ProposalStatus,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CreatorFeeVault {
    pub template: Pubkey,
    pub creator: Pubkey,
    pub co_creator: Pubkey,
    pub fee_split_bps: u16,
    pub accumulated_fees: u64,
    pub creator_claimed: u64,
    pub co_creator_claimed: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum TableStatus {
    WaitingSeat,
    Active,
    WaitingVrf,
    WaitingTurn,
    Settled,
}

#[account]
#[derive(InitSpace)]
pub struct Table {
    pub id: u64,
    pub template: Pubkey,
    pub seat1: Pubkey,
    pub seat2: Pubkey,
    #[max_len(16)]
    pub seat1_values: Vec<u8>,
    #[max_len(16)]
    pub seat2_values: Vec<u8>,
    #[max_len(16)]
    pub shared_values: Vec<u8>,
    pub pot: u64,
    pub seat1_bet: u64,
    pub seat2_bet: u64,
    pub current_turn: u8,
    pub current_step: u8,
    pub last_choice: [u8; 2],
    pub status: TableStatus,
    pub winner: u8,
    pub turn_deadline: i64,
    pub bump: u8,
}
