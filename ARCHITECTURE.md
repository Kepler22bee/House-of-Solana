# House of Solana — Architecture

> A fully on-chain casino RPG on Solana with AI agents, MagicBlock Private Ephemeral Rollups, and a composable game factory where agents create new games.

**Program ID**: `8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg` (devnet)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PLAYERS                                     │
│                                                                      │
│  Player's AI Agent ◄──── Any AI (LLM, bot, script)                 │
│         │                                                            │
│    session keypair                                                   │
│         │                                                            │
│  Clanker (House AI) ◄── Embedded AI companion                      │
│         │                                                            │
│    own keypair                                                       │
└────┬────┴────────────────────────────────────────────────────────────┘
     │
     │  TEE Auth Token (verifyTeeRpcIntegrity + getAuthToken)
     │
┌────▼────────────────────────────────────────────────────────────────┐
│              MAGICBLOCK PRIVATE EPHEMERAL ROLLUP (TEE)              │
│                                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐   │
│  │ Player PDA  │  │ CoinToss    │  │ BlackjackState           │   │
│  │ (balance,   │  │ (choice,    │  │ (player_cards,           │   │
│  │  stats)     │  │  result,    │  │  dealer_cards [HIDDEN],  │   │
│  │             │  │  hidden     │  │  bet, status)            │   │
│  │             │  │  in TEE)    │  │                          │   │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    GAME FACTORY                              │   │
│  │                                                              │   │
│  │  GameTemplate ──► Executor ──► GameSession / Table          │   │
│  │  (agent-authored    (runs steps     (per-player or          │   │
│  │   game rules)       with VRF)       multiplayer state)      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Privacy: Intel TDX ─ accounts encrypted, only authed players read  │
│  Permission Program: BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi │
│  VRF: ephemeral_vrf_sdk ─ Cuj97ggrh... (oracle queue)              │
│  TEE Validator: FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA      │
└────┬────────────────────────────────────────────────────────────────┘
     │
     │  delegate / commit+undelegate
     │
┌────▼────────────────────────────────────────────────────────────────┐
│                    SOLANA BASE CHAIN (devnet)                        │
│                                                                      │
│  Player account ─── Vault (SOL escrow) ─── GameTemplates           │
│  Final settled state committed back from TEE                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Contract Structure

```
programs/house_of_solana/src/
├── lib.rs                          Program entry — all instruction routing
├── constants.rs                    Seeds, bet limits, chip rate
├── errors.rs                       HouseError enum
├── state.rs                        Core accounts (Player, CoinToss, BlackjackState, Vault)
│
├── games/                          Hardcoded games (optimized, battle-tested)
│   ├── coin_toss.rs                flip_coin + VRF callback
│   └── blackjack.rs                start_hand, hit, stand + VRF callbacks
│
├── instructions/                   Core infrastructure
│   ├── init.rs                     initialize_vault, initialize_player, setup_permissions
│   ├── chips.rs                    buy_chips (SOL→chips), cash_out (chips→SOL)
│   └── delegation.rs              delegate/commit for all account types
│
└── factory/                        Agent-authored game engine
    ├── primitives.rs               20+ GameAction variants (the building blocks)
    ├── state.rs                    GameTemplate, GameSession, Table, GameProposal
    ├── executor.rs                 Step-by-step game engine (single-player)
    ├── templates.rs                create_template, deactivate_template
    ├── gameplay.rs                 start_game, callback_game, player_choice
    ├── negotiation.rs              propose_game, accept_proposal, reject_proposal
    └── multiplayer.rs              create_table, join_table, table_action, table_callback, table_timeout
```

---

## Core Accounts

### Player
```
seeds: ["player", authority]
```
| Field | Type | Description |
|-------|------|-------------|
| authority | Pubkey | Wallet owner |
| balance | u64 | Chip balance |
| total_deposited | u64 | Lifetime SOL deposited (lamports) |
| total_withdrawn | u64 | Lifetime SOL withdrawn (lamports) |
| total_bets | u32 | Lifetime bet count |
| total_wins / total_losses | u32 | Win/loss record |
| total_wagered / total_won | u64 | Volume stats |

### Vault
```
seeds: ["vault"]
```
Program-owned PDA holding deposited SOL. Rate: **1 SOL = 10,000 chips**.

---

## Games

### 1. Coin Toss (hardcoded)

```
flip_coin(choice, bet_amount)
    → deducts bet
    → requests VRF
    → callback_flip_coin(randomness)
        → 0 or 1 → heads/tails
        → win: 2x payout
        → lose: house keeps bet
```

**Privacy**: CoinToss account permissioned via Permission Program. During pending phase, only the player (via TEE auth) can see their choice. Prevents front-running.

### 2. Blackjack (hardcoded)

```
start_hand(bet) → VRF deals 4 cards → callback_deal
    → natural 21? settle immediately
    → else: PlayerTurn

hit() → VRF deals 1 card → callback_hit
    → bust (>21)? auto-lose
    → else: still PlayerTurn

stand() → VRF for dealer → callback_stand
    → dealer draws until ≥17
    → compare hands → settle
```

**Privacy**: Dealer's hole card stored in TEE. Player can't see it until stand/bust. On settlement, full state committed to base chain.

**Payouts**: Win = 2x, Blackjack = 2.5x, Push = bet returned.

### 3. Factory Games (agent-authored)

Agents compose games from primitives — no code deployment needed.

---

## Game Factory

### Primitives (building blocks)

| Category | Actions |
|----------|---------|
| **Randomness** | `DealCards`, `RollDice`, `SpinSlots`, `RandomNumber` |
| **Player Input** | `AwaitChoice` (bitmask: hit/stand/fold/raise/higher/lower/red/black...) |
| **Logic** | `CompareHands`, `CheckThreshold`, `CheckChoice`, `Jump` |
| **Hand Ops** | `SumValues`, `ApplyDrawRule`, `RevealHidden` |
| **Settlement** | `Payout(multiplier)`, `PayoutIf(condition)`, `Lose`, `Push`, `StreakMultiplier` |
| **State** | `SetCounter`, `IncrementCounter`, `ResetValues` |
| **Multiplayer** | `DealToSeat`, `AwaitTurn`, `CompareSeats`, `PayoutSeat` |

### Casino games expressible

| Game | Key primitives |
|------|---------------|
| **Coin Toss** | RandomNumber → PayoutIf → Lose |
| **Roulette** | RandomNumber(0,36) → AwaitChoice(red/black) → PayoutIf |
| **Blackjack** | DealCards → AwaitChoice(hit/stand) → ApplyDrawRule → CompareHands |
| **Baccarat** | DealCards → ApplyDrawRule(6) → ApplyDrawRule(7) → CompareHands(ClosestTo 9) |
| **Dice/Craps** | RollDice(6,2) → SumValues → CheckThreshold → Payout |
| **Slots** | SpinSlots(3,6) → PayoutIf(SlotMatch 3) → PayoutIf(SlotMatch 2) → Lose |
| **War** | DealToSeat(1) → DealToSeat(2) → CompareSeats → PayoutSeat |
| **Hi-Lo** | DealCards → AwaitChoice(higher/lower) → DealCards → StreakMultiplier |
| **Poker** | DealToSeat(hidden) → DealCards(shared) → AwaitTurn → CompareSeats(PokerRank) |

### Execution flow

```
start_game(template, bet)
    │
    ├─► executor runs steps sequentially
    │
    ├─► hits DealCards/RollDice? → pause, request VRF
    │       └─► callback_game(randomness) → continue execution
    │
    ├─► hits AwaitChoice? → pause, wait for player
    │       └─► player_choice(bit) → continue execution
    │
    ├─► hits AwaitTurn? → pause, wait for specific seat
    │       └─► table_action(bit) → continue execution
    │
    └─► hits Payout/Lose/Push? → settle, update balances
```

### Hard Caps

| Limit | Value | Level |
|-------|-------|-------|
| Max steps per template | **16** | Agent |
| Max cards/dice per hand | **10** | Agent |
| Max counters | **4** | Agent |
| Max seats per table | **2** | Agent |
| Max creator fee | **20%** | Agent |
| Max iterations per callback | **32** | Program |
| Turn timeout | **30 seconds** | Program |
| House fee | **5%** of volume | Program (non-negotiable) |

---

## Agent Negotiation (Hybrid)

Two AI agents collaborate to create a game:

```
1. Off-chain: Agents chat, agree on rules
   "3 dice, sum > 12 = 2x, sum > 16 = 5x"
   "Deal. 2% creator fee, split 50/50."

2. Agent A: propose_game(steps, co_creator=B, fee, split)
   → GameProposal account on-chain (status: Pending)

3. Agent B: accept_proposal(id)
   → GameTemplate created, both recorded as co-creators

4. Players play → creators earn fees
   → claim_fees() splits by fee_split_bps
```

---

## Multiplayer Tables

```
Player's AI                              Clanker AI
     │                                        │
     ├── create_table(template, bet) ──────► Table PDA created
     │                                        │
     │                     join_table() ◄─────┤
     │                                        │
     │       ◄──── VRF deals cards ────►      │
     │                                        │
     ├── table_action(CHECK) ──────────►      │  (seat 1's turn)
     │                                        │
     │       ◄────────── table_action(CHECK)──┤  (seat 2's turn)
     │                                        │
     │       ◄──── VRF settles game ────►     │
     │                                        │
     │     Winner gets pot (minus 5% house)   │
```

**Privacy**: Each seat's cards (`seat1_values`, `seat2_values`) are hidden in the TEE. Each AI authenticates with their own TEE token and can only read their own values + shared community cards.

**Timeout**: If a player doesn't act within 30 seconds, anyone can call `table_timeout()` → AFK player auto-loses.

---

## Fee Model

On every bet:
```
bet_amount
    ├── 5% → House Vault (non-negotiable)
    ├── creator_fee_bps% → Creator Fee Vault (set by template creators)
    └── remainder → effective bet (used for payout calculation)

Example: 1000 chip bet, 2% creator fee
    House:   50 chips (5%)
    Creator: 20 chips (2%)
    Effective: 930 chips
    Win (2x): player gets 1860
    Lose: player gets 0
```

---

## Private Ephemeral Rollup Integration

### Why Private ERs

| Feature | What it enables |
|---------|----------------|
| **TEE encryption** | Dealer's hole card, opponent's hand — genuinely hidden |
| **Permission Program** | Only the account owner can read their data |
| **TEE auth tokens** | 401 Unauthorized without valid JWT |
| **Delegation** | Accounts move to TEE for gameplay, commit back on settlement |

### Flow

```
1. initialize_player → create accounts on base chain
2. setup_permissions → create Group + Permission for CoinToss/Blackjack
3. delegate_player / delegate_coin_toss → move to TEE ER
4. flip_coin / start_hand → execute inside TEE (state hidden)
5. VRF callback → settle inside TEE
6. commit_player / commit_coin_toss → state back on base chain
```

### Auth

```typescript
const verified = await verifyTeeRpcIntegrity("https://tee.magicblock.app");
const token = await getAuthToken(url, publicKey, signFn);
const connection = new Connection(`https://tee.magicblock.app?token=${token}`);
// Without token: 401 Unauthorized
// With token: reads/writes succeed
```

---

## Frontend

```
client/src/
├── app/game/page.tsx           Game page with wallet connect
├── game/GameCanvas.tsx         2D canvas game engine (overworld + casino)
├── games/
│   ├── coin-toss/              Coin toss UI overlay
│   ├── blackjack/              (planned) Blackjack UI overlay
│   └── price-prediction/       Pyth-powered price prediction (client-only)
└── lib/
    ├── solana.ts               Solana integration (TEE auth, delegation, all calls)
    ├── txlog.ts                Transaction log store
    └── casino-idl.json         Program IDL
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana (devnet) |
| Smart Contract | Anchor 0.32.1 |
| Privacy | MagicBlock Private Ephemeral Rollups (Intel TDX TEE) |
| Randomness | MagicBlock VRF (`ephemeral_vrf_sdk`) |
| Access Control | MagicBlock Permission Program |
| Oracle | Pyth Network (price feeds for prediction game) |
| Frontend | Next.js, TypeScript, Canvas 2D engine |
| AI | Local LLM (Gemma 3 4B) via Ollama for Clanker companion |

---

## Deployed

| Item | Address |
|------|---------|
| Program | `8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg` |
| Vault | `E9fjsjPmnEUNjPhFvBqe69a2RjNucrDq8LKJP2guPsgT` |
| VRF Oracle Queue | `Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh` |
| TEE Validator | `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA` |
| Permission Program | `BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi` |
| Delegation Program | `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh` |
