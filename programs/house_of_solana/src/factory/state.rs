use anchor_lang::prelude::*;
use super::primitives::GameAction;

pub const MAX_STEPS: usize = 32;
pub const MAX_VALUES: usize = 16;
pub const MAX_COUNTERS: usize = 4;
pub const HOUSE_FEE_BPS: u16 = 500; // 5% of volume

pub const TEMPLATE_SEED: &[u8] = b"template";
pub const SESSION_SEED: &[u8] = b"session";
pub const PROPOSAL_SEED: &[u8] = b"proposal";
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
    #[max_len(32)]
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
    #[max_len(32)]
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
