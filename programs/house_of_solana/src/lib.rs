use anchor_lang::prelude::*;
use anchor_lang::system_program;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::commit_and_undelegate_accounts;
use ephemeral_vrf_sdk::anchor::vrf;
use ephemeral_vrf_sdk::instructions::{create_request_randomness_ix, RequestRandomnessParams};
use ephemeral_vrf_sdk::types::SerializableAccountMeta;

declare_id!("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");

// ===== SEEDS =====
pub const PLAYER_SEED: &[u8] = b"player";
pub const COIN_TOSS_SEED: &[u8] = b"coin_toss";
pub const VAULT_SEED: &[u8] = b"vault";

// ===== CONSTANTS =====
pub const DEFAULT_BALANCE: u64 = 10_000;
pub const MIN_BET: u64 = 100;
pub const MAX_BET: u64 = 5_000;
/// 1 SOL = 10,000 chips (rate in lamports per chip)
pub const LAMPORTS_PER_CHIP: u64 = 100_000; // 0.0001 SOL per chip

// ===== ENUMS =====

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

// ===== ERRORS =====

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
}

// ===== PROGRAM =====

#[ephemeral]
#[program]
pub mod house_of_solana {
    use super::*;

    /// Initialize the vault (one-time setup)
    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.bump = ctx.bumps.vault;
        msg!("Vault initialized");
        Ok(())
    }

    /// Initialize a new player account with 10,000 free chips
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        require!(!player.initialized, HouseError::AlreadyInitialized);

        player.authority = ctx.accounts.authority.key();
        player.balance = DEFAULT_BALANCE;
        player.total_deposited = 0;
        player.total_withdrawn = 0;
        player.total_bets = 0;
        player.total_wins = 0;
        player.total_losses = 0;
        player.total_wagered = 0;
        player.total_won = 0;
        player.initialized = true;
        player.bump = ctx.bumps.player;

        msg!("Player initialized with {} chips", DEFAULT_BALANCE);
        Ok(())
    }

    /// Buy chips with SOL. SOL goes into a program vault PDA.
    /// Rate: 1 SOL = 10,000 chips
    pub fn buy_chips(ctx: Context<BuyChips>, lamports: u64) -> Result<()> {
        require!(lamports > 0, HouseError::ZeroDeposit);

        // Transfer SOL from player to vault
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            lamports,
        )?;

        let chips = lamports / LAMPORTS_PER_CHIP;
        let player = &mut ctx.accounts.player;
        player.balance += chips;
        player.total_deposited += lamports;

        msg!("Bought {} chips for {} lamports", chips, lamports);
        Ok(())
    }

    /// Cash out chips back to SOL. SOL comes from the vault PDA.
    /// Rate: 10,000 chips = 1 SOL
    pub fn cash_out(ctx: Context<CashOut>, chips: u64) -> Result<()> {
        require!(chips > 0, HouseError::ZeroDeposit);

        let player = &mut ctx.accounts.player;
        require!(player.balance >= chips, HouseError::InsufficientChips);

        let lamports = chips * LAMPORTS_PER_CHIP;
        let vault_info = ctx.accounts.vault.to_account_info();
        require!(vault_info.lamports() >= lamports, HouseError::VaultInsufficient);

        // Transfer SOL from vault to player (vault is program-owned PDA)
        **vault_info.try_borrow_mut_lamports()? -= lamports;
        **ctx.accounts.authority.to_account_info().try_borrow_mut_lamports()? += lamports;

        player.balance -= chips;
        player.total_withdrawn += lamports;

        msg!("Cashed out {} chips for {} lamports", chips, lamports);
        Ok(())
    }

    /// Place a coin toss bet and request VRF randomness
    pub fn flip_coin(ctx: Context<FlipCoin>, choice: u8, bet_amount: u64) -> Result<()> {
        let coin_side = CoinSide::from_u8(choice).ok_or(HouseError::InvalidChoice)?;
        require!(bet_amount >= MIN_BET, HouseError::BetTooSmall);
        require!(bet_amount <= MAX_BET, HouseError::BetTooLarge);

        let player = &mut ctx.accounts.player;
        require!(player.balance >= bet_amount, HouseError::InsufficientBalance);

        let coin_toss = &mut ctx.accounts.coin_toss;
        require!(
            coin_toss.status != TossStatus::Pending,
            HouseError::TossAlreadyPending
        );

        // Deduct bet from balance
        player.balance -= bet_amount;
        player.total_bets += 1;
        player.total_wagered += bet_amount;

        // Set up coin toss state
        coin_toss.player = ctx.accounts.authority.key();
        coin_toss.choice = coin_side.to_u8();
        coin_toss.bet_amount = bet_amount;
        coin_toss.won = false;
        coin_toss.status = TossStatus::Pending;

        // Request VRF randomness — oracle will callback with result
        let ix = create_request_randomness_ix(RequestRandomnessParams {
            payer: ctx.accounts.authority.key(),
            oracle_queue: ctx.accounts.oracle_queue.key(),
            callback_program_id: crate::ID,
            callback_discriminator: instruction::CallbackFlipCoin::DISCRIMINATOR.to_vec(),
            caller_seed: [choice; 32],
            accounts_metas: Some(vec![
                SerializableAccountMeta {
                    pubkey: ctx.accounts.player.key(),
                    is_signer: false,
                    is_writable: true,
                },
                SerializableAccountMeta {
                    pubkey: ctx.accounts.coin_toss.key(),
                    is_signer: false,
                    is_writable: true,
                },
            ]),
            ..Default::default()
        });
        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.authority.to_account_info(), &ix)?;

        msg!(
            "Coin toss placed: {} on {:?}, bet={}",
            ctx.accounts.authority.key(),
            coin_side,
            bet_amount
        );
        Ok(())
    }

    /// VRF callback — oracle calls this with randomness to settle the coin toss
    pub fn callback_flip_coin(
        ctx: Context<CallbackFlipCoin>,
        randomness: [u8; 32],
    ) -> Result<()> {
        let coin_toss = &mut ctx.accounts.coin_toss;
        require!(
            coin_toss.status == TossStatus::Pending,
            HouseError::NoPendingToss
        );

        // Derive result from VRF randomness: 0 = heads, 1 = tails
        let result = ephemeral_vrf_sdk::rnd::random_u8_with_range(&randomness, 0, 1);
        coin_toss.result = result;
        coin_toss.won = coin_toss.choice == result;
        coin_toss.status = TossStatus::Settled;

        // Update player balance and stats
        let player = &mut ctx.accounts.player;
        if coin_toss.won {
            // 2x payout
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

    // ===== EPHEMERAL ROLLUP DELEGATION =====

    /// Delegate player account to TEE ephemeral rollup
    pub fn delegate_player(ctx: Context<DelegatePda>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[PLAYER_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        msg!("Player delegated to TEE ER");
        Ok(())
    }

    /// Delegate coin toss account to TEE ephemeral rollup
    pub fn delegate_coin_toss(ctx: Context<DelegatePda>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[COIN_TOSS_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        msg!("Coin toss delegated to TEE ER");
        Ok(())
    }

    /// Commit player state from ER to base chain
    pub fn commit_player(ctx: Context<CommitPda>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.pda.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Player committed and undelegated");
        Ok(())
    }

    /// Commit coin toss state from ER to base chain
    pub fn commit_coin_toss(ctx: Context<CommitPda>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.pda.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Coin toss committed and undelegated");
        Ok(())
    }
}

// ===== INSTRUCTION CONTEXTS =====

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Player::INIT_SPACE,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump,
    )]
    pub player: Account<'info, Player>,

    #[account(
        init,
        payer = authority,
        space = 8 + CoinToss::INIT_SPACE,
        seeds = [COIN_TOSS_SEED, authority.key().as_ref()],
        bump,
    )]
    pub coin_toss: Account<'info, CoinToss>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyChips<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == authority.key() @ HouseError::Unauthorized,
    )]
    pub player: Account<'info, Player>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CashOut<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == authority.key() @ HouseError::Unauthorized,
    )]
    pub player: Account<'info, Player>,

    #[account(
        mut,
        seeds = [VAULT_SEED],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct FlipCoin<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump = player.bump,
        constraint = player.authority == authority.key() @ HouseError::Unauthorized,
    )]
    pub player: Account<'info, Player>,

    #[account(
        mut,
        seeds = [COIN_TOSS_SEED, authority.key().as_ref()],
        bump,
    )]
    pub coin_toss: Account<'info, CoinToss>,

    /// CHECK: VRF oracle queue
    #[account(mut, address = ephemeral_vrf_sdk::consts::DEFAULT_QUEUE)]
    pub oracle_queue: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CallbackFlipCoin<'info> {
    /// VRF program identity — enforces only the oracle can call this
    #[account(address = ephemeral_vrf_sdk::consts::VRF_PROGRAM_IDENTITY)]
    pub vrf_program_identity: Signer<'info>,

    #[account(mut)]
    pub player: Account<'info, Player>,

    #[account(mut)]
    pub coin_toss: Account<'info, CoinToss>,
}

// ===== EPHEMERAL ROLLUP CONTEXTS =====

#[delegate]
#[derive(Accounts)]
pub struct DelegatePda<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitPda<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The PDA to commit/undelegate
    #[account(mut)]
    pub pda: AccountInfo<'info>,
}
