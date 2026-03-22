"use client";
import { useRef, useEffect, useCallback, useState } from "react";
import { useAccount } from "@starknet-react/core";
import { createPlayer, updatePlayer, Player, getFacingTile, MapData } from "./player";
import { renderGame, SceneData } from "./renderer";
import { npcs, NPC, gameMap, MAP_WIDTH, MAP_HEIGHT, tileInteractions } from "./map";
import { casinoMap, CASINO_MAP_WIDTH, CASINO_MAP_HEIGHT, casinoNpcs, casinoTileInteractions } from "./casino-map";
import { TILE_INFO, TileType, TILE_SIZE } from "./tiles";
// Robot disabled — using fe companion instead
// import { createRobot, updateRobot, Robot } from "./robot";
import { loadAllSprites } from "./sprites";
import { loadTiledMap, CASINO_BUILDING } from "./tiledMap";
import { loadTiledCasino, casinoTiledReady, CASINO_MAP_W, CASINO_MAP_H, CASINO_EXIT, isInCasinoExit, isInVipZone } from "./tiledCasino";
import { createCompanion, updateCompanion, loadCompanionSprite, Companion } from "./companion";
import { chatWithNpc, isNpcBored, getGreeting } from "./npc-ai";
import { CoinTossGame } from "../games/coin-toss";
import { PricePredictionGame } from "../games/price-prediction";
import { BlackjackGame } from "../games/blackjack";

interface DialogueState {
  active: boolean;
  npc: NPC | null;
  line: number;
  lines: string[];      // dynamic lines (AI-generated)
  aiLoading: boolean;    // waiting for AI response
}

interface TileDialogueState {
  active: boolean;
  lines: string[];
  line: number;
}

interface GameScreenState {
  active: boolean;
  type: "coin_toss" | "price_prediction" | "blackjack" | null;
}

export interface AgentMenuState {
  active: boolean;
  tab: "agents" | "shop";
  selectedAgent: number;
  scrollOffset: number;
}

export interface AgentData {
  name: string;
  bodyColor: string;
  hairColor: string;
  skinColor: string;
  status: "idle" | "active";
  abilities: string[];
}

export interface ShopPower {
  name: string;
  icon: string;
  description: string;
  cost: number;
}

export const SHOP_POWERS: ShopPower[] = [
  { name: "Neural Boost", icon: "🧠", description: "Upgrade Clanker's prediction accuracy", cost: 500 },
  { name: "Memory Bank", icon: "💾", description: "Clanker remembers more game history", cost: 800 },
  { name: "Turbo Core", icon: "⚡", description: "Faster AI responses and analysis", cost: 1200 },
  { name: "Quantum Chip", icon: "🔮", description: "Unlock advanced pattern detection", cost: 2000 },
];

export let playerMoney = 0;
export let totalWins = 0;
export let clankerPurchased = false;

export const CLANKER_COST = 10; // coins to buy Clanker

// ── Persistence per wallet address ──
let _walletAddr = "";

function storageKey(addr: string) {
  return `hos_progress_${addr}`;
}

export function loadProgress(addr: string) {
  _walletAddr = addr;
  try {
    const raw = localStorage.getItem(storageKey(addr));
    if (raw) {
      const data = JSON.parse(raw);
      playerMoney = data.playerMoney ?? 0;
      totalWins = data.totalWins ?? 0;
      clankerPurchased = data.clankerPurchased ?? false;
      if (clankerPurchased) MOCK_AGENTS[0].status = "active";
    }
  } catch { /* ignore */ }
}

export function saveProgress() {
  if (!_walletAddr) return;
  try {
    localStorage.setItem(storageKey(_walletAddr), JSON.stringify({
      playerMoney,
      totalWins,
      clankerPurchased,
    }));
  } catch { /* ignore */ }
}

export const MOCK_AGENTS: AgentData[] = [
  {
    name: "Clanker",
    bodyColor: "#d4a030",
    hairColor: "#6a6a6a",
    skinColor: "#88ccff",
    status: "idle",
    abilities: ["Bet Advisor", "Pattern Recognition", "Risk Analysis", "Auto-Play Mode"],
  },
  {
    name: "???",
    bodyColor: "#555555",
    hairColor: "#333333",
    skinColor: "#666666",
    status: "idle",
    abilities: ["??????", "???"],
  },
];

interface IntroState {
  active: boolean;
  line: number;
  dismissed: boolean;
}

type Scene = "overworld" | "casino";

const INTRO_LINES = [
  "Welcome to Fortune Falls.",
  "A neon-lit casino town where fortunes are made... and lost.",
  "Two games of chance await you at the Golden Dragon Casino:",
  "Coin Toss — flip coins, double or nothing. Pure luck.",
  "Price Prediction — read the market, bet on direction. Pure skill.",
  "Start by playing the tables yourself. Earn coins. Learn the odds.",
  "Win enough and you'll unlock AI Agents — they play for you.",
  "Agents earn yield even while you sleep. Upgrade them. Specialize them.",
  "Your goal: build an autonomous casino empire.",
  "Talk to Merchant Kai nearby, then head SOUTH to the casino.",
  "Look for the neon lights and the torii gate. Good luck.",
];

const CASINO_INTRO_LINES = [
  "Welcome to the Golden Dragon Casino!",
  "This is where fortunes are won... and lost.",
  "TUTORIAL: Walk up and talk to Bartender Jin ahead.",
  "He'll explain how the games work and get you started.",
  "Use WASD to move. Press E near people to talk.",
  "When you're done, find the EXIT door to leave. Good luck!",
];

const CLANKER_TUTORIAL_LINES = [
  "Nice! You just played your first game.",
  "Now here's the secret weapon: the Clanker Workshop.",
  "Press B to open your Agent Dashboard — view upgrades and abilities.",
  "Press T to chat with Clanker, your AI companion. He can advise on bets!",
  "Tell him 'bet heads' or 'bet tails' and he'll flip the coin for you.",
  "Upgrade Clanker with coins you earn — Neural Boost, Memory Bank, and more.",
  "Head to the Clanker Workshop in the overworld to learn more. Good luck!",
];

// Yuki's NPC name for matching
const YUKI_NAME = "Dealer Yuki";

// ── Audio system ──
const VILLAGE_MUSIC_SRC = "/Village  D&D_TTRPG Ambience  1 Hour - Bardify.mp3";
const CASINO_MUSIC_SRC = "/DANGANRONPA OST 1-27 Climax Reasoning - sharaness.mp3";
const NPC_SOUNDS = [
  "/hi roblox sound effect - TheSoundMachine.mp3",
  "/Num Num Num [ROBLOX] - Dane Guinto.mp3",
];

export default function GameCanvas() {
  const { address } = useAccount();

  // Load persisted progress when wallet connects
  useEffect(() => {
    if (address) loadProgress(address);
  }, [address]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player>(createPlayer());
  const keysRef = useRef<Set<string>>(new Set());
  const dialogueRef = useRef<DialogueState>({ active: false, npc: null, line: 0, lines: [], aiLoading: false });
  const tileDialogueRef = useRef<TileDialogueState>({ active: false, lines: [], line: 0 });
  const gameScreenRef = useRef<GameScreenState>({ active: false, type: null });
  const introRef = useRef<IntroState>({ active: false, line: 0, dismissed: true });
  const lastTimeRef = useRef<number>(0);
  const sceneRef = useRef<Scene>("overworld");
  const casinoIntroRef = useRef<IntroState>({ active: false, line: 0, dismissed: false });
  const agentMenuRef = useRef<AgentMenuState>({ active: false, tab: "agents", selectedAgent: 0, scrollOffset: 0 });
  const overworldPosRef = useRef<{ x: number; y: number }>({ x: 41 * TILE_SIZE, y: 34 * TILE_SIZE });
  const companionRef = useRef<Companion>(createCompanion(playerRef.current));

  // Audio refs
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);
  const currentBgTrackRef = useRef<string>("");
  const npcSoundIndexRef = useRef<number>(0);

  // Track first game completion for Clanker Workshop tutorial
  const hasPlayedFirstGameRef = useRef<boolean>(false);

  // React state for game overlays (so React components render)
  const [activeGameScreen, setActiveGameScreen] = useState<"coin_toss" | "price_prediction" | "blackjack" | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [clankerBet, setClankerBet] = useState<{ choice: number; autoFlip: boolean } | null>(null);
  const [vipImageVisible, setVipImageVisible] = useState(false);
  const vipTimerRef = useRef<number | null>(null);
  const aiChatInputRef = useRef<HTMLInputElement>(null);

  const playBgMusic = useCallback((src: string) => {
    if (currentBgTrackRef.current === src) return;
    if (bgMusicRef.current) {
      bgMusicRef.current.pause();
      bgMusicRef.current = null;
    }
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.4;
    audio.play().catch(() => {}); // autoplay may be blocked until first interaction
    bgMusicRef.current = audio;
    currentBgTrackRef.current = src;
  }, []);

  const playNpcSound = useCallback(() => {
    const src = NPC_SOUNDS[npcSoundIndexRef.current % NPC_SOUNDS.length];
    npcSoundIndexRef.current++;
    const sfx = new Audio(src);
    sfx.volume = 0.6;
    if (src.includes("hi roblox")) {
      sfx.currentTime = 3;
    }
    if (src.includes("Num Num")) {
      sfx.currentTime = 3;
      sfx.addEventListener("timeupdate", () => {
        if (sfx.currentTime >= 6) {
          sfx.pause();
        }
      });
    }
    sfx.play().catch(() => {});
  }, []);

  const getActiveMap = useCallback((): { map: number[][]; width: number; height: number } => {
    if (sceneRef.current === "casino") {
      if (casinoTiledReady()) {
        return { map: casinoMap, width: CASINO_MAP_W, height: CASINO_MAP_H };
      }
      return { map: casinoMap, width: CASINO_MAP_WIDTH, height: CASINO_MAP_HEIGHT };
    }
    return { map: gameMap, width: MAP_WIDTH, height: MAP_HEIGHT };
  }, []);

  const getActiveNpcs = useCallback((): NPC[] => {
    return sceneRef.current === "casino" ? casinoNpcs : npcs;
  }, []);

  const getActiveInteractions = useCallback((): Record<number, string[]> => {
    return sceneRef.current === "casino" ? casinoTileInteractions : tileInteractions;
  }, []);

  const switchToCasino = useCallback(() => {
    overworldPosRef.current = { x: playerRef.current.x, y: playerRef.current.y };
    playerRef.current.x = CASINO_EXIT.x * TILE_SIZE;
    playerRef.current.y = (CASINO_EXIT.y - 2) * TILE_SIZE;
    playerRef.current.direction = "up";
    sceneRef.current = "casino";
    companionRef.current.x = playerRef.current.x - TILE_SIZE;
    companionRef.current.y = playerRef.current.y;
    casinoIntroRef.current = { active: true, line: 0, dismissed: false };
    playBgMusic(CASINO_MUSIC_SRC);
  }, [playBgMusic]);

  const switchToOverworld = useCallback(() => {
    // Restore overworld position
    playerRef.current.x = overworldPosRef.current.x;
    playerRef.current.y = overworldPosRef.current.y;
    playerRef.current.direction = "down";
    sceneRef.current = "overworld";
    companionRef.current.x = playerRef.current.x - TILE_SIZE;
    companionRef.current.y = playerRef.current.y;
    playBgMusic(VILLAGE_MUSIC_SRC);
  }, [playBgMusic]);

  const tryInteract = useCallback(() => {
    // Handle intro first
    if (introRef.current.active) {
      introRef.current.line++;
      if (introRef.current.line >= INTRO_LINES.length) {
        introRef.current = { active: false, line: 0, dismissed: true };
      }
      return;
    }

    // Handle casino intro
    if (casinoIntroRef.current.active) {
      casinoIntroRef.current.line++;
      if (casinoIntroRef.current.line >= CASINO_INTRO_LINES.length) {
        casinoIntroRef.current = { active: false, line: 0, dismissed: true };
      }
      return;
    }

    // Handle game screen dismiss
    if (gameScreenRef.current.active) {
      gameScreenRef.current = { active: false, type: null };
      setActiveGameScreen(null);
      return;
    }

    const player = playerRef.current;

    if (dialogueRef.current.active && dialogueRef.current.npc) {
      const dlg = dialogueRef.current;
      // If AI is loading, ignore E press
      if (dlg.aiLoading) return;

      // If there are more lines to show, advance
      if (dlg.line < dlg.lines.length - 1) {
        dlg.line++;
        return;
      }

      // We're on the last line — fetch next AI line
      const npc = dlg.npc!;
      const npcName = npc.name;

      // Special NPCs that trigger actions — close dialogue and do the action
      const isActionNpc = (npcName === YUKI_NAME && sceneRef.current === "overworld") ||
        (npcName === "Coin Toss Dealer" && sceneRef.current === "casino") ||
        (npcName === "Price Dealer" && sceneRef.current === "casino") ||
        (npcName === "Blackjack Dealer" && sceneRef.current === "casino");

      if (isActionNpc) {
        dialogueRef.current = { active: false, npc: null, line: 0, lines: [], aiLoading: false };
        if (npcName === YUKI_NAME) switchToCasino();
        if (npcName === "Coin Toss Dealer") {
          gameScreenRef.current = { active: true, type: "coin_toss" };
          setActiveGameScreen("coin_toss");
        }
        if (npcName === "Price Dealer") {
          gameScreenRef.current = { active: true, type: "price_prediction" };
          setActiveGameScreen("price_prediction");
        }
        if (npcName === "Blackjack Dealer") {
          gameScreenRef.current = { active: true, type: "blackjack" };
          setActiveGameScreen("blackjack");
        }
        return;
      }

      // Check if NPC is bored
      if (isNpcBored(npcName)) {
        dialogueRef.current = { active: false, npc: null, line: 0, lines: [], aiLoading: false };
        return;
      }

      // Fetch next AI response
      dlg.aiLoading = true;
      dlg.lines.push("...");
      dlg.line = dlg.lines.length - 1;
      chatWithNpc(npc).then((reply) => {
        dlg.lines[dlg.lines.length - 1] = reply;
        dlg.aiLoading = false;
      });
      return;
    }

    if (tileDialogueRef.current.active) {
      tileDialogueRef.current.line++;
      if (tileDialogueRef.current.line >= tileDialogueRef.current.lines.length) {
        tileDialogueRef.current = { active: false, lines: [], line: 0 };
      }
      return;
    }

    // Casino exit — check if player is in the exit zone
    if (sceneRef.current === "casino" && casinoTiledReady()) {
      const ptx = Math.floor((player.x + TILE_SIZE / 2) / TILE_SIZE);
      const pty = Math.floor((player.y + TILE_SIZE / 2) / TILE_SIZE);
      if (isInCasinoExit(ptx, pty)) {
        switchToOverworld();
        return;
      }
    }

    // Casino door entrance — check if player is near the door tile on overworld
    if (sceneRef.current === "overworld") {
      const doorPx = CASINO_BUILDING.doorX * TILE_SIZE;
      const doorPy = CASINO_BUILDING.doorY * TILE_SIZE;
      const dist = Math.sqrt(
        Math.pow(player.x - doorPx, 2) + Math.pow(player.y - doorPy, 2)
      );
      if (dist < 60) {
        switchToCasino();
        return;
      }

    }

    const activeNpcs = getActiveNpcs();
    for (const npc of activeNpcs) {
      const dist = Math.sqrt(
        Math.pow(player.x - npc.x, 2) + Math.pow(player.y - npc.y, 2)
      );
      if (dist < 60) {
        // Bouncer Kaz can't be talked to directly — only triggers from stairs
        if (npc.name === "Bouncer Kaz") continue;
        if (isNpcBored(npc.name)) continue;
        const greeting = getGreeting(npc);
        dialogueRef.current = { active: true, npc, line: 0, lines: [greeting], aiLoading: false };
        playNpcSound();
        return;
      }
    }

    const { map, width, height } = getActiveMap();
    const interactions = getActiveInteractions();
    const { tx, ty } = getFacingTile(player);
    if (ty >= 0 && ty < height && tx >= 0 && tx < width) {
      const tile = map[ty][tx];
      const info = TILE_INFO[tile as TileType];

      // Casino door — enter casino from overworld
      if (tile === TileType.CASINO_DOOR && sceneRef.current === "overworld") {
        switchToCasino();
        return;
      }

      // Casino exit door — go back to overworld
      if (tile === TileType.CASINO_EXIT && sceneRef.current === "casino") {
        switchToOverworld();
        return;
      }

      // Casino stairs — show VIP image
      if (tile === TileType.CASINO_STAIRS && sceneRef.current === "casino") {
        if (!vipImageVisible) {
          setVipImageVisible(true);
          if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
          vipTimerRef.current = window.setTimeout(() => setVipImageVisible(false), 4000);
        }
        return;
      }

      if (info?.interactable && interactions[tile]) {
        tileDialogueRef.current = { active: true, lines: interactions[tile], line: 0 };
      }
    }
  }, [getActiveNpcs, getActiveMap, getActiveInteractions, switchToCasino, switchToOverworld, playNpcSound]);

  useEffect(() => {
    loadAllSprites();
    loadTiledMap();
    loadTiledCasino();
    loadCompanionSprite();
    playBgMusic(VILLAGE_MUSIC_SRC);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === "b" || e.key === "B") {
        // Don't toggle if AI chat input is focused (let user type 'b')
        if (document.activeElement?.tagName === "INPUT") return;
        agentMenuRef.current = agentMenuRef.current.active
          ? { active: false, tab: "agents", selectedAgent: 0, scrollOffset: 0 }
          : { active: true, tab: "agents", selectedAgent: 0, scrollOffset: 0 };
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (document.activeElement?.tagName === "INPUT") return;
        e.preventDefault();
        if (!clankerPurchased) return;
        setAiChatOpen(prev => !prev);
        return;
      }
      if (e.key === "Escape") {
        // Dismiss VIP image
        if (vipImageVisible) {
          setVipImageVisible(false);
          if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
          return;
        }
        // Skip all text / close overlays
        if (introRef.current.active) {
          introRef.current = { active: false, line: 0, dismissed: true };
          return;
        }
        if (casinoIntroRef.current.active) {
          casinoIntroRef.current = { active: false, line: 0, dismissed: true };
          return;
        }
        if (dialogueRef.current.active) {
          const npcName = dialogueRef.current.npc?.name;
          dialogueRef.current = { active: false, npc: null, line: 0, lines: [], aiLoading: false };
          if (npcName === YUKI_NAME && sceneRef.current === "overworld") {
            switchToCasino();
          }
          if (npcName === "Coin Toss Dealer" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "coin_toss" };
            setActiveGameScreen("coin_toss");
          }
          if (npcName === "Price Dealer" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "price_prediction" };
            setActiveGameScreen("price_prediction");
          }
          if (npcName === "Blackjack Dealer" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "blackjack" };
            setActiveGameScreen("blackjack");
          }
          return;
        }
        if (tileDialogueRef.current.active) {
          tileDialogueRef.current = { active: false, lines: [], line: 0 };
          return;
        }
        if (gameScreenRef.current.active) {
          gameScreenRef.current = { active: false, type: null };
          setActiveGameScreen(null);
          return;
        }
        // Close agent menu or chat
        if (agentMenuRef.current.active) {
          agentMenuRef.current = { active: false, tab: "agents", selectedAgent: 0, scrollOffset: 0 };
          return;
        }
        setAiChatOpen(false);
      }
      if (e.key === "e" || e.key === "E" || e.key === "Enter" || e.key === " ") {
        tryInteract();
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current.delete(e.key);
    };

    const handleClick = (e: MouseEvent) => {
      if (!agentMenuRef.current.active) return;

      const mx = e.clientX;
      const my = e.clientY;
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Must match renderer drawAgentMenu layout exactly
      const panelW = Math.min(520, w - 40);
      const panelH = Math.min(420, h - 40);
      const panelX = (w - panelW) / 2;
      const panelY = (h - panelH) / 2;

      // Close button (X) — matches renderer: closeX = panelX + panelW - 36, closeY = tabY + 6, 26x26
      const closeX = panelX + panelW - 36;
      const closeY = panelY + 6;
      if (mx >= closeX && mx <= closeX + 26 && my >= closeY && my <= closeY + 26) {
        agentMenuRef.current = { active: false, tab: "agents", selectedAgent: 0, scrollOffset: 0 };
        return;
      }

      // Tab bar — matches renderer: tabH=38, tabW=(panelW-60)/2, spacing = tabW+6
      const tabH = 38;
      const tabs: { key: AgentMenuState["tab"] }[] = [
        { key: "agents" },
        { key: "shop" },
      ];
      const tabW = (panelW - 60) / tabs.length;
      if (my >= panelY - 6 && my <= panelY + tabH) {
        for (let i = 0; i < tabs.length; i++) {
          const tx = panelX + 10 + i * (tabW + 6);
          if (mx >= tx && mx <= tx + tabW) {
            agentMenuRef.current.tab = tabs[i].key;
            return;
          }
        }
      }

      // Content area — matches renderer: contentY = tabY + tabH + 12
      const contentY = panelY + tabH + 12;

      if (agentMenuRef.current.tab === "agents") {
        const agents = MOCK_AGENTS;
        const contentX = panelX + 16;
        const contentW = panelW - 32;
        const avatarSize = 60;
        let cumulY = 0;
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const rowH = Math.max(80, 44 + agent.abilities.length * 16 + 24);
          const rowY = contentY + cumulY;
          if (rowY + rowH > panelY + panelH - 20) break;

          // Check buy button click for Clanker (agent 0) when not purchased
          if (i === 0 && !clankerPurchased && totalWins >= 2) {
            const btnW = 70;
            const btnH = 28;
            const btnX = contentX + contentW - btnW - 4;
            const btnY = rowY + 4;
            if (mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH) {
              if (playerMoney >= CLANKER_COST) {
                playerMoney -= CLANKER_COST;
                clankerPurchased = true;
                MOCK_AGENTS[0].status = "active";
                saveProgress();
                tileDialogueRef.current = { active: true, lines: [
                  "Clanker activated! *beep boop*",
                  "AI Oracle is now available in coin toss games.",
                  "Press T to chat with Clanker anytime!",
                ], line: 0 };
              }
              return;
            }
          }

          if (my >= rowY && my <= rowY + rowH) {
            agentMenuRef.current.selectedAgent = i;
            return;
          }
          cumulY += rowH + 6;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleClick);

    let animId: number;

    const gameLoop = (timestamp: number) => {
      const dt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
      lastTimeRef.current = timestamp;

      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const { map, width, height } = getActiveMap();
      const currentScene = sceneRef.current;
      const mapData: MapData = { map, width, height, scene: currentScene };

      // Don't move during any dialogue/intro
      const blocked = introRef.current.active || casinoIntroRef.current.active || dialogueRef.current.active || tileDialogueRef.current.active || gameScreenRef.current.active || agentMenuRef.current.active;
      if (!blocked) {
        updatePlayer(playerRef.current, keysRef.current, dt, mapData);
      }
      updateCompanion(companionRef.current, playerRef.current, dt);

      // Auto-enter casino when player walks in front of the door
      if (sceneRef.current === "overworld" && !blocked) {
        const ptx = Math.floor((playerRef.current.x + TILE_SIZE / 2) / TILE_SIZE);
        const pty = Math.floor((playerRef.current.y + TILE_SIZE / 2) / TILE_SIZE);
        if (ptx === CASINO_BUILDING.doorX && pty === CASINO_BUILDING.doorY ) {
          switchToCasino();
        }
      }

      // Auto-exit casino when walking into exit zone
      if (sceneRef.current === "casino" && casinoTiledReady() && !blocked) {
        const ptx = Math.floor((playerRef.current.x + TILE_SIZE / 2) / TILE_SIZE);
        const pty = Math.floor((playerRef.current.y + TILE_SIZE / 2) / TILE_SIZE);
        if (isInCasinoExit(ptx, pty)) {
          switchToOverworld();
        }
        // VIP zone — show image and push back
        if (isInVipZone(ptx, pty) && !vipImageVisible) {
          playerRef.current.y = 3 * TILE_SIZE;
          setVipImageVisible(true);
          if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current);
          vipTimerRef.current = window.setTimeout(() => setVipImageVisible(false), 4000);
        }
      }


      ctx.imageSmoothingEnabled = false;

      const sceneData: SceneData = {
        map,
        mapWidth: width,
        mapHeight: height,
        npcs: getActiveNpcs(),
        scene: sceneRef.current,
      };

      renderGame(
        ctx,
        playerRef.current,
        w,
        h,
        dialogueRef.current,
        tileDialogueRef.current,
        introRef.current.active
          ? { line: introRef.current.line, lines: INTRO_LINES }
          : casinoIntroRef.current.active
            ? { line: casinoIntroRef.current.line, lines: CASINO_INTRO_LINES }
            : null,
        sceneData,
        null, // Game screens are now React overlays, not canvas-drawn
        agentMenuRef.current.active ? agentMenuRef.current : null,
        null, // robot disabled
        companionRef.current,
      );

      animId = requestAnimationFrame(gameLoop);
    };

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClick);
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
        bgMusicRef.current = null;
      }
    };
  }, [tryInteract, getActiveMap, getActiveNpcs, playBgMusic]);

  const closeGameScreen = useCallback(() => {
    gameScreenRef.current = { active: false, type: null };
    setActiveGameScreen(null);
    setClankerBet(null);
    hasPlayedFirstGameRef.current = true;
  }, []);

  // Detect bet commands from user message
  const parseBetCommand = useCallback((msg: string): { choice: number } | null => {
    const lower = msg.toLowerCase().trim();
    // Match patterns like "bet heads", "flip tails", "go heads", "pick tails", "heads", "tails", "bet on heads"
    const headsPatterns = /\b(bet|flip|go|pick|play|call|choose)\b.*\bheads?\b|\bheads?\b.*\b(bet|flip|go|pick|play|call|choose)\b|^heads?$/i;
    const tailsPatterns = /\b(bet|flip|go|pick|play|call|choose)\b.*\btails?\b|\btails?\b.*\b(bet|flip|go|pick|play|call|choose)\b|^tails?$/i;
    if (headsPatterns.test(lower)) return { choice: 0 };
    if (tailsPatterns.test(lower)) return { choice: 1 };
    return null;
  }, []);

  const sendAiChat = useCallback(async () => {
    const msg = aiChatInput.trim();
    if (!msg || aiChatLoading) return;
    setAiChatInput("");
    setAiChatMessages(prev => [...prev, { role: "user", text: msg }]);
    setAiChatLoading(true);

    // Check if this is a direct bet command
    const betCmd = parseBetCommand(msg);
    if (betCmd && sceneRef.current === "casino") {
      const sideName = betCmd.choice === 0 ? "HEADS" : "TAILS";
      setAiChatMessages(prev => [...prev, { role: "assistant", text: `*bzzt* Locking in ${sideName}! Let's flip this coin, boss. *whirr*` }]);
      setAiChatLoading(false);
      // Close chat and open coin toss with auto-flip
      setAiChatOpen(false);
      setClankerBet({ choice: betCmd.choice, autoFlip: true });
      gameScreenRef.current = { active: true, type: "coin_toss" };
      setActiveGameScreen("coin_toss");
      return;
    }

    try {
      const scene = sceneRef.current;
      const systemPrompt = `You are Clanker, a small rusty robot companion in a blockchain casino game called "House of Stark" (built on Starknet/Dojo). You follow the player everywhere inside Fortune Falls — a neon-lit casino town.

CONTEXT:
- The player is currently in the ${scene}.
- Casino has two games: Coin Toss (heads/tails, double-or-nothing, uses VRF for randomness) and Price Prediction (coming soon).
- There's a Clanker House in the overworld where the player can upgrade you (Neural Boost, Memory Bank, Turbo Core, Quantum Chip — all coming soon).
- The casino has a VIP upper floor guarded by Bouncer Kaz — need 5000 points to enter.
- The game runs on Starknet with ERC20 bets and ERC721 game tokens via the EGS (Embeddable Game Standard).
- You were built in the Clanker Workshop. You're proud of it.
- IMPORTANT: You can place bets directly! If the player wants you to bet, tell them to type "bet heads" or "bet tails" and you'll handle it.

PERSONALITY:
- You speak in short, punchy sentences. Sometimes robotic ("*beep*", "*whirr*", "*bzzt*"), always funny.
- You're a degenerate gambler at heart — you love risk, you love chaos, you live for the flip.
- Give actual betting advice when asked (pick heads or tails, suggest strategies, comment on streaks).
- If the player asks you to bet or play for them, remind them they can say "bet heads" or "bet tails" and you'll flip the coin directly.
- When the player asks something vague, off-topic, or nonsensical that you can't answer, reply with something like: "idk bruh... you're supposed to be the higher intelligence species here" or "bro you literally have a whole prefrontal cortex and you're asking ME?" or "my neural net has 4 billion params and even I can't parse that" — be creative, roast them lovingly.
- Never break character. You ARE Clanker.

Keep responses under 60 words.`;
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            ...aiChatMessages.slice(-6).map(m => ({ role: m.role, content: m.text })),
            { role: "user", content: msg },
          ],
          max_tokens: 100,
          temperature: 0.9,
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content ?? "Bzzt... signal lost. Try again!";
      setAiChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
    } catch {
      setAiChatMessages(prev => [...prev, { role: "assistant", text: "*beep boop* Connection error... my antenna must be rusty!" }]);
    } finally {
      setAiChatLoading(false);
    }
  }, [aiChatInput, aiChatLoading, aiChatMessages, parseBetCommand]);

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "#0a0a0a",
          imageRendering: "pixelated",
          cursor: "default",
        }}
      />
      {activeGameScreen === "coin_toss" && (
        <CoinTossGame onClose={closeGameScreen} onResult={(won) => {
          if (won) {
            playerMoney += 5;
            totalWins += 1;
            saveProgress();
            if (totalWins === 2 && !clankerPurchased) {
              // Auto-open agent menu after closing game screen
              setTimeout(() => {
                agentMenuRef.current = { active: true, tab: "agents", selectedAgent: 0, scrollOffset: 0 };
                tileDialogueRef.current = { active: true, lines: [
                  "You've proven yourself at the tables!",
                  "Clanker is available for purchase in the Workshop.",
                  "Buy Clanker to unlock the AI Oracle and auto-play!",
                ], line: 0 };
              }, 500);
            }
          }
        }} oracleUnlocked={clankerPurchased} initialChoice={clankerBet?.choice ?? null} autoFlip={clankerBet?.autoFlip ?? false} />
      )}
      {activeGameScreen === "price_prediction" && (
        <PricePredictionGame onClose={closeGameScreen} />
      )}
      {activeGameScreen === "blackjack" && (
        <BlackjackGame onClose={closeGameScreen} playerCoins={playerMoney} onResult={(won, amount) => {
          if (won) {
            playerMoney += amount;
            totalWins += 1;
          } else {
            playerMoney = Math.max(0, playerMoney - amount);
          }
          saveProgress();
        }} />
      )}
      {aiChatOpen && (
        <div style={{
          position: "fixed",
          top: 60,
          right: 20,
          width: 360,
          height: 440,
          background: "#c8bfa0",
          border: "3px solid #5a5040",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Courier New', monospace",
          zIndex: 1000,
          boxShadow: "4px 4px 0px rgba(0,0,0,0.35)",
        }}>
          {/* Header */}
          <div style={{
            padding: "8px 12px",
            borderBottom: "2px solid #a89878",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
             
              <span style={{ color: "#3a3020", fontWeight: "bold", fontSize: 14 }}>Clanker Chat</span>
              <span style={{ color: "#7a6e58", fontSize: 10 }}>T-800 AI</span>
            </div>
            <button
              onClick={() => setAiChatOpen(false)}
              style={{
                background: "#4a7af5",
                border: "2px solid #3560c0",
                borderRadius: 5,
                width: 26,
                height: 26,
                color: "#fff",
                fontWeight: "bold",
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                padding: 0,
                lineHeight: "22px",
              }}
            >X</button>
          </div>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            background: "#ede6d0",
            margin: "8px 10px 0",
            borderRadius: 6,
            border: "2px solid #a89878",
          }}>
            {aiChatMessages.length === 0 && (
              <div style={{ color: "#7a6e58", fontSize: 12, textAlign: "center", marginTop: 20, fontWeight: "bold" }}>
                *scanning* Clanker unit online.<br />Ask me anything, human.
              </div>
            )}
            {aiChatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#c8bfa0" : "#ddd4b8",
                border: `2px solid ${m.role === "user" ? "#a89878" : "#8a7a50"}`,
                borderRadius: 6,
                padding: "6px 10px",
                maxWidth: "85%",
                fontSize: 12,
                fontWeight: "bold",
                color: m.role === "user" ? "#3a3020" : "#4a4030",
                lineHeight: 1.4,
              }}>
                {m.role === "assistant" && <span style={{ marginRight: 4 }}>⚙️</span>}
                {m.text}
              </div>
            ))}
            {aiChatLoading && (
              <div style={{ color: "#8a7a50", fontSize: 12, fontWeight: "bold", fontStyle: "italic" }}>
                ....clanking
              </div>
            )}
          </div>
          {/* Input */}
          <div style={{
            padding: "8px 10px 10px",
            display: "flex",
            gap: 6,
          }}>
            <input
              ref={aiChatInputRef}
              value={aiChatInput}
              onChange={e => setAiChatInput(e.target.value)}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === "Enter") sendAiChat();
                if (e.key === "Escape") {
                  setAiChatOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Ask Clanker..."
              autoFocus
              style={{
                flex: 1,
                background: "#e8e0c8",
                border: "2px solid #9a9080",
                borderRadius: 4,
                padding: "6px 8px",
                color: "#3a3020",
                fontSize: 12,
                fontWeight: "bold",
                fontFamily: "'Courier New', monospace",
                outline: "none",
              }}
            />
            <button
              onClick={sendAiChat}
              disabled={aiChatLoading}
              style={{
                background: aiChatLoading ? "#a89878" : "#4a7af5",
                border: "2px solid",
                borderColor: aiChatLoading ? "#8a7a50" : "#3560c0",
                borderRadius: 6,
                padding: "6px 12px",
                color: "#fff",
                fontWeight: "bold",
                fontSize: 12,
                cursor: aiChatLoading ? "default" : "pointer",
                fontFamily: "'Courier New', monospace",
              }}
            >Send</button>
          </div>
          {/* Hint */}
          <div style={{
            textAlign: "center",
            fontSize: 10,
            color: "#6a6050",
            paddingBottom: 6,
          }}>Esc: Close &nbsp; Enter: Send</div>
        </div>
      )}
      {vipImageVisible && (
        <div
          onClick={() => { setVipImageVisible(false); if (vipTimerRef.current) window.clearTimeout(vipTimerRef.current); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
            cursor: "pointer",
            animation: "fadeIn 0.3s ease-out",
          }}
        >
          <div style={{ position: "relative", textAlign: "center" }}>
            <img
              src="/vip.png"
              alt="VIP Area"
              style={{
                maxWidth: "80vw",
                maxHeight: "70vh",
                borderRadius: 16,
                border: "3px solid #c8a84e",
                boxShadow: "0 0 40px rgba(253,216,53,0.3)",
              }}
            />
            <p style={{
              color: "#fdd835",
              fontFamily: "'Courier New', monospace",
              fontSize: 14,
              fontWeight: "bold",
              marginTop: 12,
              letterSpacing: "0.1em",
            }}>
              VIP FLOOR &middot; COMING SOON
            </p>
            <p style={{
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'Courier New', monospace",
              fontSize: 11,
              marginTop: 4,
            }}>
              Click or press Esc to dismiss
            </p>
          </div>
        </div>
      )}
    </>
  );
}
