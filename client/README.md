# House of Solana

A top-down pixel art casino RPG on Solana, powered by MagicBlock Ephemeral Rollups.

## Overview

House of Solana is a fully on-chain casino game featuring coin toss, price prediction, and an AI companion — all running on Solana with MagicBlock Ephemeral Rollups for gasless, low-latency gameplay.

## Tech Stack

- **Frontend**: Next.js, TypeScript, Canvas-based 2D game engine
- **Blockchain**: Solana + MagicBlock Ephemeral Rollups
- **Oracle**: Pyth Network (price feeds)
- **AI**: Local LLM integration for in-game companion

## Getting Started

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play.

## Project Structure

```
House-of-Solana/
├── cairo-contracts/     # Original Cairo game logic (reference)
│   ├── game/            # Player models, actions, movement
│   └── casino/          # Coin toss, VRF, event relayer
└── client/              # Next.js game frontend
    ├── src/game/        # 2D game engine (renderer, player, maps, tiles)
    └── src/games/       # Casino games (coin-toss, price-prediction)
```

## Links

- [Solana Docs](https://solana.com/docs)
- [MagicBlock Docs](https://docs.magicblock.gg/)
- [Pyth Network](https://pyth.network/)
