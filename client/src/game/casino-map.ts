import { TileType as T, TILE_SIZE } from "./tiles";
import { NPC } from "./map";

// Shorthand aliases
const cc = T.CASINO_CARPET;
const ct = T.CASINO_TABLE;
const sm = T.SLOT_MACHINE;
const cb = T.CASINO_BAR;
const cs = T.CASINO_STOOL;
const ce = T.CASINO_EXIT;
const cr = T.CASINO_RUG;
const co = T.CASINO_COLUMN;
const ck = T.CASINO_CHIP_RACK;
const cv = T.CASINO_VELVET;
const cw = T.CASINO_WALL;
const ln = T.LANTERN;
const np = T.NEON_PINK;
const nb = T.NEON_BLUE;

export const CASINO_MAP_WIDTH = 60;
export const CASINO_MAP_HEIGHT = 40;

// 60x40 casino interior — matches overworld dimensions for fullscreen
export const casinoMap: number[][] = [
// Row 0 — top wall
  [ cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw, cw, np, cw, cw, cw, cw, cw, cw, cw ],
// Row 1 — back wall with bar sections
  [ cw, cw, np, cw, cb, cb, cb, cb, cb, cb, cb, cw, cw, ln, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ln, cw, cw, cb, cb, cb, cb, cb, cb, cb, cw, nb, cw, cw ],
// Row 2 — bar stools
  [ cw, ln, cc, cc, cs, cc, cs, cc, cs, cc, cs, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cs, cc, cs, cc, cs, cc, cs, cc, cc, ln, cw ],
// Row 3 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 4 — cashier + columns
  [ cw, cc, ck, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, ck, cc, cw ],
// Row 5 — slot machines row
  [ np, cc, cc, cc, sm, cc, sm, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, sm, cc, sm, cc, cc, cc, nb ],
// Row 6 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 7 — rug top border (left section + right section)
  [ cw, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cw ],
// Row 8 — COIN TOSS tables (left) + PRICE PREDICTION tables (right)
  [ cw, cc, cc, ct, ct, cc, cc, cr, cc, cc, cc, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, cc, cc, cc, cr, cc, cc, ct, ct, cc, cc, cw ],
// Row 9 — tables + center rug with lanterns
  [ cw, cc, cc, ct, ct, cc, cc, cr, cc, cc, ln, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, ln, cc, cc, cr, cc, cc, ct, ct, cc, cc, cw ],
// Row 10 — tables
  [ cw, cc, cc, ct, ct, cc, cc, cr, cc, cc, cc, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, cc, cc, cc, cr, cc, cc, ct, ct, cc, cc, cw ],
// Row 11 — rug bottom border
  [ cw, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cw ],
// Row 12 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 13 — columns + slot machines
  [ np, cc, cc, sm, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, sm, cc, cc, nb ],
// Row 14 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 15 — open with slot machines on sides
  [ cw, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, cw ],
// Row 16 — center VIP rug top
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 17 — VIP tables left
  [ cw, cc, cc, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, ct, ct, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ct, ct, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, cc, cc, cc, cw ],
// Row 18 — VIP center with lanterns
  [ np, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, ct, ct, cc, cc, cc, ln, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ln, cc, cc, cc, ct, ct, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, nb ],
// Row 19 — VIP tables right
  [ cw, cc, cc, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cc, cc, ct, ct, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ct, ct, cc, cc, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, cc, cc, cc, cw ],
// Row 20 — VIP rug bottom
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cr, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 21 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 22 — slot machines row
  [ np, cc, sm, cc, sm, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, sm, cc, sm, cc, nb ],
// Row 23 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 24 — more slot machines + columns
  [ cw, cc, cc, cc, sm, cc, sm, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, sm, cc, sm, cc, cc, cc, cw ],
// Row 25 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 26 — slot machines on sides
  [ np, cc, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, cc, nb ],
// Row 27 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 28 — columns
  [ cw, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, co, cc, cc, cc, cc, cc, cw ],
// Row 29 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 30 — open floor
  [ np, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, nb ],
// Row 31 — slot machines
  [ cw, cc, sm, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, sm, cc, cw ],
// Row 32 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 33 — velvet rope area near entrance
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cv, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cv, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 34 — open floor
  [ np, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, nb ],
// Row 35 — lanterns near entrance
  [ cw, ln, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ln, cw ],
// Row 36 — entrance hallway
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, ce, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 37 — open floor near exit
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 38 — open floor
  [ cw, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cc, cw ],
// Row 39 — bottom wall
  [ cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw, cw ],
];

// Casino interior NPCs — positions for 30x30 tiled casino map
export const casinoNpcs: NPC[] = [
  {
    x: 2 * TILE_SIZE + 8,
    y: 8 * TILE_SIZE + 8,
    name: "Coin Toss Dealer",
    dialogue: [
      "Welcome to the Coin Toss table!",
      "Call heads or tails. Double or nothing.",
      "Simple rules. Pure luck. Big payouts.",
      "Place your bet when you're ready.",
    ],
    color: "#e94560",
    hairColor: "#1a1a2e",
    icon: "🪙",
  },
  {
    x: 27 * TILE_SIZE + 8,
    y: 8 * TILE_SIZE + 8,
    name: "Price Dealer",
    dialogue: [
      "This is the Price Prediction table.",
      "A price chart moves in real time.",
      "Bet UP or DOWN on the next candle.",
      "Read the trend. Trust your instincts.",
    ],
    color: "#3498db",
    hairColor: "#2c3e50",
    icon: "📈",
  },
  {
    x: 14 * TILE_SIZE + 8,
    y: 12 * TILE_SIZE + 8,
    name: "Bartender Jin",
    dialogue: [
      "Hey there, fresh face! Welcome to the Dragon.",
      "You wanna play? Head to the LEFT side of the floor.",
      "The Coin Toss tables are over there. Can't miss 'em.",
      "Walk up to a green table and press E to start a game.",
      "Win enough coins and the boss might let you try the right side...",
      "That's where the Price Prediction tables are. Big money.",
    ],
    color: "#f39c12",
    hairColor: "#ecf0f1",
    icon: "🍶",
  },
  {
    x: 2 * TILE_SIZE + 8,
    y: 10 * TILE_SIZE + 8,
    name: "Cashier Mae",
    dialogue: [
      "Need chips? I handle all exchanges here.",
      "Coins in, chips out. Simple as that.",
      "Come back when your pockets are heavy!",
    ],
    color: "#9b59b6",
    hairColor: "#fdd835",
    icon: "💰",
  },
  {
    x: 24 * TILE_SIZE + 8,
    y: 10 * TILE_SIZE + 8,
    name: "Lucky Pete",
    dialogue: [
      "I've been on a hot streak all night!",
      "Three sevens on the slots... TWICE!",
      "This place is magic, I tell ya.",
    ],
    color: "#2ecc71",
    hairColor: "#e74c3c",
    icon: "🍀",
  },
  {
    x: 8 * TILE_SIZE + 8,
    y: 15 * TILE_SIZE + 8,
    name: "VIP Host Rena",
    dialogue: [
      "Welcome to the VIP section, high roller.",
      "These tables have higher limits...",
      "Only the best players make it here.",
      "Prove yourself and unlock AI Agents.",
    ],
    color: "#e91e63",
    hairColor: "#fdd835",
    icon: "👑",
  },
  {
    x: 5 * TILE_SIZE + 8,
    y: 21 * TILE_SIZE + 8,
    name: "Gambler Ryo",
    dialogue: [
      "Psst... wanna know a secret?",
      "The Price Prediction table... it's not random.",
      "If you study the patterns, you can win big.",
      "Don't tell anyone I told you that.",
    ],
    color: "#607d8b",
    hairColor: "#455a64",
    icon: "🤫",
  },
  {
    x: 14 * TILE_SIZE + 8,
    y: 3 * TILE_SIZE + 8,
    name: "Bouncer Kaz",
    dialogue: [
      "Hold it right there.",
      "The upper floor is for high rollers only.",
      "Come back when you've got VIP clearance.",
      "Now scram before I lose my patience.",
    ],
    color: "#2c3e50",
    hairColor: "#1a1a1a",
    icon: "💪",
  },
  {
    x: 26 * TILE_SIZE + 8,
    y: 27 * TILE_SIZE + 8,
    name: "Singer Lila",
    dialogue: [
      "♪ Lady luck, won't you smile tonight... ♪",
      "Oh, hello! Just practicing my set.",
      "The music keeps the gamblers happy.",
      "And happy gamblers spend more coins!",
    ],
    color: "#ab47bc",
    hairColor: "#ff7043",
    icon: "🎤",
  },
  {
    x: 16 * TILE_SIZE + 8,
    y: 14 * TILE_SIZE + 8,
    name: "Doorman Hiro",
    dialogue: [
      "The exit is right behind me, friend.",
      "Press E on the EXIT marker to leave.",
      "Come back anytime — luck awaits!",
    ],
    color: "#5d4037",
    hairColor: "#3e2723",
    icon: "🚪",
  },
];

// Tile interactions inside the casino
export const casinoTileInteractions: Record<number, string[]> = {
  [T.CASINO_TABLE]: [
    "A green felt table with chips stacked high.",
    "The game awaits... step closer to play.",
  ],
  [T.SLOT_MACHINE]: [
    "A classic slot machine — three reels of fortune.",
    "Insert a coin to try your luck!",
  ],
  [T.CASINO_CHIP_RACK]: [
    "Stacks of red, green, and gold chips.",
    "Exchange your coins here.",
  ],
  [T.CASINO_EXIT]: [
    "The exit back to Fortune Falls.",
    "Leaving so soon?",
  ],
};
