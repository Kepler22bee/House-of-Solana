"use client";
import { useRef, useEffect, useCallback, useState } from "react";
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
import { CoinTossGame } from "../games/coin-toss";
import { BlackjackGame } from "../games/blackjack";
import AgentForge from "../games/factory/AgentForge";
import { MultiplayerGame } from "../games/multiplayer";

interface DialogueState {
  active: boolean;
  npc: NPC | null;
  line: number;
}

interface TileDialogueState {
  active: boolean;
  lines: string[];
  line: number;
}

interface GameScreenState {
  active: boolean;
  type: "coin_toss" | "blackjack" | "factory" | "multiplayer" | null;
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

export let playerMoney = 0; // loaded from on-chain Player.balance

export function setPlayerMoney(value: number) {
  playerMoney = value;
}

export const MOCK_AGENTS: AgentData[] = [
  {
    name: "Clanker",
    bodyColor: "#d4a030",
    hairColor: "#6a6a6a",
    skinColor: "#88ccff",
    status: "active",
    abilities: ["Bet Advisor", "Pattern Recognition", "Risk Analysis", "Auto-Play Mode"],
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

// Yuki's NPC name for matching
const YUKI_NAME = "Dealer Yuki";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<Player>(createPlayer());
  const keysRef = useRef<Set<string>>(new Set());
  const dialogueRef = useRef<DialogueState>({ active: false, npc: null, line: 0 });
  const tileDialogueRef = useRef<TileDialogueState>({ active: false, lines: [], line: 0 });
  const gameScreenRef = useRef<GameScreenState>({ active: false, type: null });
  const introRef = useRef<IntroState>({ active: false, line: 0, dismissed: true });
  const lastTimeRef = useRef<number>(0);
  const sceneRef = useRef<Scene>("casino");
  const casinoIntroRef = useRef<IntroState>({ active: false, line: 0, dismissed: false });
  const agentMenuRef = useRef<AgentMenuState>({ active: false, tab: "agents", selectedAgent: 0, scrollOffset: 0 });
  const overworldPosRef = useRef<{ x: number; y: number }>({ x: 41 * TILE_SIZE, y: 34 * TILE_SIZE });
  const companionRef = useRef<Companion>(createCompanion(playerRef.current));

  // React state for game overlays (so React components render)
  const [activeGameScreen, setActiveGameScreen] = useState<"coin_toss" | "blackjack" | "factory" | "multiplayer" | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [clankerBet, setClankerBet] = useState<{ choice: number; autoFlip: boolean } | null>(null);
  const aiChatInputRef = useRef<HTMLInputElement>(null);

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
    // Spawn right in front of the Blackjack Dealer (x=27, y=8)
    playerRef.current.x = 27 * TILE_SIZE;
    playerRef.current.y = 9 * TILE_SIZE;
    playerRef.current.direction = "up";
    sceneRef.current = "casino";
    companionRef.current.x = playerRef.current.x - TILE_SIZE;
    companionRef.current.y = playerRef.current.y;
    casinoIntroRef.current = { active: true, line: 0, dismissed: false };
  }, []);

  const switchToOverworld = useCallback(() => {
    // Restore overworld position
    playerRef.current.x = overworldPosRef.current.x;
    playerRef.current.y = overworldPosRef.current.y;
    playerRef.current.direction = "down";
    sceneRef.current = "overworld";
    companionRef.current.x = playerRef.current.x - TILE_SIZE;
    companionRef.current.y = playerRef.current.y;
  }, []);

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
      dialogueRef.current.line++;
      if (dialogueRef.current.line >= dialogueRef.current.npc.dialogue.length) {
        const npcName = dialogueRef.current.npc.name;
        dialogueRef.current = { active: false, npc: null, line: 0 };
        // After Yuki's dialogue ends, enter casino
        if (npcName === YUKI_NAME && sceneRef.current === "overworld") {
          switchToCasino();
        }
        // After Coin Toss Dealer's dialogue ends, open coin toss game
        if (npcName === "Coin Toss Dealer" && sceneRef.current === "casino") {
          gameScreenRef.current = { active: true, type: "coin_toss" };
          setActiveGameScreen("coin_toss");
        }
        // After Blackjack Dealer's dialogue ends, open blackjack game
        if (npcName === "Blackjack Dealer" && sceneRef.current === "casino") {
          gameScreenRef.current = { active: true, type: "blackjack" };
          setActiveGameScreen("blackjack");
        }
        // After Factory Host's dialogue ends, open factory game browser
        if (npcName === "Agent Forge" && sceneRef.current === "casino") {
          gameScreenRef.current = { active: true, type: "factory" };
          setActiveGameScreen("factory");
        }
        // After Table Master's dialogue ends, open multiplayer lobby
        if (npcName === "Table Master" && sceneRef.current === "casino") {
          gameScreenRef.current = { active: true, type: "multiplayer" };
          setActiveGameScreen("multiplayer");
        }
        return;
      }
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
        dialogueRef.current = { active: true, npc, line: 0 };
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

      // Casino stairs — bouncer blocks you
      if (tile === TileType.CASINO_STAIRS && sceneRef.current === "casino") {
        if (playerMoney >= 5000) {
          tileDialogueRef.current = { active: true, lines: [
            "You have enough points! Welcome upstairs, high roller.",
            "The upper floor awaits... (Coming Soon)",
          ], line: 0 };
        } else {
          dialogueRef.current = { active: true, npc: {
            x: playerRef.current.x,
            y: playerRef.current.y - 40,
            name: "Bouncer Kaz",
            dialogue: [
              "Hold it right there.",
              "The upper floor is for high rollers only.",
              `You need 5000 points. You have ${playerMoney}.`,
              "Go win some games and come back when you're worthy.",
            ],
            color: "#2c3e50",
            hairColor: "#1a1a1a",
          }, line: 0 };
        }
        return;
      }

      if (info?.interactable && interactions[tile]) {
        tileDialogueRef.current = { active: true, lines: interactions[tile], line: 0 };
      }
    }
  }, [getActiveNpcs, getActiveMap, getActiveInteractions, switchToCasino, switchToOverworld]);

  useEffect(() => {
    loadAllSprites();
    loadTiledMap();
    loadTiledCasino();
    loadCompanionSprite();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current.add(e.key);
      if (e.key === "b" || e.key === "B") {
        // Don't toggle if AI chat input is focused (let user type 'b')
        if (document.activeElement?.tagName === "INPUT") return;
        setAiChatOpen(prev => !prev);
        return;
      }
      if (e.key === "Escape") {
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
          dialogueRef.current = { active: false, npc: null, line: 0 };
          if (npcName === YUKI_NAME && sceneRef.current === "overworld") {
            switchToCasino();
          }
          if (npcName === "Coin Toss Dealer" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "coin_toss" };
            setActiveGameScreen("coin_toss");
          }
          if (npcName === "Blackjack Dealer" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "blackjack" };
            setActiveGameScreen("blackjack");
          }
          if (npcName === "Agent Forge" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "factory" };
            setActiveGameScreen("factory");
          }
          if (npcName === "Table Master" && sceneRef.current === "casino") {
            gameScreenRef.current = { active: true, type: "multiplayer" };
            setActiveGameScreen("multiplayer");
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
        let cumulY = 0;
        for (let i = 0; i < agents.length; i++) {
          const agent = agents[i];
          const rowH = Math.max(80, 44 + agent.abilities.length * 16 + 24);
          const rowY = contentY + cumulY;
          if (rowY + rowH > panelY + panelH - 20) break;

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

      // Auto-exit casino when walking into exit zone
      if (sceneRef.current === "casino" && casinoTiledReady() && !blocked) {
        const ptx = Math.floor((playerRef.current.x + TILE_SIZE / 2) / TILE_SIZE);
        const pty = Math.floor((playerRef.current.y + TILE_SIZE / 2) / TILE_SIZE);
        if (isInCasinoExit(ptx, pty)) {
          switchToOverworld();
        }
        // Bouncer blocks VIP zone at the top
        if (isInVipZone(ptx, pty) && !dialogueRef.current.active) {
          // Push player back down
          playerRef.current.y = 3 * TILE_SIZE;
          dialogueRef.current = { active: true, npc: {
            x: playerRef.current.x,
            y: playerRef.current.y - 40,
            name: "Bouncer Kaz",
            dialogue: [
              "Hold it right there.",
              "The upper floor is for high rollers only.",
              `You need 5000 points. You have ${playerMoney}.`,
              "Go win some games and come back when you're worthy.",
            ],
            color: "#2c3e50",
            hairColor: "#1a1a1a",
          }, line: 0 };
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
    };
  }, [tryInteract, getActiveMap, getActiveNpcs]);

  const closeGameScreen = useCallback(() => {
    gameScreenRef.current = { active: false, type: null };
    setActiveGameScreen(null);
    setClankerBet(null);
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
      const systemPrompt = `You are Clanker, a small rusty robot companion in a blockchain casino game called "House of Solana". You follow the player everywhere inside Fortune Falls — a neon-lit casino town.

CONTEXT:
- The player is currently in the ${scene}.
- Casino has two games: Coin Toss (heads/tails, double-or-nothing, uses VRF for randomness) and Price Prediction (coming soon).
- There's a Clanker House in the overworld where the player can upgrade you (Neural Boost, Memory Bank, Turbo Core, Quantum Chip — all coming soon).
- The casino has a VIP upper floor guarded by Bouncer Kaz — need 5000 points to enter.
- The game runs on Solana with SPL token bets and on-chain game logic.
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
          agent: "clanker",
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
        <CoinTossGame onClose={closeGameScreen} initialChoice={clankerBet?.choice ?? null} autoFlip={clankerBet?.autoFlip ?? false} />
      )}
      {activeGameScreen === "blackjack" && (
        <BlackjackGame onClose={closeGameScreen} />
      )}
      {activeGameScreen === "factory" && (
        <AgentForge onClose={closeGameScreen} />
      )}
      {activeGameScreen === "multiplayer" && (
        <MultiplayerGame onClose={closeGameScreen} />
      )}
      {aiChatOpen && (
        <div style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 280,
          background: "linear-gradient(180deg, #1a0a0a 0%, #0e0808 100%)",
          borderTop: "2px solid #ff4444",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Courier New', monospace",
          zIndex: 1000,
          boxShadow: "0 -4px 20px rgba(136,204,255,0.2)",
        }}>
          {/* Header */}
          <div style={{
            padding: "8px 20px",
            borderBottom: "1px solid rgba(136,204,255,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <span style={{ fontSize: 22 }}>⚙️</span>
            <span style={{ color: "#ff4444", fontWeight: "bold", fontSize: 18 }}>T-800</span>
            <span style={{ color: "#4a6a8a", fontSize: 12 }}>CLANKER AI</span>
          </div>
          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}>
            {aiChatMessages.length === 0 && (
              <div style={{ color: "#4a6a8a", fontSize: 16, textAlign: "center", marginTop: 20, fontWeight: "bold" }}>
                *scanning* I&apos;m T-800. Clanker unit online.<br />Ask me anything, human.
              </div>
            )}
            {aiChatMessages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                background: m.role === "user" ? "#2a4a6a" : "#1a2a3e",
                border: `1px solid ${m.role === "user" ? "#3a6a9a" : "#88ccff44"}`,
                borderRadius: 8,
                padding: "8px 14px",
                maxWidth: "85%",
                fontSize: 16,
                fontWeight: "bold",
                color: m.role === "user" ? "#cde" : "#ff6666",
                lineHeight: 1.5,
              }}>
                {m.role === "assistant" && <span style={{ marginRight: 4 }}>⚙️</span>}
                {m.text}
              </div>
            ))}
            {aiChatLoading && (
              <div style={{ color: "#ff4444", fontSize: 16, fontWeight: "bold", fontStyle: "italic" }}>
                ....clanking
              </div>
            )}
          </div>
          {/* Input */}
          <div style={{
            padding: "8px 20px 12px",
            borderTop: "1px solid rgba(136,204,255,0.3)",
            display: "flex",
            gap: 8,
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
              placeholder="Ask Wall-E..."
              autoFocus
              style={{
                flex: 1,
                background: "#0a1020",
                border: "1px solid #3a5a7a",
                borderRadius: 6,
                padding: "6px 10px",
                color: "#cde",
                fontSize: 12,
                fontFamily: "'Courier New', monospace",
                outline: "none",
              }}
            />
            <button
              onClick={sendAiChat}
              disabled={aiChatLoading}
              style={{
                background: aiChatLoading ? "#2a3a4a" : "#d4a030",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                color: "#1a1a2e",
                fontWeight: "bold",
                fontSize: 12,
                cursor: aiChatLoading ? "default" : "pointer",
                fontFamily: "'Courier New', monospace",
              }}
            >Send</button>
            <button
              onClick={() => setAiChatOpen(false)}
              style={{
                background: "#88ccff22",
                border: "1px solid #88ccff",
                color: "#88ccff",
                borderRadius: 6,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold",
                fontFamily: "'Courier New', monospace",
              }}
            >CLOSE</button>
          </div>
        </div>
      )}
    </>
  );
}
