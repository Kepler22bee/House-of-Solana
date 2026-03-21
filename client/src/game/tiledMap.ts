// Tiled JSON map renderer for the overworld
import { TILE_SIZE } from "./tiles";

export const TILED_MAP_WIDTH = 50;
export const TILED_MAP_HEIGHT = 50;

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

// Tileset names that are solid: water, rocks
const SOLID_TILESETS = new Set([
  "Water_tiles",
  "Water_animation14",
  "Rocks",
]);

// Tilesets that make a tile walkable (override water/solid below)
const WALKABLE_OVERRIDE_TILESETS = new Set([
  "Bridges",
  "Wall_Tiles",
  "Floors_Tiles",
  "Wall_Variations",
]);

// Tileset names that are solid only on upper layers (buildings/houses)
const STRUCTURE_TILESETS = new Set([
  "house1",
  "house3",
]);

// Casino building footprint on the overworld (tile coordinates)
export const CASINO_BUILDING = {
  x: 37, y: 27, w: 9, h: 7,
  doorX: 41, doorY: 33, // door tile (just below building)
};

export function tiledMapReady(): boolean {
  return ready;
}

export async function loadTiledMap(): Promise<void> {
  if (ready || loading) return;
  loading = true;

  try {
    const resp = await fetch("/overworld.json");
    mapData = await resp.json();
    if (!mapData) return;

    // Load all tileset images
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
            console.warn(`Failed to load tileset: ${ts.image}`);
            resolve();
          };
          img.src = ts.image;
        })
      );
    }
    await Promise.all(promises);

    // Build collision map
    buildCollisionMap();
    ready = true;
  } catch (e) {
    console.error("Failed to load tiled map:", e);
  }
}

function buildCollisionMap(): void {
  if (!mapData) return;

  const w = mapData.width;
  const h = mapData.height;
  collisionMap = Array.from({ length: h }, () => Array(w).fill(false));

  // Process layers bottom-to-top; walkable overrides (bridges etc.) clear collision
  for (let layerIdx = 0; layerIdx < mapData.layers.length; layerIdx++) {
    const layer = mapData.layers[layerIdx];
    const layerNum = parseInt(layer.name.replace("Tile Layer ", ""), 10);
    const isUpperLayer = layerNum >= 3;

    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;

      const tx = i % w;
      const ty = Math.floor(i / w);

      const ts = findTileset(gid);
      if (!ts) continue;

      // Walkable overrides (bridges, paths) clear collision from layers below
      if (WALKABLE_OVERRIDE_TILESETS.has(ts.name)) {
        collisionMap![ty][tx] = false;
        continue;
      }

      // Always-solid tilesets
      if (SOLID_TILESETS.has(ts.name)) {
        collisionMap![ty][tx] = true;
        continue;
      }

      // Structure tilesets are solid on upper layers
      if (isUpperLayer && STRUCTURE_TILESETS.has(ts.name)) {
        collisionMap![ty][tx] = true;
      }
    }
  }

  // Add casino building collision (solid except door)
  const cb = CASINO_BUILDING;
  for (let ty = cb.y; ty < cb.y + cb.h; ty++) {
    for (let tx = cb.x; tx < cb.x + cb.w; tx++) {
      collisionMap![ty][tx] = true;
    }
  }
  // Door tile is walkable
  collisionMap![cb.doorY][cb.doorX] = false;
}

function findTileset(gid: number): TiledTileset | null {
  if (!mapData) return null;
  // Find the tileset where firstgid <= gid and gid < firstgid + tilecount
  let result: TiledTileset | null = null;
  for (const ts of mapData.tilesets) {
    if (ts.firstgid <= gid && gid < ts.firstgid + ts.tilecount) {
      result = ts;
      break;
    }
  }
  return result;
}

export function isCollision(tileX: number, tileY: number): boolean {
  if (!collisionMap) return true; // Block movement if map not loaded
  if (tileX < 0 || tileY < 0 || tileX >= TILED_MAP_WIDTH || tileY >= TILED_MAP_HEIGHT) return true;
  return collisionMap[tileY][tileX];
}

export function drawTiledMap(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  canvasW: number,
  canvasH: number,
): void {
  if (!mapData || !ready) return;

  const srcTileW = mapData.tilewidth;
  const srcTileH = mapData.tileheight;

  // Visible tile range
  const startTX = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const startTY = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const endTX = Math.min(mapData.width, Math.ceil((camX + canvasW) / TILE_SIZE) + 1);
  const endTY = Math.min(mapData.height, Math.ceil((camY + canvasH) / TILE_SIZE) + 1);

  // Render layers bottom to top
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
}

// Get minimap color for a tile position based on the tiled map
export function getTiledMinimapColor(tx: number, ty: number): string {
  if (!mapData) return "#5a8f3c";

  // Casino building shows as dark purple on minimap
  const cb = CASINO_BUILDING;
  if (tx >= cb.x && tx < cb.x + cb.w && ty >= cb.y && ty < cb.y + cb.h) {
    if (tx === cb.doorX && ty === cb.doorY) return "#DAA520"; // door gold
    return "#2a1f3d";
  }

  // Check layers top to bottom, return color of first non-empty tile
  for (let i = mapData.layers.length - 1; i >= 0; i--) {
    const layer = mapData.layers[i];
    const idx = ty * layer.width + tx;
    const gid = layer.data[idx];
    if (gid === 0) continue;

    const ts = findTileset(gid);
    if (!ts) continue;

    const name = ts.name;
    if (name === "Water_tiles" || name === "Water_animation14") return "#3498db";
    if (name === "Wall_Tiles" || name === "Wall_Variations") return "#8d6e63";
    if (name === "Rocks") return "#78909c";
    if (name === "Vegetation") return "#4caf50";
    if (name === "Floors_Tiles") return "#5a8f3c";
    if (name === "Size_02" || name === "Size_03") return "#2e7d32";
    if (name === "Bridges") return "#8d6e63";
    if (name === "Props") return "#a1887f";
    if (name === "Roofs") return "#6d4c41";
    if (name === "exterior" || name === "house1" || name === "house3") return "#795548";
    if (name === "tent1" || name === "tent2") return "#c8a882";

    return "#5a8f3c";
  }

  return "#5a8f3c";
}
