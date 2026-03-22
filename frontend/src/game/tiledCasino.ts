// Tiled JSON renderer for the casino interior
import { TILE_SIZE } from "./tiles";

export const CASINO_MAP_W = 30;
export const CASINO_MAP_H = 30;

interface TiledTileset {
  name: string;
  firstgid: number;
  tilecount: number;
  columns: number;
  tilewidth: number;
  tileheight: number;
  image: string;
}

interface TiledLayer {
  name: string;
  data: number[];
  width: number;
  height: number;
  visible: boolean;
}

interface TiledMapData {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  tilesets: TiledTileset[];
}

let mapData: TiledMapData | null = null;
let tilesetImages: Map<string, HTMLImageElement> = new Map();
let collisionMap: boolean[][] | null = null;
let ready = false;
let loading = false;

// Exit zone: very bottom of the casino map
export const CASINO_EXIT = { x: 13, y: 28, w: 4, h: 2 };

// VIP stairs zone: top of the casino — bouncer blocks access
export const CASINO_VIP_ZONE = { x: 10, y: 0, w: 10, h: 3 };

export function isInVipZone(tileX: number, tileY: number): boolean {
  return (
    tileX >= CASINO_VIP_ZONE.x &&
    tileX < CASINO_VIP_ZONE.x + CASINO_VIP_ZONE.w &&
    tileY >= CASINO_VIP_ZONE.y &&
    tileY < CASINO_VIP_ZONE.y + CASINO_VIP_ZONE.h
  );
}

export function casinoTiledReady(): boolean {
  return ready;
}

export async function loadTiledCasino(): Promise<void> {
  if (ready || loading) return;
  loading = true;

  try {
    const resp = await fetch("/casino.json");
    mapData = await resp.json();
    if (!mapData) return;

    const promises: Promise<void>[] = [];
    for (const ts of mapData.tilesets) {
      promises.push(
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            tilesetImages.set(ts.name, img);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load casino tileset: ${ts.image}`);
            resolve();
          };
          img.src = ts.image;
        })
      );
    }
    await Promise.all(promises);

    buildCollisionMap();
    ready = true;
  } catch (e) {
    console.error("Failed to load tiled casino:", e);
  }
}

function buildCollisionMap(): void {
  if (!mapData) return;

  const w = mapData.width;
  const h = mapData.height;
  // No collision inside casino — player can walk freely
  collisionMap = Array.from({ length: h }, () => Array(w).fill(false));

  // Only block the map edges so the player can't walk off-screen
  for (let tx = 0; tx < w; tx++) {
    collisionMap![0][tx] = true;
    collisionMap![h - 1][tx] = true;
  }
  for (let ty = 0; ty < h; ty++) {
    collisionMap![ty][0] = true;
    collisionMap![ty][w - 1] = true;
  }
}

export function casinoIsCollision(tileX: number, tileY: number): boolean {
  if (!collisionMap) return true;
  if (tileX < 0 || tileY < 0 || tileX >= CASINO_MAP_W || tileY >= CASINO_MAP_H) return true;
  return collisionMap[tileY][tileX];
}

export function isInCasinoExit(tileX: number, tileY: number): boolean {
  return (
    tileX >= CASINO_EXIT.x &&
    tileX < CASINO_EXIT.x + CASINO_EXIT.w &&
    tileY >= CASINO_EXIT.y &&
    tileY < CASINO_EXIT.y + CASINO_EXIT.h
  );
}

function findTileset(gid: number): TiledTileset | null {
  if (!mapData) return null;
  for (const ts of mapData.tilesets) {
    if (ts.firstgid <= gid && gid < ts.firstgid + ts.tilecount) {
      return ts;
    }
  }
  return null;
}

export function drawTiledCasino(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  canvasW: number,
  canvasH: number,
): void {
  if (!mapData || !ready) return;

  const srcTileW = mapData.tilewidth;
  const srcTileH = mapData.tileheight;

  const startTX = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const startTY = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const endTX = Math.min(mapData.width, Math.ceil((camX + canvasW) / TILE_SIZE) + 1);
  const endTY = Math.min(mapData.height, Math.ceil((camY + canvasH) / TILE_SIZE) + 1);

  for (const layer of mapData.layers) {
    if (!layer.visible) continue;
    const w = layer.width;

    for (let ty = startTY; ty < endTY; ty++) {
      for (let tx = startTX; tx < endTX; tx++) {
        const idx = ty * w + tx;
        const gid = layer.data[idx];
        if (gid === 0) continue;

        const ts = findTileset(gid);
        if (!ts) continue;

        const img = tilesetImages.get(ts.name);
        if (!img) continue;

        const localId = gid - ts.firstgid;
        const col = localId % ts.columns;
        const row = Math.floor(localId / ts.columns);
        const srcX = col * srcTileW;
        const srcY = row * srcTileH;

        const destX = tx * TILE_SIZE;
        const destY = ty * TILE_SIZE;

        ctx.drawImage(
          img,
          srcX, srcY, srcTileW, srcTileH,
          destX, destY, TILE_SIZE, TILE_SIZE,
        );
      }
    }
  }

  // Draw VIP stairs marker at top
  const vx = CASINO_VIP_ZONE.x * TILE_SIZE;
  const vy = CASINO_VIP_ZONE.y * TILE_SIZE;
  const vw = CASINO_VIP_ZONE.w * TILE_SIZE;
  const vh = CASINO_VIP_ZONE.h * TILE_SIZE;
  const vGlow = Math.sin(Date.now() / 600) * 0.3 + 0.6;
  // Stairs pattern
  ctx.fillStyle = `rgba(233, 30, 99, ${vGlow * 0.15})`;
  ctx.fillRect(vx, vy, vw, vh);
  // Stair lines
  ctx.strokeStyle = `rgba(233, 30, 99, ${vGlow * 0.4})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const sy = vy + vh - i * (vh / 4);
    ctx.beginPath();
    ctx.moveTo(vx, sy);
    ctx.lineTo(vx + vw, sy);
    ctx.stroke();
  }
  // Arrow pointing up
  ctx.save();
  ctx.font = "bold 12px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(233, 30, 99, ${vGlow})`;
  const arrowBob = Math.sin(Date.now() / 400) * 3;
  ctx.fillText("▲ VIP UPSTAIRS ▲", vx + vw / 2, vy + vh / 2 + 4 + arrowBob);
  ctx.restore();

  // Draw exit marker
  const ex = CASINO_EXIT.x * TILE_SIZE;
  const ey = CASINO_EXIT.y * TILE_SIZE;
  const ew = CASINO_EXIT.w * TILE_SIZE;
  const eh = CASINO_EXIT.h * TILE_SIZE;
  const glow = Math.sin(Date.now() / 500) * 0.3 + 0.5;
  ctx.fillStyle = `rgba(255, 215, 0, ${glow * 0.15})`;
  ctx.fillRect(ex, ey, ew, eh);
  ctx.save();
  ctx.font = "bold 10px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(255, 215, 0, ${glow})`;
  ctx.fillText("EXIT", ex + ew / 2, ey + eh / 2 + 4);
  ctx.restore();
}
