use anchor_lang::prelude::*;

#[error_code]
pub enum HouseError {
    #[msg("Player already initialized")]
    AlreadyInitialized,
    #[msg("Choice must be 0 (heads) or 1 (tails)")]
    InvalidChoice,
    #[msg("Bet amount below minimum")]
    BetTooSmall,
    #[msg("Bet amount above maximum")]
    BetTooLarge,
    #[msg("Insufficient balance for bet")]
    InsufficientBalance,
    #[msg("Coin toss already pending")]
    TossAlreadyPending,
    #[msg("No pending coin toss to settle")]
    NoPendingToss,
    #[msg("Coin toss already settled")]
    AlreadySettled,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Must deposit at least some SOL")]
    ZeroDeposit,
    #[msg("Insufficient chip balance to cash out")]
    InsufficientChips,
    #[msg("Vault has insufficient SOL for withdrawal")]
    VaultInsufficient,
    #[msg("Blackjack hand already in progress")]
    HandInProgress,
    #[msg("No active hand")]
    NoActiveHand,
    #[msg("Not player's turn")]
    NotPlayerTurn,
    #[msg("Hand is full (max cards reached)")]
    HandFull,
}
