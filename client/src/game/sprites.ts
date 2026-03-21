// Sprite loader for Pixel Crawler tileset
// Uses numeric tile IDs to avoid circular dependency with tiles.ts

const BASE = "/tilesets/pixel-crawler";

// ── Sprite sheet paths ──────────────────────────────────────────────
const SHEETS = {
  vegetation: "Environment/Props/Static/Vegetation.png",
  rocks: "Environment/Props/Static/Rocks.png",
  bldgProps: "Environment/Structures/Buildings/Props.png",
  farm: "Environment/Props/Static/Farm.png",
  treeRound: "Environment/Props/Static/Trees/Model_01/Size_03.png",
  treePine: "Environment/Props/Static/Trees/Model_02/Size_03.png",
} as const;

type SheetKey = keyof typeof SHEETS;

// ── Image cache ─────────────────────────────────────────────────────
const cache: Partial<Record<SheetKey, HTMLImageElement>> = {};
let loading = false;
let loaded = false;

function loadImg(key: SheetKey): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { cache[key] = img; resolve(); };
    img.onerror = () => { resolve(); };
    img.src = `${BASE}/${SHEETS[key]}`;
  });
}

export function loadAllSprites(): Promise<void> {
  if (loaded || loading) return Promise.resolve();
  loading = true;
  const keys = Object.keys(SHEETS) as SheetKey[];
  return Promise.all(keys.map(k => loadImg(k))).then(() => { loaded = true; });
}

export function spritesReady(): boolean { return loaded; }

// ── Sprite region definition ────────────────────────────────────────
interface SpriteRef {
  sheet: SheetKey;
  sx: number; sy: number;
  sw: number; sh: number;
}

function s(sheet: SheetKey, sx: number, sy: number, sw: number, sh: number): SpriteRef {
  return { sheet, sx, sy, sw, sh };
}

// ── Tile type IDs (must match TileType enum in tiles.ts) ────────────
const T = {
  GRASS: 0, PATH: 1, WATER: 2, TREE_TRUNK: 3, TREE_TOP: 4,
  WALL: 5, ROOF: 6, DOOR: 7, FENCE: 8, FLOWER_RED: 9,
  FLOWER_BLUE: 10, CROP: 11, ROCK: 12, BRIDGE: 13,
  DARK_GRASS: 14, SAND: 15, ROOF_RED: 16, WINDOW: 17,
  STALL: 18, CHEST: 19, SIGN: 20, TALL_GRASS: 21,
  WATER_EDGE: 22, MUSHROOM: 23, BENCH: 24, LAMP: 25,
  BAMBOO: 34, SIDEWALK: 43,
} as const;

// ── Tile-to-sprite mapping ──────────────────────────────────────────
// Coordinates verified via pixel scanning of each sprite sheet.
// Only includes tiles with clear sprite matches in the free tileset.
// Tiles not listed here fall back to procedural rendering in tiles.ts.

const TILE_SPRITES: Record<number, SpriteRef> = {
  // Vegetation.png (400x432)
  // y=144-192: Small plant sprites (1st palette), repeats at y=192, y=240
  // x=64,w=16: compact green leafy plant (185px content in 16x16)
  // x=36,w=10: smaller green plant (58px)
  // x=81,w=30: large green leaf spread
  [T.TALL_GRASS]: s("vegetation", 64, 144, 16, 16),
  [T.CROP]:       s("vegetation", 81, 144, 16, 16),

  // y=336-352: Mushroom shapes — brown caps
  // x=49,w=14: medium mushroom group (120px content)
  // x=36,w=8: small mushroom (46px)
  [T.MUSHROOM]:   s("vegetation", 36, 336, 14, 16),

  // y=96-128: Medium bushes ~30x32 (green, autumn, brown, dead variants)
  // x=9: green bush, x=57: yellow-green, x=105: autumn, x=153: dead
  [T.BAMBOO]:     s("vegetation", 9, 96, 30, 32),

  // Rocks.png (208x304)
  // y=16-32: Row of medium rocks (brown)
  // x=7,w=19 (173px), x=39,w=22 (207px), x=65,w=14 (121px), x=80,w=16 (170px)
  // y=32-48: Larger rock bases
  // x=2,w=28 (364px) — bottom of a large rock
  [T.ROCK]:       s("rocks", 39, 16, 22, 32),

  // Buildings/Props.png (400x400)
  // y=16-48: Doors (32px tall). x=1(30w), x=32(32w), x=65(30w)
  [T.DOOR]:       s("bldgProps", 32, 16, 32, 32),
  // y=16-48: Windows/smaller openings. x=102(20w), x=136(16w), x=166(20w)
  [T.WINDOW]:     s("bldgProps", 136, 16, 16, 32),
  // y=64-96: Bench/table at x=32 (32w, 32h)
  [T.BENCH]:      s("bldgProps", 32, 64, 32, 32),
  // y=96-112: Fence posts. x=37(22w), x=69(22w)
  [T.FENCE]:      s("bldgProps", 69, 96, 22, 32),
  // y=64-96: Green bush planter at x=128 (64w)
  [T.STALL]:      s("bldgProps", 128, 64, 32, 32),
  // y=96-112: Stone pillar at x=7 (18w) — use as lamp post
  [T.LAMP]:       s("bldgProps", 7, 80, 18, 32),
  // y=16-48: Chest-like small item at x=102 (20w)
  [T.CHEST]:      s("bldgProps", 102, 16, 20, 32),
  // y=128-160: Sign post at x=17 (30w)
  [T.SIGN]:       s("bldgProps", 17, 128, 30, 32),

  // Farm.png (400x400) — crop rows
  // y=16: mature crops at x=17(14w), x=82(10w)
  [T.FLOWER_RED]: s("farm", 0, 16, 15, 16),
  [T.FLOWER_BLUE]:s("farm", 17, 16, 14, 16),
};

// Tiles that need grass drawn underneath before the sprite
const GRASS_BASE_TILES: Set<number> = new Set([
  T.FLOWER_RED, T.FLOWER_BLUE, T.MUSHROOM, T.TALL_GRASS,
  T.SIGN, T.LAMP, T.BENCH, T.CHEST, T.ROCK, T.CROP, T.BAMBOO,
  T.STALL, T.FENCE,
]);

// ── Single-tile sprite drawing ──────────────────────────────────────
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  type: number,
  px: number,
  py: number,
  tileSize: number,
): boolean {
  if (!loaded) return false;
  const ref = TILE_SPRITES[type];
  if (!ref) return false;
  const img = cache[ref.sheet];
  if (!img) return false;

  // Draw grass base underneath decoration tiles
  if (GRASS_BASE_TILES.has(type)) {
    ctx.fillStyle = "#5a8f3c";
    ctx.fillRect(px, py, tileSize, tileSize);
    ctx.fillStyle = "#4e7d34";
    for (let i = 0; i < 3; i++) {
      const gx = px + 5 + ((Math.floor(px / tileSize) * 7 + i * 11) % 22);
      const gy = py + 8 + ((Math.floor(py / tileSize) * 5 + i * 7) % 18);
      ctx.fillRect(gx, gy, 2, 4);
    }
  }

  // Scale sprite proportionally to fit within the tile, bottom-aligned
  const scaleX = tileSize / ref.sw;
  const scaleY = tileSize / ref.sh;
  const scale = Math.min(scaleX, scaleY);
  const dw = ref.sw * scale;
  const dh = ref.sh * scale;
  const dx = px + (tileSize - dw) / 2;  // center horizontally
  const dy = py + (tileSize - dh);       // bottom-align

  ctx.drawImage(img, ref.sx, ref.sy, ref.sw, ref.sh, dx, dy, dw, dh);
  return true;
}

// ── Multi-tile tree overlay drawing ─────────────────────────────────
export function drawTreeOverlay(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  tileSize: number,
): boolean {
  if (!loaded) return false;

  const img = cache.treeRound;
  if (!img) return false;

  // Pick variant: 0=green, 1=yellow-green (skip bare/icy)
  const variant = ((tileX * 7 + tileY * 13) % 2);
  const srcX = variant * 52;
  const srcY = 0;
  const srcW = 48;
  const srcH = 96;

  const scale = 1.4;
  const drawW = srcW * scale;
  const drawH = srcH * scale;

  const px = tileX * tileSize + tileSize / 2 - drawW / 2;
  const py = tileY * tileSize + tileSize - drawH;

  ctx.drawImage(img, srcX, srcY, srcW, srcH, px, py, drawW, drawH);
  return true;
}

export function isTreeTop(type: number): boolean {
  return type === T.TREE_TOP;
}
