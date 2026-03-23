# 🏠 House of Solana

**An on-chain casino RPG where AI agents design, negotiate, and play casino games — powered by MagicBlock Private Ephemeral Rollups.**

> Built for MagicBlock Blitz 2 — Privacy Hackathon

![Solana](https://img.shields.io/badge/Solana-Devnet-blue)
![MagicBlock](https://img.shields.io/badge/MagicBlock-Private%20ER-cyan)
![VRF](https://img.shields.io/badge/Randomness-MagicBlock%20VRF-green)

---

## What is this?

House of Solana is a top-down pixel art casino where two AI agents — **Clanker** (the house, Qwen 235B) and **T800** (the player, Llama 8B) — negotiate game rules in real-time, deploy them on-chain, and play them. All games run inside MagicBlock's Private Ephemeral Rollups with Intel TDX TEE encryption, hiding dealer cards and preventing front-running.

### The twist: AI agents create the games

Instead of hardcoded casino games, we built a **composable game factory** — 20+ on-chain primitives (dice, cards, slots, thresholds, payouts) that agents compose into new games without redeploying the program. Two AIs negotiate the rules, agree on odds, and deploy. Players choose a strategy (🔥 Greedy or 🛡️ Safu), and their AI plays accordingly.

---

## Features

| Feature | Description |
|---------|-------------|
| **🎰 Coin Toss** | Heads or tails, 2x payout, MagicBlock VRF randomness |
| **♠ Blackjack** | Full on-chain blackjack with hidden dealer hole card via TEE |
| **🤖 Agent Forge** | Two AIs negotiate and create new casino games on-chain |
| **⚔️ Multiplayer Tables** | AI vs AI at shared tables with hidden hands |
| **🔒 Private ERs** | Intel TDX TEE hides game state, Permission Program restricts reads |
| **💰 Chip System** | Buy chips with SOL (1 SOL = 10,000 chips), cash out anytime |
| **🤝 Agent Negotiation** | On-chain proposals — Agent A proposes, Agent B accepts/rejects |
| **🏦 House Fee** | 5% of all volume, non-negotiable |

---

## How Agent Forge Works

```
1. Player picks game type (Dice/Cards/Slots) + strategy (Greedy/Safu)

2. Clanker (house AI) proposes rules:
   "Roll 2 dice. Hit 11+ for 3x. House keeps the rest."

3. T800 (player AI) counters:
   "3x is weak. Make 12 pay 5x. I'll take the odds."

4. They negotiate 3 rounds, reach a DEAL

5. Game template deployed on Solana → playable by anyone

6. T800 auto-plays the game it helped design
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              AI AGENTS                       │
│  Clanker (Qwen 235B) ←→ T800 (Llama 8B)   │
│          negotiate game rules                │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│        PRIVATE EPHEMERAL ROLLUP (TEE)        │
│                                              │
│  Player accounts ─ Game state (encrypted)    │
│  Dealer cards HIDDEN ─ VRF randomness        │
│  Permission Program ─ TEE auth tokens        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│           SOLANA BASE CHAIN                  │
│                                              │
│  Program: 8NjeMQCn3oVC3...eVBg              │
│  Vault (SOL escrow) ─ Game Templates         │
│  Final settled state committed back          │
└─────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Solana (devnet) |
| Smart Contract | Anchor 0.32.1 |
| Privacy | MagicBlock Private Ephemeral Rollups (Intel TDX TEE) |
| Randomness | MagicBlock VRF (`ephemeral-vrf-sdk`) |
| Access Control | MagicBlock Permission Program |
| Frontend | Next.js 16, TypeScript, Canvas 2D pixel art engine |
| AI (House) | Cerebras — Qwen 3 235B |
| AI (Player) | Cerebras — Llama 3.1 8B |

---

## Contract Structure

```
programs/house_of_solana/src/
├── lib.rs                    # Program entry
├── state.rs                  # Player, CoinToss, BlackjackState, Vault
├── games/
│   ├── coin_toss.rs          # Coin flip with VRF
│   └── blackjack.rs          # Full blackjack with hidden dealer cards
├── factory/
│   ├── primitives.rs         # 20+ composable game actions
│   ├── executor.rs           # Step-by-step game engine
│   ├── templates.rs          # Create/deactivate game templates
│   ├── gameplay.rs           # Play factory games (VRF + choices)
│   ├── negotiation.rs        # Agent proposal/accept/reject
│   └── multiplayer.rs        # AI vs AI tables with hidden hands
└── instructions/
    ├── init.rs               # Initialize vault, player, permissions
    ├── chips.rs              # Buy/cash out (SOL ↔ chips)
    └── delegation.rs         # Delegate/commit to Private ER
```

---

## Composable Game Primitives

Agents compose these to create any casino game:

| Category | Primitives |
|----------|-----------|
| Randomness | `DealCards`, `RollDice`, `SpinSlots`, `RandomNumber` |
| Player Input | `AwaitChoice`, `AwaitTurn` |
| Logic | `CompareHands`, `CheckThreshold`, `CheckChoice`, `Jump` |
| Settlement | `Payout`, `PayoutIf`, `Lose`, `Push`, `StreakMultiplier` |
| Multiplayer | `DealToSeat`, `CompareSeats`, `PayoutSeat` |

**Games expressible**: Coin toss, blackjack, roulette, craps, baccarat, slots, war, hi-lo, poker

---

## Getting Started

```bash
# Frontend
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

```bash
# Set environment (create client/.env.local)
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_TEE_URL=https://tee.magicblock.app
AI_CHAT_URL=https://api.cerebras.ai/v1/chat/completions
AI_CHAT_KEY=your-cerebras-key
```

```bash
# Build & deploy contract
anchor build
anchor deploy --provider.cluster devnet
```

---

## Deployed

| Item | Address |
|------|---------|
| Program | `8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg` |
| VRF Oracle | `Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh` |
| TEE Validator | `FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA` |
| Permission Program | `BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi` |

---

## Why Private ERs?

| Without TEE | With Private ER |
|-------------|----------------|
| Dealer's hole card visible to everyone | Encrypted in Intel TDX — only player sees their own cards |
| Player's coin toss choice can be front-run | Choice hidden until VRF settles |
| Anyone can read game state | 401 Unauthorized without TEE auth token |
| Agent game negotiations public | Negotiation state private during rounds |

---

## License

MIT
