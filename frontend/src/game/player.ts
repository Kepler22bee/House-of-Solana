import { TILE_SIZE, TILE_INFO, TileType } from "./tiles";
import { gameMap, MAP_WIDTH, MAP_HEIGHT } from "./map";
import { isCollision as tiledIsCollision, tiledMapReady, TILED_MAP_WIDTH, TILED_MAP_HEIGHT } from "./tiledMap";
import { casinoIsCollision, casinoTiledReady, CASINO_MAP_W, CASINO_MAP_H } from "./tiledCasino";

export interface MapData {
  map: number[][];
  width: number;
  height: number;
  scene?: "overworld" | "casino";
}

export type Direction = "down" | "up" | "left" | "right";

export interface Player {
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
  speed: number;
  animFrame: number;
  animTimer: number;
}

export function createPlayer(): Player {
  return {
    x: 27 * TILE_SIZE,
    y: 30 * TILE_SIZE,
    direction: "up",
    moving: false,
    speed: 3,
    animFrame: 0,
    animTimer: 0,
  };
}

export function updatePlayer(
  player: Player,
  keys: Set<string>,
  dt: number,
  mapData?: MapData,
): void {
  const scene = mapData?.scene ?? "overworld";
  const useTiledOverworld = scene === "overworld" && tiledMapReady();
  const useTiledCasino = scene === "casino" && casinoTiledReady();
  const useTiled = useTiledOverworld || useTiledCasino;
  const activeMap = mapData?.map ?? gameMap;
  const activeW = useTiledOverworld ? TILED_MAP_WIDTH : useTiledCasino ? CASINO_MAP_W : (mapData?.width ?? MAP_WIDTH);
  const activeH = useTiledOverworld ? TILED_MAP_HEIGHT : useTiledCasino ? CASINO_MAP_H : (mapData?.height ?? MAP_HEIGHT);

  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
    dy = -1;
    player.direction = "up";
  }
  if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
    dy = 1;
    player.direction = "down";
  }
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) {
    dx = -1;
    player.direction = "left";
  }
  if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) {
    dx = 1;
    player.direction = "right";
  }

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }

  player.moving = dx !== 0 || dy !== 0;

  if (player.moving) {
    const hitboxPadding = 6;

    const testXLeft = player.x + dx * player.speed + hitboxPadding;
    const testXRight = player.x + dx * player.speed + TILE_SIZE - hitboxPadding;
    const canMoveX = !isBlocked(testXLeft, player.y + hitboxPadding, testXRight, player.y + TILE_SIZE - hitboxPadding, activeMap, activeW, activeH, useTiled);

    const testYTop = player.y + dy * player.speed + hitboxPadding;
    const testYBottom = player.y + dy * player.speed + TILE_SIZE - hitboxPadding;
    const canMoveY = !isBlocked(player.x + hitboxPadding, testYTop, player.x + TILE_SIZE - hitboxPadding, testYBottom, activeMap, activeW, activeH, useTiled);

    if (canMoveX) player.x += dx * player.speed;
    if (canMoveY) player.y += dy * player.speed;

    player.x = Math.max(0, Math.min(player.x, (activeW - 1) * TILE_SIZE));
    player.y = Math.max(0, Math.min(player.y, (activeH - 1) * TILE_SIZE));

    player.animTimer += dt;
    if (player.animTimer > 120) {
      player.animFrame = (player.animFrame + 1) % FRAMES_PER_DIR;
      player.animTimer = 0;
    }
  } else {
    player.animFrame = 0;
    player.animTimer = 0;
  }
}

function isBlocked(left: number, top: number, right: number, bottom: number, map: number[][], mapW: number, mapH: number, useTiled: boolean = false): boolean {
  if (useTiled) {
    const corners = [
      { x: Math.floor(left / TILE_SIZE), y: Math.floor(top / TILE_SIZE) },
      { x: Math.floor(right / TILE_SIZE), y: Math.floor(top / TILE_SIZE) },
      { x: Math.floor(left / TILE_SIZE), y: Math.floor(bottom / TILE_SIZE) },
      { x: Math.floor(right / TILE_SIZE), y: Math.floor(bottom / TILE_SIZE) },
    ];
    const collisionFn = mapW === CASINO_MAP_W ? casinoIsCollision : tiledIsCollision;
    return corners.some((c) => collisionFn(c.x, c.y));
  }

  const tiles = [
    getTileAt(left, top, map, mapW, mapH),
    getTileAt(right, top, map, mapW, mapH),
    getTileAt(left, bottom, map, mapW, mapH),
    getTileAt(right, bottom, map, mapW, mapH),
  ];

  return tiles.some((t) => {
    if (t === null) return true;
    return TILE_INFO[t as TileType]?.solid ?? false;
  });
}

function getTileAt(px: number, py: number, map: number[][], mapW: number, mapH: number): number | null {
  const tx = Math.floor(px / TILE_SIZE);
  const ty = Math.floor(py / TILE_SIZE);
  if (tx < 0 || tx >= mapW || ty < 0 || ty >= mapH) return null;
  return map[ty][tx];
}

export function getFacingTile(player: Player): { tx: number; ty: number } {
  const cx = Math.floor((player.x + TILE_SIZE / 2) / TILE_SIZE);
  const cy = Math.floor((player.y + TILE_SIZE / 2) / TILE_SIZE);

  switch (player.direction) {
    case "up": return { tx: cx, ty: cy - 1 };
    case "down": return { tx: cx, ty: cy + 1 };
    case "left": return { tx: cx - 1, ty: cy };
    case "right": return { tx: cx + 1, ty: cy };
  }
}

export function getOverworldMapData(): MapData {
  return { map: gameMap, width: MAP_WIDTH, height: MAP_HEIGHT };
}

/* ── Memao Fantasy Sprite Pack (Galv format) ── */
// Each sheet: 528×328, 8 cols × 4 rows
// Frame size: 66×82
// Row order: 0=down, 1=left, 2=right, 3=up

export const FRAME_W = 66;
export const FRAME_H = 82;
export const FRAMES_PER_DIR = 8;

export const DIR_ROW: Record<Direction, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

// 10 unique characters
export const CHAR_COUNT = 10;

function loadImg(src: string): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  const img = new Image();
  img.src = src;
  return img;
}

// Load all 10 character sheets
export const charSheets: (HTMLImageElement | null)[] = [];
for (let i = 1; i <= CHAR_COUNT; i++) {
  charSheets.push(loadImg(`/characters/char${i}.png`));
}

// Player uses char1
const PLAYER_SHEET_IDX = 0;

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, camX: number, camY: number) {
  const px = Math.round(player.x - camX);
  const py = Math.round(player.y - camY);
  const drawSize = TILE_SIZE;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(px + drawSize / 2, py + drawSize - 2, drawSize * 0.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  const sheet = charSheets[PLAYER_SHEET_IDX];
  if (!sheet || !sheet.complete) return;

  const row = DIR_ROW[player.direction];
  const frame = player.moving ? (player.animFrame % FRAMES_PER_DIR) : 0;
  const srcX = frame * FRAME_W;
  const srcY = row * FRAME_H;

  ctx.drawImage(sheet, srcX, srcY, FRAME_W, FRAME_H, px, py - 10, drawSize, drawSize + 10);
}
