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
    // Check collision for the player hitbox (smaller than tile)
    const hitboxPadding = 6;

    // Check X movement
    const testXLeft = player.x + dx * player.speed + hitboxPadding;
    const testXRight = player.x + dx * player.speed + TILE_SIZE - hitboxPadding;
    const canMoveX = !isBlocked(testXLeft, player.y + hitboxPadding, testXRight, player.y + TILE_SIZE - hitboxPadding, activeMap, activeW, activeH, useTiled);

    // Check Y movement
    const testYTop = player.y + dy * player.speed + hitboxPadding;
    const testYBottom = player.y + dy * player.speed + TILE_SIZE - hitboxPadding;
    const canMoveY = !isBlocked(player.x + hitboxPadding, testYTop, player.x + TILE_SIZE - hitboxPadding, testYBottom, activeMap, activeW, activeH, useTiled);

    if (canMoveX) player.x += dx * player.speed;
    if (canMoveY) player.y += dy * player.speed;

    // Clamp to map bounds
    player.x = Math.max(0, Math.min(player.x, (activeW - 1) * TILE_SIZE));
    player.y = Math.max(0, Math.min(player.y, (activeH - 1) * TILE_SIZE));

    // Animation
    player.animTimer += dt;
    if (player.animTimer > 150) {
      player.animFrame = (player.animFrame + 1) % 4;
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
    // Use the correct collision function based on map size
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

// Default overworld map data helper
export function getOverworldMapData(): MapData {
  return { map: gameMap, width: MAP_WIDTH, height: MAP_HEIGHT };
}

export function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, camX: number, camY: number) {
  const px = Math.round(player.x - camX);
  const py = Math.round(player.y - camY);

  const bobY = player.moving ? Math.sin(player.animFrame * Math.PI / 2) * 2 : 0;

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(px + 16, py + 30, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  const legOffset = player.moving ? Math.sin(player.animFrame * Math.PI / 2) * 3 : 0;
  ctx.fillStyle = "#4a3728";
  ctx.fillRect(px + 8 - legOffset, py + 24 - bobY, 6, 8);
  ctx.fillRect(px + 18 + legOffset, py + 24 - bobY, 6, 8);

  // Body (red cloak)
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(px + 6, py + 12 - bobY, 20, 14);
  // Cloak center
  ctx.fillStyle = "#e74c3c";
  ctx.fillRect(px + 10, py + 12 - bobY, 12, 14);

  // Arms
  const armSwing = player.moving ? Math.sin(player.animFrame * Math.PI / 2) * 4 : 0;
  ctx.fillStyle = "#c0392b";
  ctx.fillRect(px + 2, py + 14 - bobY + armSwing, 5, 10);
  ctx.fillRect(px + 25, py + 14 - bobY - armSwing, 5, 10);

  // Head
  ctx.fillStyle = "#ffcc99";
  ctx.fillRect(px + 8, py + 2 - bobY, 16, 12);

  // Hair (white/silver)
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(px + 6, py + 0 - bobY, 20, 6);
  ctx.fillRect(px + 5, py + 2 - bobY, 3, 8);
  ctx.fillRect(px + 24, py + 2 - bobY, 3, 8);

  // Eyes based on direction
  ctx.fillStyle = "#2d1b4e";
  switch (player.direction) {
    case "down":
      ctx.fillRect(px + 10, py + 7 - bobY, 3, 3);
      ctx.fillRect(px + 19, py + 7 - bobY, 3, 3);
      break;
    case "up":
      // Show back of head
      ctx.fillStyle = "#f5f5f5";
      ctx.fillRect(px + 8, py + 2 - bobY, 16, 10);
      break;
    case "left":
      ctx.fillRect(px + 9, py + 7 - bobY, 3, 3);
      break;
    case "right":
      ctx.fillRect(px + 20, py + 7 - bobY, 3, 3);
      break;
  }

  // Belt
  ctx.fillStyle = "#8d6e63";
  ctx.fillRect(px + 7, py + 22 - bobY, 18, 3);
  ctx.fillStyle = "#fdd835";
  ctx.fillRect(px + 14, py + 22 - bobY, 4, 3);
}
