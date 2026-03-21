// Tile types and their properties
export const TILE_SIZE = 48;

export enum TileType {
  GRASS = 0,
  PATH = 1,
  WATER = 2,
  TREE_TRUNK = 3,
  TREE_TOP = 4,
  WALL = 5,
  ROOF = 6,
  DOOR = 7,
  FENCE = 8,
  FLOWER_RED = 9,
  FLOWER_BLUE = 10,
  CROP = 11,
  ROCK = 12,
  BRIDGE = 13,
  DARK_GRASS = 14,
  SAND = 15,
  ROOF_RED = 16,
  WINDOW = 17,
  STALL = 18,
  CHEST = 19,
  SIGN = 20,
  TALL_GRASS = 21,
  WATER_EDGE = 22,
  MUSHROOM = 23,
  BENCH = 24,
  LAMP = 25,
  CASINO_WALL = 26,
  CASINO_ROOF = 27,
  CASINO_DOOR = 28,
  NEON_PINK = 29,
  NEON_BLUE = 30,
  CASINO_FLOOR = 31,
  TORII = 32,
  LANTERN = 33,
  BAMBOO = 34,
  CASINO_WINDOW = 35,
  CASINO_UPPER = 36,      // upper dark facade
  CASINO_MARQUEE = 37,    // the big sign band
  CASINO_PILLAR = 38,     // stone/brick pillar
  CASINO_AWNING = 39,     // awning above entrance
  CASINO_DISPLAY = 40,    // display window / poster
  CASINO_BRICK = 41,      // detailed brick wall
  STREET_LAMP = 42,       // tall street lamp
  SIDEWALK = 43,          // paved sidewalk
  // Casino interior tiles
  CASINO_CARPET = 44,     // red/gold carpet floor
  CASINO_TABLE = 45,      // game table (coin toss / prediction)
  SLOT_MACHINE = 46,      // slot machine
  CASINO_BAR = 47,        // bar counter
  CASINO_STOOL = 48,      // bar stool
  CASINO_EXIT = 49,       // exit door back to overworld
  CASINO_RUG = 50,        // decorative center rug
  CASINO_COLUMN = 51,     // interior support column
  CASINO_CHIP_RACK = 52,  // chip rack / cashier
  CASINO_VELVET = 53,     // velvet rope / VIP area
  CASINO_STAIRS = 54,     // stairs to upper floor (guarded)
}

export interface TileInfo {
  solid: boolean;
  color: string;
  color2?: string; // secondary color for detail
  interactable?: boolean;
  label?: string;
}

export const TILE_INFO: Record<TileType, TileInfo> = {
  [TileType.GRASS]: { solid: false, color: "#5a8f3c", color2: "#4e7d34" },
  [TileType.PATH]: { solid: false, color: "#d4a574", color2: "#c99b68" },
  [TileType.WATER]: { solid: true, color: "#3498db", color2: "#2980b9" },
  [TileType.TREE_TRUNK]: { solid: true, color: "#5d4037", color2: "#4e342e" },
  [TileType.TREE_TOP]: { solid: true, color: "#2e7d32", color2: "#1b5e20" },
  [TileType.WALL]: { solid: true, color: "#8d6e63", color2: "#795548" },
  [TileType.ROOF]: { solid: true, color: "#6d4c41", color2: "#5d4037" },
  [TileType.DOOR]: { solid: false, color: "#4e342e", color2: "#3e2723", interactable: true, label: "Enter" },
  [TileType.FENCE]: { solid: true, color: "#a1887f", color2: "#8d6e63" },
  [TileType.FLOWER_RED]: { solid: false, color: "#5a8f3c", color2: "#e74c3c" },
  [TileType.FLOWER_BLUE]: { solid: false, color: "#5a8f3c", color2: "#3498db" },
  [TileType.CROP]: { solid: false, color: "#8d6e24", color2: "#f1c40f" },
  [TileType.ROCK]: { solid: true, color: "#78909c", color2: "#607d8b" },
  [TileType.BRIDGE]: { solid: false, color: "#8d6e63", color2: "#6d4c41" },
  [TileType.DARK_GRASS]: { solid: false, color: "#3d6b2e", color2: "#2e5a22" },
  [TileType.SAND]: { solid: false, color: "#f0d9a0", color2: "#e8cc8a" },
  [TileType.ROOF_RED]: { solid: true, color: "#c0392b", color2: "#a93226" },
  [TileType.WINDOW]: { solid: true, color: "#85c1e9", color2: "#5dade2" },
  [TileType.STALL]: { solid: true, color: "#2471a3", color2: "#1a5276" },
  [TileType.CHEST]: { solid: true, color: "#b7950b", color2: "#9a7d0a", interactable: true, label: "Open chest" },
  [TileType.SIGN]: { solid: true, color: "#a1887f", color2: "#6d4c41", interactable: true, label: "Read sign" },
  [TileType.TALL_GRASS]: { solid: false, color: "#4caf50", color2: "#388e3c" },
  [TileType.WATER_EDGE]: { solid: true, color: "#5dade2", color2: "#3498db" },
  [TileType.MUSHROOM]: { solid: false, color: "#5a8f3c", color2: "#e74c3c" },
  [TileType.BENCH]: { solid: true, color: "#795548", color2: "#5d4037" },
  [TileType.LAMP]: { solid: true, color: "#f9a825", color2: "#f57f17" },
  [TileType.CASINO_WALL]: { solid: true, color: "#1a1a2e", color2: "#16213e" },
  [TileType.CASINO_ROOF]: { solid: true, color: "#0f3460", color2: "#e94560" },
  [TileType.CASINO_DOOR]: { solid: true, color: "#1a1a2e", color2: "#e94560", interactable: true, label: "Enter Casino" },
  [TileType.NEON_PINK]: { solid: true, color: "#e94560", color2: "#ff6b81" },
  [TileType.NEON_BLUE]: { solid: true, color: "#0f3460", color2: "#00d2ff" },
  [TileType.CASINO_FLOOR]: { solid: false, color: "#1a1a2e", color2: "#2a2a4e" },
  [TileType.TORII]: { solid: true, color: "#c0392b", color2: "#e74c3c" },
  [TileType.LANTERN]: { solid: true, color: "#e94560", color2: "#ff6b81" },
  [TileType.BAMBOO]: { solid: true, color: "#2e7d32", color2: "#66bb6a" },
  [TileType.CASINO_WINDOW]: { solid: true, color: "#1a1a2e", color2: "#00d2ff" },
  [TileType.CASINO_UPPER]: { solid: true, color: "#2a1f3d", color2: "#1a1530" },
  [TileType.CASINO_MARQUEE]: { solid: true, color: "#1a1530", color2: "#fdd835" },
  [TileType.CASINO_PILLAR]: { solid: true, color: "#8d7b68", color2: "#6d5d4e" },
  [TileType.CASINO_AWNING]: { solid: true, color: "#2d6e4e", color2: "#1a5035" },
  [TileType.CASINO_DISPLAY]: { solid: true, color: "#c4a882", color2: "#e8d5b5" },
  [TileType.CASINO_BRICK]: { solid: true, color: "#a08868", color2: "#8a7458" },
  [TileType.STREET_LAMP]: { solid: true, color: "#d4a574", color2: "#bdc3c7" },
  [TileType.SIDEWALK]: { solid: false, color: "#b0a090", color2: "#9a8a78" },
  [TileType.CASINO_CARPET]: { solid: false, color: "#8b1a2b", color2: "#6b1020" },
  [TileType.CASINO_TABLE]: { solid: true, color: "#1a5c2a", color2: "#0d4a1e", interactable: true, label: "Play" },
  [TileType.SLOT_MACHINE]: { solid: true, color: "#c0392b", color2: "#fdd835" },
  [TileType.CASINO_BAR]: { solid: true, color: "#5d3a1a", color2: "#8d6e42" },
  [TileType.CASINO_STOOL]: { solid: true, color: "#4a4a4a", color2: "#7a7a7a" },
  [TileType.CASINO_EXIT]: { solid: false, color: "#4e342e", color2: "#fdd835", interactable: true, label: "Exit Casino" },
  [TileType.CASINO_RUG]: { solid: false, color: "#6b1a30", color2: "#fdd835" },
  [TileType.CASINO_COLUMN]: { solid: true, color: "#8d7b68", color2: "#fdd835" },
  [TileType.CASINO_CHIP_RACK]: { solid: true, color: "#2a1a3e", color2: "#fdd835", interactable: true, label: "Cashier" },
  [TileType.CASINO_VELVET]: { solid: true, color: "#8b1a4a", color2: "#fdd835" },
  [TileType.CASINO_STAIRS]: { solid: false, color: "#4a3a2e", color2: "#fdd835", interactable: true, label: "Go Upstairs" },
};

import { drawSprite } from "./sprites";

export function drawTile(ctx: CanvasRenderingContext2D, type: TileType, x: number, y: number) {
  const info = TILE_INFO[type];
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  // Try sprite-based rendering first (only for non-casino overworld tiles)
  if (type < TileType.CASINO_WALL || type === TileType.SIDEWALK) {
    if (drawSprite(ctx, type, px, py, TILE_SIZE)) return;
  }

  // Fallback: procedural rendering
  ctx.fillStyle = info.color;
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  switch (type) {
    case TileType.GRASS:
      // Grass blades
      ctx.fillStyle = info.color2!;
      for (let i = 0; i < 3; i++) {
        const gx = px + 5 + ((x * 7 + i * 11 + y * 3) % 22);
        const gy = py + 8 + ((y * 5 + i * 7 + x * 2) % 18);
        ctx.fillRect(gx, gy, 2, 4);
      }
      break;

    case TileType.TALL_GRASS:
      ctx.fillStyle = info.color2!;
      for (let i = 0; i < 5; i++) {
        const gx = px + 2 + ((x * 7 + i * 6) % 24);
        const gy = py + 4 + ((y * 5 + i * 8) % 14);
        ctx.fillRect(gx, gy, 2, 8);
        ctx.fillRect(gx + 1, gy - 2, 1, 3);
      }
      break;

    case TileType.PATH:
      // Path texture
      ctx.fillStyle = info.color2!;
      for (let i = 0; i < 4; i++) {
        const sx = px + ((x * 13 + i * 9 + y * 3) % 26);
        const sy = py + ((y * 11 + i * 7 + x * 5) % 26);
        ctx.fillRect(sx, sy, 3, 3);
      }
      break;

    case TileType.WATER:
      // Wave animation hint
      ctx.fillStyle = info.color2!;
      const waveOffset = (Date.now() / 500) % 4;
      for (let i = 0; i < 3; i++) {
        const wx = px + 4 + i * 10 + Math.sin(waveOffset + i) * 2;
        ctx.fillRect(wx, py + 12 + i * 6, 8, 2);
      }
      // Sparkle
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(px + ((x * 7 + y * 3) % 24) + 4, py + 8, 2, 2);
      break;

    case TileType.WATER_EDGE:
      ctx.fillStyle = "#a8d8ea";
      ctx.fillRect(px, py, TILE_SIZE, 4);
      break;

    case TileType.TREE_TRUNK:
      // Draw grass base — tree overlay covers this
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#4e7d34";
      ctx.fillRect(px + 5, py + 8, 2, 4);
      ctx.fillRect(px + 18, py + 15, 2, 4);
      ctx.fillRect(px + 25, py + 6, 2, 4);
      break;

    case TileType.TREE_TOP:
      // Draw grass base — tree sprite overlay covers this in second pass
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = "#4e7d34";
      ctx.fillRect(px + 7, py + 12, 2, 4);
      ctx.fillRect(px + 20, py + 5, 2, 4);
      ctx.fillRect(px + 14, py + 22, 2, 4);
      ctx.fill();
      break;

    case TileType.WALL:
      // Brick pattern
      ctx.fillStyle = info.color2!;
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 8;
        ctx.fillRect(px + offset, py + row * 8, 16, 1);
        ctx.fillRect(px + offset + 16, py + row * 8, 16, 1);
        ctx.fillRect(px + offset, py + row * 8, 1, 8);
        ctx.fillRect(px + offset + 16, py + row * 8, 1, 8);
      }
      break;

    case TileType.ROOF:
    case TileType.ROOF_RED: {
      // Roof tiles
      const roofColor2 = type === TileType.ROOF_RED ? "#e74c3c" : info.color2!;
      ctx.fillStyle = roofColor2;
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          if ((row + col) % 2 === 0) {
            ctx.fillRect(px + col * 8, py + row * 8, 8, 8);
          }
        }
      }
      break;
    }

    case TileType.DOOR:
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(px + 6, py + 2, 20, 28);
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(px + 8, py + 4, 16, 24);
      // Handle
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 20, py + 14, 3, 3);
      break;

    case TileType.FENCE:
      ctx.fillStyle = "#5d4037";
      // Posts
      ctx.fillRect(px + 2, py + 8, 4, 24);
      ctx.fillRect(px + 26, py + 8, 4, 24);
      // Rails
      ctx.fillStyle = info.color;
      ctx.fillRect(px, py + 12, TILE_SIZE, 4);
      ctx.fillRect(px, py + 22, TILE_SIZE, 4);
      // Post tops
      ctx.fillStyle = info.color2!;
      ctx.fillRect(px + 1, py + 6, 6, 4);
      ctx.fillRect(px + 25, py + 6, 6, 4);
      break;

    case TileType.FLOWER_RED:
    case TileType.FLOWER_BLUE:
      // Grass base
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Stems and flowers
      ctx.fillStyle = "#388e3c";
      ctx.fillRect(px + 8, py + 12, 2, 12);
      ctx.fillRect(px + 20, py + 10, 2, 14);
      ctx.fillStyle = info.color2!;
      ctx.beginPath();
      ctx.arc(px + 9, py + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 21, py + 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff176";
      ctx.fillRect(px + 8, py + 9, 2, 2);
      ctx.fillRect(px + 20, py + 7, 2, 2);
      break;

    case TileType.CROP:
      // Soil
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(px, py + 24, TILE_SIZE, 8);
      // Wheat
      ctx.fillStyle = info.color2!;
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + 4 + i * 7, py + 4, 4, 20);
        ctx.fillRect(px + 3 + i * 7, py + 2, 6, 4);
      }
      break;

    case TileType.ROCK:
      ctx.fillStyle = "#90a4ae";
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = info.color2!;
      ctx.beginPath();
      ctx.arc(px + 14, py + 16, 10, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = "#b0bec5";
      ctx.fillRect(px + 10, py + 12, 4, 3);
      break;

    case TileType.BRIDGE:
      ctx.fillStyle = info.color2!;
      // Planks
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px + 2, py + i * 8 + 1, 28, 6);
      }
      // Rails
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(px, py, 3, TILE_SIZE);
      ctx.fillRect(px + 29, py, 3, TILE_SIZE);
      break;

    case TileType.SAND:
      ctx.fillStyle = info.color2!;
      for (let i = 0; i < 3; i++) {
        const sx = px + ((x * 7 + i * 11) % 24);
        const sy = py + ((y * 9 + i * 5) % 24);
        ctx.fillRect(sx, sy, 4, 2);
      }
      break;

    case TileType.WINDOW:
      // Window frame
      ctx.fillStyle = "#795548";
      ctx.fillRect(px + 4, py + 4, 24, 24);
      // Glass
      ctx.fillStyle = info.color;
      ctx.fillRect(px + 6, py + 6, 20, 20);
      // Cross frame
      ctx.fillStyle = "#795548";
      ctx.fillRect(px + 15, py + 6, 2, 20);
      ctx.fillRect(px + 6, py + 15, 20, 2);
      // Light reflection
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.fillRect(px + 8, py + 8, 5, 5);
      break;

    case TileType.STALL:
      // Stall canopy
      ctx.fillStyle = info.color2!;
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Stripes
      ctx.fillStyle = "#1a5276";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px, py + i * 10, TILE_SIZE, 4);
      }
      // Banner fringe
      ctx.fillStyle = "#f39c12";
      ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
      break;

    case TileType.CHEST:
      // Grass base
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Chest body
      ctx.fillStyle = "#b7950b";
      ctx.fillRect(px + 6, py + 12, 20, 16);
      // Chest lid
      ctx.fillStyle = "#d4ac0d";
      ctx.fillRect(px + 5, py + 8, 22, 8);
      // Lock
      ctx.fillStyle = "#7f8c8d";
      ctx.fillRect(px + 14, py + 16, 4, 6);
      break;

    case TileType.SIGN:
      // Grass base
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Post
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(px + 14, py + 16, 4, 16);
      // Sign board
      ctx.fillStyle = info.color;
      ctx.fillRect(px + 6, py + 6, 20, 14);
      ctx.fillStyle = info.color2!;
      ctx.fillRect(px + 8, py + 8, 16, 10);
      break;

    case TileType.MUSHROOM:
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Stem
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(px + 13, py + 18, 6, 10);
      // Cap
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 8, Math.PI, 0);
      ctx.fill();
      // Spots
      ctx.fillStyle = "#fff";
      ctx.fillRect(px + 12, py + 12, 3, 3);
      ctx.fillRect(px + 18, py + 13, 2, 2);
      break;

    case TileType.BENCH:
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Bench seat
      ctx.fillStyle = info.color;
      ctx.fillRect(px + 4, py + 14, 24, 6);
      // Legs
      ctx.fillStyle = info.color2!;
      ctx.fillRect(px + 6, py + 20, 4, 8);
      ctx.fillRect(px + 22, py + 20, 4, 8);
      // Back
      ctx.fillRect(px + 4, py + 8, 24, 4);
      ctx.fillRect(px + 6, py + 8, 4, 8);
      ctx.fillRect(px + 22, py + 8, 4, 8);
      break;

    case TileType.LAMP:
      ctx.fillStyle = "#5a8f3c";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Pole
      ctx.fillStyle = "#424242";
      ctx.fillRect(px + 14, py + 10, 4, 22);
      // Lamp top
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 10, py + 4, 12, 8);
      // Glow
      ctx.fillStyle = "rgba(253,216,53,0.2)";
      ctx.beginPath();
      ctx.arc(px + 16, py + 8, 14, 0, Math.PI * 2);
      ctx.fill();
      break;

    case TileType.CASINO_WALL: {
      // Dark Japanese-style wall
      ctx.fillStyle = "#16213e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Wood beam pattern
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillRect(px, py + 15, TILE_SIZE, 2);
      ctx.fillRect(px, py + 30, TILE_SIZE, 2);
      // Subtle gold trim
      ctx.fillStyle = "rgba(233,69,96,0.15)";
      ctx.fillRect(px, py, 2, TILE_SIZE);
      ctx.fillRect(px + 30, py, 2, TILE_SIZE);
      break;
    }

    case TileType.CASINO_ROOF: {
      // Japanese curved roof style
      ctx.fillStyle = "#0f3460";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Layered tiles
      ctx.fillStyle = "#e94560";
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 8;
        ctx.fillRect(px + offset, py + row * 8, 8, 6);
        ctx.fillRect(px + offset + 16, py + row * 8, 8, 6);
      }
      // Gold edge
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px, py + 30, TILE_SIZE, 2);
      break;
    }

    case TileType.CASINO_DOOR: {
      // Japanese sliding door (shoji-style)
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Door frame
      ctx.fillStyle = "#4a1a2e";
      ctx.fillRect(px + 4, py + 2, 24, 28);
      // Paper panels
      ctx.fillStyle = "#f5e6ca";
      ctx.fillRect(px + 6, py + 4, 9, 24);
      ctx.fillRect(px + 17, py + 4, 9, 24);
      // Grid lines
      ctx.fillStyle = "#4a1a2e";
      ctx.fillRect(px + 6, py + 14, 9, 1);
      ctx.fillRect(px + 17, py + 14, 9, 1);
      ctx.fillRect(px + 10, py + 4, 1, 24);
      ctx.fillRect(px + 21, py + 4, 1, 24);
      // Neon glow from inside
      const doorGlow = Math.sin(Date.now() / 600) * 0.15 + 0.25;
      ctx.fillStyle = `rgba(233, 69, 96, ${doorGlow})`;
      ctx.fillRect(px + 6, py + 4, 20, 24);
      break;
    }

    case TileType.NEON_PINK: {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Animated neon glow
      const pinkPulse = Math.sin(Date.now() / 400 + x) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(233, 69, 96, ${pinkPulse})`;
      ctx.fillRect(px + 2, py + 2, 28, 28);
      // Bright center
      ctx.fillStyle = `rgba(255, 107, 129, ${pinkPulse})`;
      ctx.fillRect(px + 6, py + 6, 20, 20);
      // Glow effect
      ctx.fillStyle = `rgba(233, 69, 96, ${pinkPulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 20, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.NEON_BLUE: {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Animated neon glow
      const bluePulse = Math.sin(Date.now() / 500 + y) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(0, 210, 255, ${bluePulse})`;
      ctx.fillRect(px + 2, py + 2, 28, 28);
      ctx.fillStyle = `rgba(100, 230, 255, ${bluePulse})`;
      ctx.fillRect(px + 6, py + 6, 20, 20);
      // Glow
      ctx.fillStyle = `rgba(0, 210, 255, ${bluePulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 20, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.CASINO_FLOOR: {
      // Dark patterned floor
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Diamond pattern
      ctx.fillStyle = "#2a2a4e";
      ctx.beginPath();
      ctx.moveTo(px + 16, py);
      ctx.lineTo(px + 32, py + 16);
      ctx.lineTo(px + 16, py + 32);
      ctx.lineTo(px, py + 16);
      ctx.closePath();
      ctx.fill();
      // Gold accent dots
      ctx.fillStyle = "rgba(253,216,53,0.15)";
      ctx.fillRect(px + 15, py + 15, 2, 2);
      break;
    }

    case TileType.TORII: {
      // Japanese torii gate
      ctx.fillStyle = "#3d6b2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Main pillars
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(px + 4, py + 8, 6, 24);
      ctx.fillRect(px + 22, py + 8, 6, 24);
      // Top beam
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(px, py + 4, TILE_SIZE, 6);
      ctx.fillRect(px + 2, py + 0, 28, 5);
      // Beam ends (curved up)
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(px, py + 2, 4, 4);
      ctx.fillRect(px + 28, py + 2, 4, 4);
      // Gold accent
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 12, py + 6, 8, 3);
      break;
    }

    case TileType.LANTERN: {
      // Japanese paper lantern
      ctx.fillStyle = "#3d6b2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // String
      ctx.fillStyle = "#424242";
      ctx.fillRect(px + 15, py, 2, 8);
      // Lantern body
      const lanternGlow = Math.sin(Date.now() / 700 + x * 3) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(233, 69, 96, ${lanternGlow})`;
      ctx.fillRect(px + 8, py + 8, 16, 20);
      // Top/bottom caps
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px + 10, py + 7, 12, 3);
      ctx.fillRect(px + 10, py + 26, 12, 3);
      // Kanji-like decoration
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px + 13, py + 13, 6, 2);
      ctx.fillRect(px + 15, py + 12, 2, 8);
      ctx.fillRect(px + 13, py + 19, 6, 2);
      // Glow
      ctx.fillStyle = `rgba(233, 69, 96, ${lanternGlow * 0.25})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 16, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.BAMBOO: {
      ctx.fillStyle = "#3d6b2e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Bamboo stalks
      ctx.fillStyle = "#66bb6a";
      ctx.fillRect(px + 6, py, 5, TILE_SIZE);
      ctx.fillRect(px + 20, py, 5, TILE_SIZE);
      // Nodes
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(px + 5, py + 10, 7, 3);
      ctx.fillRect(px + 19, py + 20, 7, 3);
      // Leaves
      ctx.fillStyle = "#81c784";
      ctx.fillRect(px + 11, py + 6, 6, 3);
      ctx.fillRect(px + 25, py + 16, 6, 3);
      ctx.fillRect(px + 14, py + 22, 5, 2);
      break;
    }

    case TileType.CASINO_WINDOW: {
      // Dark wall with neon-lit window
      ctx.fillStyle = "#16213e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Window frame
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px + 4, py + 4, 24, 24);
      // Window glow
      const winGlow = Math.sin(Date.now() / 800 + x + y) * 0.2 + 0.6;
      ctx.fillStyle = `rgba(0, 210, 255, ${winGlow})`;
      ctx.fillRect(px + 6, py + 6, 20, 20);
      // Grid (shoji style)
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px + 15, py + 6, 2, 20);
      ctx.fillRect(px + 6, py + 15, 20, 2);
      // Neon border
      ctx.strokeStyle = `rgba(233, 69, 96, ${winGlow})`;
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 4, py + 4, 24, 24);
      break;
    }

    case TileType.CASINO_UPPER: {
      // Upper dark facade with decorative grid windows
      ctx.fillStyle = "#2a1f3d";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Dark panel grid (like the cinema's upper windows)
      ctx.fillStyle = "#1a1530";
      ctx.fillRect(px + 2, py + 2, 28, 28);
      // Window grid lines
      ctx.fillStyle = "#352a4d";
      ctx.fillRect(px + 2, py + 15, 28, 2);
      ctx.fillRect(px + 15, py + 2, 2, 28);
      // Subtle teal tint on glass
      ctx.fillStyle = "rgba(0,180,160,0.12)";
      ctx.fillRect(px + 3, py + 3, 12, 12);
      ctx.fillRect(px + 17, py + 17, 12, 12);
      break;
    }

    case TileType.CASINO_MARQUEE: {
      // Big sign band — dark background with neon text feel
      ctx.fillStyle = "#0f0a1a";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Top gold trim with bulb dots
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px, py, TILE_SIZE, 3);
      ctx.fillRect(px, py + 29, TILE_SIZE, 3);
      // Bulb dots on top/bottom
      const bulbPhase = Date.now() / 200;
      for (let i = 0; i < 4; i++) {
        const on = Math.sin(bulbPhase + i * 1.5) > 0;
        ctx.fillStyle = on ? "#ffeb3b" : "#8d6e24";
        ctx.beginPath();
        ctx.arc(px + 4 + i * 8, py + 1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = on ? "#ff6b35" : "#5d3a1a";
        ctx.beginPath();
        ctx.arc(px + 4 + i * 8, py + 31, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      // Neon glow center area
      const mGlow = Math.sin(Date.now() / 500) * 0.15 + 0.85;
      ctx.fillStyle = `rgba(233, 69, 96, ${mGlow * 0.3})`;
      ctx.fillRect(px + 2, py + 5, 28, 22);
      break;
    }

    case TileType.CASINO_PILLAR: {
      // Stone pillar with brick detail
      ctx.fillStyle = "#8d7b68";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Pillar body (narrower)
      ctx.fillStyle = "#a08868";
      ctx.fillRect(px + 6, py, 20, TILE_SIZE);
      // Highlight edge
      ctx.fillStyle = "#baa888";
      ctx.fillRect(px + 7, py, 4, TILE_SIZE);
      // Shadow edge
      ctx.fillStyle = "#6d5d4e";
      ctx.fillRect(px + 23, py, 3, TILE_SIZE);
      // Brick lines
      ctx.fillStyle = "#7a6a58";
      for (let row = 0; row < 4; row++) {
        ctx.fillRect(px + 6, py + row * 8 + 7, 20, 1);
      }
      // Cap/base details
      ctx.fillStyle = "#baa888";
      ctx.fillRect(px + 4, py, 24, 3);
      ctx.fillRect(px + 4, py + 29, 24, 3);
      break;
    }

    case TileType.CASINO_AWNING: {
      // Green awning/canopy like the cinema reference
      ctx.fillStyle = "#2d6e4e";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Stripes
      ctx.fillStyle = "#1a5035";
      ctx.fillRect(px, py + 4, TILE_SIZE, 4);
      ctx.fillRect(px, py + 12, TILE_SIZE, 4);
      ctx.fillRect(px, py + 20, TILE_SIZE, 4);
      ctx.fillRect(px, py + 28, TILE_SIZE, 4);
      // Gold trim top
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px, py, TILE_SIZE, 2);
      // Bottom fringe
      ctx.fillStyle = "#1a5035";
      for (let i = 0; i < 8; i++) {
        ctx.fillRect(px + i * 4, py + 30, 2, 2);
      }
      break;
    }

    case TileType.CASINO_DISPLAY: {
      // Display window / poster window like cinema storefronts
      ctx.fillStyle = "#c4a882";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Window recess
      ctx.fillStyle = "#8878a0";
      ctx.fillRect(px + 3, py + 3, 26, 26);
      // Glass with display content
      const dispGlow = Math.sin(Date.now() / 900 + x * 2) * 0.1 + 0.4;
      ctx.fillStyle = `rgba(200, 180, 220, ${dispGlow + 0.3})`;
      ctx.fillRect(px + 4, py + 4, 24, 24);
      // Circular porthole detail
      ctx.fillStyle = "#a090b8";
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(180, 160, 200, ${dispGlow + 0.4})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 7, 0, Math.PI * 2);
      ctx.fill();
      // Frame
      ctx.strokeStyle = "#6d5d4e";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3, py + 3, 26, 26);
      break;
    }

    case TileType.CASINO_BRICK: {
      // Detailed brick wall (warmer, like reference building)
      ctx.fillStyle = "#a08868";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Brick pattern
      for (let row = 0; row < 4; row++) {
        const offset = row % 2 === 0 ? 0 : 8;
        ctx.fillStyle = "#8a7458";
        ctx.fillRect(px + offset, py + row * 8, 16, 1);
        ctx.fillRect(px + offset + 16, py + row * 8, 16, 1);
        ctx.fillRect(px + offset, py + row * 8, 1, 8);
        ctx.fillRect(px + offset + 16, py + row * 8, 1, 8);
        // Slight color variation per brick
        if ((row + x) % 3 === 0) {
          ctx.fillStyle = "rgba(180,160,130,0.15)";
          ctx.fillRect(px + offset + 1, py + row * 8 + 1, 14, 6);
        }
      }
      break;
    }

    case TileType.STREET_LAMP: {
      // Tall modern street lamp on sidewalk
      ctx.fillStyle = "#b0a090";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Pole
      ctx.fillStyle = "#7a7a7a";
      ctx.fillRect(px + 14, py + 6, 4, 26);
      // Arm
      ctx.fillStyle = "#8a8a8a";
      ctx.fillRect(px + 8, py + 4, 16, 3);
      // Light
      ctx.fillStyle = "#fff9c4";
      ctx.fillRect(px + 10, py + 1, 12, 4);
      // Glow
      const lampG = Math.sin(Date.now() / 600) * 0.1 + 0.25;
      ctx.fillStyle = `rgba(255,249,196,${lampG})`;
      ctx.beginPath();
      ctx.arc(px + 16, py + 3, 12, 0, Math.PI * 2);
      ctx.fill();
      // Base
      ctx.fillStyle = "#6a6a6a";
      ctx.fillRect(px + 12, py + 28, 8, 4);
      break;
    }

    case TileType.SIDEWALK: {
      // Paved sidewalk
      ctx.fillStyle = "#b0a090";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Tile grid
      ctx.fillStyle = "#9a8a78";
      ctx.fillRect(px + 15, py, 2, TILE_SIZE);
      ctx.fillRect(px, py + 15, TILE_SIZE, 2);
      // Subtle variation
      ctx.fillStyle = "rgba(180,170,155,0.2)";
      if ((x + y) % 2 === 0) {
        ctx.fillRect(px + 1, py + 1, 14, 14);
      } else {
        ctx.fillRect(px + 17, py + 17, 14, 14);
      }
      break;
    }

    case TileType.CASINO_CARPET: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Diamond pattern
      ctx.fillStyle = "#6b1020";
      ctx.beginPath();
      ctx.moveTo(px + 16, py);
      ctx.lineTo(px + 32, py + 16);
      ctx.lineTo(px + 16, py + 32);
      ctx.lineTo(px, py + 16);
      ctx.closePath();
      ctx.fill();
      // Gold accent dots
      ctx.fillStyle = "rgba(253,216,53,0.12)";
      ctx.fillRect(px + 15, py + 15, 2, 2);
      break;
    }

    case TileType.CASINO_TABLE: {
      // Green felt table
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Table top
      ctx.fillStyle = "#1a5c2a";
      ctx.fillRect(px + 2, py + 2, 28, 28);
      // Felt texture
      ctx.fillStyle = "#0d4a1e";
      ctx.fillRect(px + 4, py + 15, 24, 1);
      ctx.fillRect(px + 15, py + 4, 1, 24);
      // Gold rim
      ctx.strokeStyle = "#c9a84c";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 2, py + 2, 28, 28);
      // Chips
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(px + 10, py + 10, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3498db";
      ctx.beginPath();
      ctx.arc(px + 22, py + 22, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fdd835";
      ctx.beginPath();
      ctx.arc(px + 22, py + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.SLOT_MACHINE: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Machine body
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(px + 4, py + 2, 24, 28);
      // Screen
      const slotGlow = Math.sin(Date.now() / 300 + x * 5) * 0.2 + 0.8;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(px + 7, py + 5, 18, 12);
      // Reels
      ctx.fillStyle = `rgba(253,216,53,${slotGlow})`;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText("7 7 7", px + 16, py + 14);
      // Lever
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 26, py + 8, 4, 12);
      ctx.beginPath();
      ctx.arc(px + 28, py + 7, 3, 0, Math.PI * 2);
      ctx.fill();
      // Base
      ctx.fillStyle = "#8d6e24";
      ctx.fillRect(px + 6, py + 24, 20, 4);
      break;
    }

    case TileType.CASINO_BAR: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Bar counter
      ctx.fillStyle = "#5d3a1a";
      ctx.fillRect(px, py + 4, TILE_SIZE, 24);
      // Bar top (polished)
      ctx.fillStyle = "#8d6e42";
      ctx.fillRect(px, py + 4, TILE_SIZE, 6);
      // Highlight
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(px + 2, py + 5, 28, 2);
      // Bottles
      ctx.fillStyle = "#2ecc71";
      ctx.fillRect(px + 6, py + 12, 4, 10);
      ctx.fillStyle = "#e74c3c";
      ctx.fillRect(px + 14, py + 14, 4, 8);
      ctx.fillStyle = "#3498db";
      ctx.fillRect(px + 22, py + 12, 4, 10);
      break;
    }

    case TileType.CASINO_STOOL: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Stool leg
      ctx.fillStyle = "#4a4a4a";
      ctx.fillRect(px + 14, py + 14, 4, 14);
      // Seat
      ctx.fillStyle = "#7a7a7a";
      ctx.fillRect(px + 8, py + 10, 16, 6);
      // Cushion
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(px + 9, py + 8, 14, 4);
      break;
    }

    case TileType.CASINO_EXIT: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Door frame
      ctx.fillStyle = "#4e342e";
      ctx.fillRect(px + 4, py + 0, 24, TILE_SIZE);
      // Door
      ctx.fillStyle = "#3e2723";
      ctx.fillRect(px + 6, py + 2, 20, 28);
      // Exit sign glow
      const exitGlow = Math.sin(Date.now() / 500) * 0.2 + 0.8;
      ctx.fillStyle = `rgba(46, 204, 113, ${exitGlow})`;
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("EXIT", px + 16, py + 18);
      // Arrow
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 14, py + 22, 4, 3);
      break;
    }

    case TileType.CASINO_RUG: {
      ctx.fillStyle = "#6b1a30";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Ornate border
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillRect(px, py + 30, TILE_SIZE, 2);
      ctx.fillRect(px, py, 2, TILE_SIZE);
      ctx.fillRect(px + 30, py, 2, TILE_SIZE);
      // Center motif
      ctx.fillStyle = "rgba(253,216,53,0.25)";
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case TileType.CASINO_COLUMN: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Column body
      ctx.fillStyle = "#8d7b68";
      ctx.fillRect(px + 8, py, 16, TILE_SIZE);
      // Highlight
      ctx.fillStyle = "#baa888";
      ctx.fillRect(px + 9, py, 5, TILE_SIZE);
      // Shadow
      ctx.fillStyle = "#6d5d4e";
      ctx.fillRect(px + 21, py, 3, TILE_SIZE);
      // Gold bands
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 6, py, 20, 3);
      ctx.fillRect(px + 6, py + 29, 20, 3);
      break;
    }

    case TileType.CASINO_CHIP_RACK: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Counter
      ctx.fillStyle = "#2a1a3e";
      ctx.fillRect(px + 2, py + 6, 28, 22);
      // Gold trim
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 2, py + 6, 28, 2);
      // Chip stacks
      ctx.fillStyle = "#e74c3c";
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 8, py + 12, 6, 4);
      ctx.fillStyle = "#2ecc71";
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 8, py + 18, 6, 4);
      ctx.fillStyle = "#fdd835";
      for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 8, py + 24, 6, 4);
      break;
    }

    case TileType.CASINO_STAIRS: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Staircase going up
      ctx.fillStyle = "#4a3a2e";
      ctx.fillRect(px + 4, py + 2, 24, 28);
      // Steps
      for (let i = 0; i < 5; i++) {
        const stepY = py + 4 + i * 5;
        const shade = 0.6 + i * 0.08;
        ctx.fillStyle = `rgba(140,120,90,${shade})`;
        ctx.fillRect(px + 6, stepY, 20, 4);
        ctx.fillStyle = "#3a2a1e";
        ctx.fillRect(px + 6, stepY + 4, 20, 1);
      }
      // Gold handrails
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 4, py + 2, 2, 28);
      ctx.fillRect(px + 26, py + 2, 2, 28);
      // Arrow up
      const arrowGlow = Math.sin(Date.now() / 500) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(253,216,53,${arrowGlow})`;
      ctx.beginPath();
      ctx.moveTo(px + 16, py + 1);
      ctx.lineTo(px + 12, py + 6);
      ctx.lineTo(px + 20, py + 6);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case TileType.CASINO_VELVET: {
      ctx.fillStyle = "#8b1a2b";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      // Rope posts
      ctx.fillStyle = "#fdd835";
      ctx.fillRect(px + 2, py + 6, 4, 22);
      ctx.fillRect(px + 26, py + 6, 4, 22);
      // Post tops
      ctx.beginPath();
      ctx.arc(px + 4, py + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 28, py + 6, 4, 0, Math.PI * 2);
      ctx.fill();
      // Velvet rope
      ctx.strokeStyle = "#8b1a4a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 12);
      ctx.quadraticCurveTo(px + 16, py + 20, px + 28, py + 12);
      ctx.stroke();
      break;
    }
  }
}
