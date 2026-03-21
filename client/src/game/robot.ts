import { Player } from "./player";
import { TILE_SIZE } from "./tiles";

export interface Robot {
  x: number;
  y: number;
  animFrame: number;
  animTimer: number;
  eyeBlink: number;
  // Following offset — robot stays to the right-behind the player
  followDelay: { x: number; y: number }[];
}

const FOLLOW_DISTANCE = 28; // pixels behind player
const FOLLOW_BUFFER_SIZE = 18; // frames of delay
const LERP_SPEED = 0.08;

export function createRobot(player: Player): Robot {
  return {
    x: player.x + TILE_SIZE,
    y: player.y + TILE_SIZE / 2,
    animFrame: 0,
    animTimer: 0,
    eyeBlink: 0,
    followDelay: Array(FOLLOW_BUFFER_SIZE).fill({ x: player.x + TILE_SIZE, y: player.y + TILE_SIZE / 2 }),
  };
}

export function updateRobot(robot: Robot, player: Player, dt: number): void {
  // Push current player position to the delay buffer
  robot.followDelay.push({ x: player.x, y: player.y });
  if (robot.followDelay.length > FOLLOW_BUFFER_SIZE) {
    robot.followDelay.shift();
  }

  // Target = delayed player position with offset
  const target = robot.followDelay[0];
  const targetX = target.x + FOLLOW_DISTANCE;
  const targetY = target.y + 4;

  // Smooth follow with lerp
  robot.x += (targetX - robot.x) * LERP_SPEED;
  robot.y += (targetY - robot.y) * LERP_SPEED;

  // Animation
  const dist = Math.abs(targetX - robot.x) + Math.abs(targetY - robot.y);
  if (dist > 2) {
    robot.animTimer += dt;
    if (robot.animTimer > 120) {
      robot.animFrame = (robot.animFrame + 1) % 4;
      robot.animTimer = 0;
    }
  } else {
    robot.animFrame = 0;
  }

  // Random blink
  robot.eyeBlink -= dt;
  if (robot.eyeBlink <= 0) {
    robot.eyeBlink = 2000 + Math.random() * 4000;
  }
}

export function drawRobot(ctx: CanvasRenderingContext2D, robot: Robot, player: Player) {
  const px = Math.round(robot.x);
  const py = Math.round(robot.y);

  const isBlinking = robot.eyeBlink < 150;
  const bob = Math.sin(robot.animFrame * Math.PI / 2) * 1.5;
  const treadOffset = robot.animFrame % 2 === 0 ? 0 : 1;

  ctx.save();

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.15)";
  ctx.beginPath();
  ctx.ellipse(px + 12, py + 28, 9, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Treads (tank tracks) — two dark rectangles at bottom
  ctx.fillStyle = "#3a3a3a";
  ctx.fillRect(px + 2, py + 22 - bob, 8, 7);
  ctx.fillRect(px + 14, py + 22 - bob, 8, 7);
  // Tread detail lines
  ctx.fillStyle = "#2a2a2a";
  ctx.fillRect(px + 3, py + 23 + treadOffset - bob, 6, 1);
  ctx.fillRect(px + 3, py + 25 + treadOffset - bob, 6, 1);
  ctx.fillRect(px + 15, py + 23 + treadOffset - bob, 6, 1);
  ctx.fillRect(px + 15, py + 25 + treadOffset - bob, 6, 1);

  // Body — boxy, warm yellow-brown (Wall-E color)
  ctx.fillStyle = "#d4a030";
  ctx.fillRect(px + 3, py + 10 - bob, 18, 13);
  // Body detail — darker panel lines
  ctx.fillStyle = "#b88820";
  ctx.fillRect(px + 3, py + 10 - bob, 18, 2);
  ctx.fillRect(px + 3, py + 21 - bob, 18, 2);
  // Body center panel (lighter)
  ctx.fillStyle = "#e8b840";
  ctx.fillRect(px + 6, py + 13 - bob, 12, 7);

  // Neck — thin connector
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(px + 9, py + 6 - bob, 6, 5);

  // Head — binocular eyes (Wall-E's iconic look)
  // Eye housing left
  ctx.fillStyle = "#6a6a6a";
  ctx.beginPath();
  ctx.arc(px + 7, py + 5 - bob, 5, 0, Math.PI * 2);
  ctx.fill();
  // Eye housing right
  ctx.beginPath();
  ctx.arc(px + 17, py + 5 - bob, 5, 0, Math.PI * 2);
  ctx.fill();

  // Eye connector bar
  ctx.fillStyle = "#555";
  ctx.fillRect(px + 7, py + 3 - bob, 10, 4);

  // Eye lenses (white/blue)
  if (isBlinking) {
    // Blink — just thin lines
    ctx.fillStyle = "#4488cc";
    ctx.fillRect(px + 4, py + 5 - bob, 6, 1);
    ctx.fillRect(px + 14, py + 5 - bob, 6, 1);
  } else {
    // Open eyes — bright blue
    ctx.fillStyle = "#88ccff";
    ctx.beginPath();
    ctx.arc(px + 7, py + 5 - bob, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 17, py + 5 - bob, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pupils — look toward player
    const lookX = player.x < robot.x ? -1 : player.x > robot.x + 10 ? 1 : 0;
    ctx.fillStyle = "#1a3355";
    ctx.fillRect(px + 6 + lookX, py + 4 - bob, 2, 2);
    ctx.fillRect(px + 16 + lookX, py + 4 - bob, 2, 2);

    // Eye shine
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(px + 5, py + 3 - bob, 1, 1);
    ctx.fillRect(px + 15, py + 3 - bob, 1, 1);
  }

  // Arms — small grabber arms on sides
  const armSwing = Math.sin(robot.animFrame * Math.PI / 2) * 2;
  ctx.fillStyle = "#8a8a8a";
  ctx.fillRect(px + 0, py + 12 - bob + armSwing, 3, 8);
  ctx.fillRect(px + 21, py + 12 - bob - armSwing, 3, 8);
  // Grabber claws
  ctx.fillStyle = "#666";
  ctx.fillRect(px - 1, py + 19 - bob + armSwing, 4, 2);
  ctx.fillRect(px + 21, py + 19 - bob - armSwing, 4, 2);

  // Proximity indicator — show [B] hint when near player
  const dist = Math.sqrt(
    Math.pow(player.x - robot.x, 2) + Math.pow(player.y - robot.y, 2)
  );
  if (dist < 100) {
    const hintBob = Math.sin(Date.now() / 400) * 2;
    ctx.font = "bold 8px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(px + 12 - 12, py - 10 + hintBob, 24, 10);
    ctx.fillStyle = "#88ccff";
    ctx.fillText("[B]", px + 12, py - 3 + hintBob);
  }

  ctx.restore();
}
