// Robot Fighter companion that follows the player
import { Player } from "./player";
import { TILE_SIZE } from "./tiles";

const FRAME_W = 64;
const FRAME_H = 64;
const COLS = 6;
// Row 0 = idle, Row 5 = walk
const IDLE_ROW = 0;
const WALK_ROW = 5;
const IDLE_FRAMES = 6;
const WALK_FRAMES = 6;

const FOLLOW_DIST = TILE_SIZE * 1.2; // how far behind to stay
const FOLLOW_SPEED = 3.5;
const ANIM_INTERVAL = 150;

let spriteImg: HTMLImageElement | null = null;
let loaded = false;

export interface Companion {
  x: number;
  y: number;
  animFrame: number;
  animTimer: number;
  moving: boolean;
  facingLeft: boolean;
}

export function createCompanion(player: Player): Companion {
  return {
    x: player.x - TILE_SIZE,
    y: player.y,
    animFrame: 0,
    animTimer: 0,
    moving: false,
    facingLeft: false,
  };
}

export function loadCompanionSprite(): void {
  if (loaded || spriteImg) return;
  const img = new Image();
  img.onload = () => {
    spriteImg = img;
    loaded = true;
  };
  img.onerror = () => {
    console.warn("Failed to load robotFighter.png");
  };
  img.src = "/robotFighter.png";
}

export function updateCompanion(companion: Companion, player: Player, dt: number): void {
  const dx = player.x - companion.x;
  const dy = player.y - companion.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > FOLLOW_DIST) {
    // Move toward the player but stop at FOLLOW_DIST * 0.6
    const targetDist = FOLLOW_DIST * 0.6;
    const moveX = (dx / dist) * FOLLOW_SPEED;
    const moveY = (dy / dist) * FOLLOW_SPEED;

    companion.x += moveX;
    companion.y += moveY;
    companion.moving = true;

    // Face direction of movement
    if (Math.abs(moveX) > 0.5) {
      companion.facingLeft = moveX < 0;
    }
  } else {
    companion.moving = false;
  }

  // Animation
  companion.animTimer += dt;
  if (companion.animTimer > ANIM_INTERVAL) {
    const maxFrames = companion.moving ? WALK_FRAMES : IDLE_FRAMES;
    companion.animFrame = (companion.animFrame + 1) % maxFrames;
    companion.animTimer = 0;
  }
}

export function drawCompanion(ctx: CanvasRenderingContext2D, companion: Companion): void {
  if (!spriteImg || !loaded) return;

  const row = companion.moving ? WALK_ROW : IDLE_ROW;
  const srcX = companion.animFrame * FRAME_W;
  const srcY = row * FRAME_H;

  // Draw at roughly tile size (48x48) from the 64x64 source frames
  const drawSize = TILE_SIZE;
  const drawX = Math.round(companion.x);
  const drawY = Math.round(companion.y - drawSize * 0.15); // slight vertical offset

  ctx.save();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(drawX + drawSize / 2, drawY + drawSize - 4, 10, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flip horizontally if facing left
  if (companion.facingLeft) {
    ctx.translate(drawX + drawSize, drawY);
    ctx.scale(-1, 1);
    ctx.drawImage(spriteImg, srcX, srcY, FRAME_W, FRAME_H, 0, 0, drawSize, drawSize);
  } else {
    ctx.drawImage(spriteImg, srcX, srcY, FRAME_W, FRAME_H, drawX, drawY, drawSize, drawSize);
  }

  ctx.restore();
}
