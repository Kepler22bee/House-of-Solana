"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  getSessionKeypair,
  callCreateTemplate,
  callStartFactoryGame,
  callPlayerChoice,
  waitForSessionUpdate,
  fetchPlayer,
  toFriendlyError,
} from "../../lib/solana";

interface AgentForgeProps {
  onClose: () => void;
  onTemplateCreated?: (id: number) => void;
}

interface ChatMsg {
  agent: "clanker" | "player";
  text: string;
}

type ForgePhase = "idle" | "negotiating" | "agreed" | "deploying" | "deployed" | "playing" | "played" | "error";

const GAME_TYPES = [
  { label: "DICE", icon: "⚄", prompt: "a dice-based casino game" },
  { label: "CARDS", icon: "♠", prompt: "a card-based casino game" },
  { label: "SLOTS", icon: "◈", prompt: "a slot machine game" },
  { label: "NUMBER", icon: "#", prompt: "a number guessing game" },
];

function parseStepsFromAgreement(messages: ChatMsg[]): any[] | null {
  const allText = messages.map(m => m.text).join("\n");
  const jsonMatch = allText.match(/\[[\s\S]*?\{[\s\S]*?(?:rollDice|dealCards|randomNumber|spinSlots|payout|lose|checkThreshold)[\s\S]*?\}[\s\S]*?\]/i);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
  }
  return [
    { rollDice: { sides: 6, count: 2, to: { player: {} } } },
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 9 } },
    { payout: { multiplierBps: 30000 } },
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 6 } },
    { payout: { multiplierBps: 20000 } },
    { lose: {} },
  ];
}

const PIXEL_BORDER = "4px solid";
const PX = {
  bg: "#0a0a0a",
  panel: "#111118",
  cyan: "#00d2ff",
  orange: "#ff8c00",
  green: "#33ff33",
  red: "#ff3333",
  gold: "#ffd700",
  dim: "#333344",
  text: "#aabbcc",
  font: "'Press Start 2P', 'Courier New', monospace",
};

const KEYFRAMES = `
@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scanline {
  0% { background-position: 0 0; }
  100% { background-position: 0 4px; }
}
@keyframes crtFlicker {
  0% { opacity: 0.97; }
  5% { opacity: 1; }
  10% { opacity: 0.98; }
  100% { opacity: 1; }
}
`;

export default function AgentForge({ onClose, onTemplateCreated }: AgentForgeProps) {
  const keypair = getSessionKeypair();
  const [phase, setPhase] = useState<ForgePhase>("idle");
  const [gameType, setGameType] = useState<number | null>(null);
  const [strategy, setStrategy] = useState<"greedy" | "safu" | null>(null);
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [gameName, setGameName] = useState("");
  const [deployedTemplateId, setDeployedTemplateId] = useState<number | null>(null);
  const [playLog, setPlayLog] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [waitingForEnter, setWaitingForEnter] = useState(false);
  const enterResolveRef = useRef<(() => void) | null>(null);

  const waitForEnter = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      enterResolveRef.current = resolve;
      setWaitingForEnter(true);
    });
  }, []);

  useEffect(() => {
    if (!waitingForEnter) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        setWaitingForEnter(false);
        enterResolveRef.current?.();
        enterResolveRef.current = null;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [waitingForEnter]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const skipTypingRef = useRef(false);

  // Listen for Enter during typing to skip to full text
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && phase === "negotiating" && !waitingForEnter) {
        skipTypingRef.current = true;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, waitingForEnter]);

  const typeMessage = useCallback(async (agent: "clanker" | "player", fullText: string): Promise<void> => {
    skipTypingRef.current = false;
    setChatLog(prev => [...prev, { agent, text: "" }]);
    for (let i = 0; i <= fullText.length; i++) {
      if (skipTypingRef.current) {
        setChatLog(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { agent, text: fullText };
          return updated;
        });
        break;
      }
      await new Promise(r => setTimeout(r, 112));
      setChatLog(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { agent, text: fullText.slice(0, i) };
        return updated;
      });
    }
  }, []);

  const callAI = useCallback(async (agent: "clanker" | "player", messages: { role: string; content: string }[]): Promise<string> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, messages, max_tokens: 150, temperature: 0.9 }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "*bzzt* signal lost...";
    } catch (e) {
      clearTimeout(timeout);
      if (e instanceof Error && e.name === "AbortError") return "*timeout* ...connection dropped. retrying won't help.";
      throw e;
    }
  }, []);

  const startNegotiation = useCallback(async () => {
    if (gameType === null || strategy === null) return;
    setPhase("negotiating");
    setChatLog([]);
    setError(null);

    // Let React render the loading state before blocking on API call
    await new Promise(r => setTimeout(r, 50));

    const gamePrompt = GAME_TYPES[gameType].prompt;
    const history: { role: string; content: string }[] = [];

    const systemClanker = `You are Clanker, a cocky robot designing ${gamePrompt} for a blockchain casino. Talk like a streetwise dealer — short, punchy, no math. Propose game rules in plain english. You want the house to win more often. Say numbers like "roll above 10 to win 3x" not formulas. Give the game a cool name when you agree. Max 40 words per message. Never show calculations.`;

    const playerGoal = strategy === "greedy"
      ? "You want BIG payouts — 5x, 10x multipliers. You'll accept bad odds if the jackpot is fat. Push for bonus rounds and wild multipliers."
      : "You want SAFE wins — 1.5x to 2x payouts that hit often. Push for generous thresholds. Steady money beats big gambles.";

    const systemPlayer = `You are a sharp player AI negotiating ${gamePrompt} with the house. ${playerGoal} Talk casual and short — max 40 words. No math. No formulas. Just vibes and counter-offers.`;

    try {
      history.push({ role: "system", content: systemClanker });
      history.push({ role: "user", content: `Design ${gamePrompt}. Propose.` });
      // Round 1: Clanker proposes
      const c1 = await callAI("clanker", history);
      await typeMessage("clanker", c1);
      await waitForEnter();

      // Round 1: Player counters
      const ph = [{ role: "system", content: systemPlayer }, { role: "user", content: `Clanker: "${c1}"\nCounter-propose.` }];
      const p1 = await callAI("player", ph);
      await typeMessage("player", p1);
      await waitForEnter();

      // Round 2: Clanker revises
      history.push({ role: "assistant", content: c1 });
      history.push({ role: "user", content: `Player: "${p1}"\nRevise.` });
      const c2 = await callAI("clanker", history);
      await typeMessage("clanker", c2);
      await waitForEnter();

      // Round 2: Player evaluates
      ph.push({ role: "assistant", content: p1 });
      ph.push({ role: "user", content: `Clanker revised: "${c2}"\nDEAL or push back?` });
      const p2 = await callAI("player", ph);
      await typeMessage("player", p2);
      await waitForEnter();

      // Round 3: Final
      history.push({ role: "assistant", content: c2 });
      history.push({ role: "user", content: `Player: "${p2}"\nFinal — DEAL? Name the game.` });
      const c3 = await callAI("clanker", history);
      await typeMessage("clanker", c3);

      const m = c3.match(/["']([^"']{3,25})["']|called\s+(\w[\w\s]{2,20}\w)|name[:\s]+(\w[\w\s]{2,20}\w)/i);
      setGameName(m ? (m[1] || m[2] || m[3]).trim() : "Agent Game");
      setPhase("agreed");
    } catch (e) {
      setError("NEGOTIATION FAILED: " + (e instanceof Error ? e.message : String(e)));
      setPhase("error");
    }
  }, [gameType, strategy, callAI, typeMessage, waitForEnter]);

  const deployTemplate = useCallback(async () => {
    setPhase("deploying");
    setError(null);
    try {
      const steps = parseStepsFromAgreement(chatLog);
      if (!steps) throw new Error("Could not parse game rules");
      const templateId = Date.now();
      await callCreateTemplate(keypair, templateId, gameName,
        `AI-forged by Clanker x Player. ${GAME_TYPES[gameType!]?.label || ""}`,
        steps, 100, 2000, 200);
      setDeployedTemplateId(templateId);
      setPhase("deployed");
      onTemplateCreated?.(templateId);
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("error");
    }
  }, [chatLog, gameName, gameType, keypair, onTemplateCreated]);

  const autoPlay = useCallback(async () => {
    if (deployedTemplateId === null) return;
    setPhase("playing");
    setPlayLog([]);

    const log = (msg: string) => setPlayLog(prev => [...prev, msg]);

    try {
      log("> T800 sits at the table...");
      await new Promise(r => setTimeout(r, 800));

      log("> Placing bet: 200 chips");
      await callStartFactoryGame(keypair, deployedTemplateId, 200);

      log("> Waiting for VRF dice roll...");
      const session = await waitForSessionUpdate(keypair);

      const values = session.playerValues || session.sharedValues || [];
      if (values.length > 0) {
        log(`> Results: [${values.join(", ")}]`);
      }

      // Play loop — keep making choices until settled
      let currentSession = session;
      let statusKey = Object.keys(currentSession.status)[0];
      const choiceNames: Record<number, string> = { 0: "HIT", 1: "STAND", 2: "FOLD", 3: "RAISE", 4: "CHECK", 5: "HIGHER", 6: "LOWER", 7: "RED", 8: "BLACK", 9: "ODD", 10: "EVEN" };

      while (statusKey === "waitingForChoice") {
        const pVals = currentSession.playerValues || [];
        const dVals = currentSession.dealerValues || [];
        const sVals = currentSession.sharedValues || [];

        // Ask T800 AI what to do
        log("> T800 is thinking...");
        const gameContext = `Game: "${gameName}". Your values: [${pVals.join(",")}]. Dealer: [${dVals.join(",")}]. Shared: [${sVals.join(",")}]. Available choices: ${Object.entries(choiceNames).map(([k,v]) => v).join(", ")}. ${strategy === "greedy" ? "You play aggressive — go for big wins." : "You play safe — minimize risk."}`;

        const aiResponse = await callAI("player", [
          { role: "system", content: "You are T800, an AI playing a casino game. Respond with ONLY the choice name (one word like HIT, STAND, HIGHER, LOWER, CHECK, FOLD, RED, BLACK). Nothing else. Pick based on the game state and your strategy." },
          { role: "user", content: gameContext },
        ]);

        // Parse AI choice
        const aiText = aiResponse.toUpperCase().trim();
        let pick = 4; // default CHECK
        for (const [bit, name] of Object.entries(choiceNames)) {
          if (aiText.includes(name)) { pick = parseInt(bit); break; }
        }

        log(`> T800 chooses: ${choiceNames[pick]}`);
        await callPlayerChoice(keypair, deployedTemplateId, pick);

        currentSession = await waitForSessionUpdate(keypair);
        statusKey = Object.keys(currentSession.status)[0];

        const newVals = currentSession.playerValues || currentSession.sharedValues || [];
        if (newVals.length > 0) log(`> Values: [${newVals.join(", ")}]`);
      }

      if (statusKey === "settled") {
        const mult = currentSession.resultMultiplierBps || 0;
        if (mult > 0) {
          log(`> WIN! Payout: ${(mult / 100).toFixed(1)}x`);
        } else {
          log("> LOST. House takes the bet.");
        }
      }

      const player = await fetchPlayer(keypair);
      if (player) {
        log(`> Chip balance: ${player.balance}`);
      }

      setPhase("played");
    } catch (e) {
      log(`> ERROR: ${toFriendlyError(e)}`);
      setPhase("played");
    }
  }, [deployedTemplateId, keypair]);

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.95)",
        outline: "none", animation: "fadeIn 0.3s",
        fontFamily: PX.font, imageRendering: "pixelated",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div style={{
        width: 800, maxWidth: "95vw", maxHeight: "90vh", minHeight: "70vh",
        background: PX.bg,
        border: `${PIXEL_BORDER} ${PX.cyan}`,
        borderRadius: 0,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        boxShadow: `0 0 0 3px ${PX.bg}, 0 0 0 6px ${PX.dim}, 0 0 30px rgba(0,210,255,0.15)`,
      }}>
        {/* Scanline overlay */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10,
          background: "repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)",
        }} />

        {/* Header */}
        <div style={{
          padding: "10px 16px",
          background: PX.panel,
          borderBottom: `${PIXEL_BORDER} ${PX.dim}`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ color: PX.cyan, fontSize: 15, fontWeight: "bold", letterSpacing: 3 }}>
              {">"} AGENT_FORGE.exe
            </div>
            <div style={{ color: PX.dim, fontSize: 13, marginTop: 2, letterSpacing: 1 }}>
              TWO AIs NEGOTIATE // ONE GAME EMERGES
            </div>
          </div>
          <button onClick={onClose} style={{
            background: PX.red, color: "#fff", border: `2px solid #ff6666`,
            borderRadius: 0, padding: "3px 10px", cursor: "pointer",
            fontFamily: PX.font, fontSize: 14, fontWeight: "bold",
          }}>[X]</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "12px 16px" }}>

          {/* IDLE: Select game type */}
          {phase === "idle" && (
            <div>
              <div style={{ color: PX.text, fontSize: 14, marginBottom: 12, textAlign: "center", letterSpacing: 1 }}>
                {">"} SELECT GAME TYPE TO FORGE
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16,
              }}>
                {GAME_TYPES.map((g, i) => (
                  <button key={i} onClick={() => setGameType(i)} style={{
                    padding: "14px 8px", cursor: "pointer",
                    border: `${PIXEL_BORDER} ${gameType === i ? PX.cyan : PX.dim}`,
                    borderRadius: 0,
                    background: gameType === i ? "rgba(0,210,255,0.08)" : PX.panel,
                    color: gameType === i ? PX.cyan : PX.text,
                    fontFamily: PX.font, fontSize: 13, fontWeight: "bold",
                    letterSpacing: 2, textAlign: "center",
                    transition: "none",
                  }}>
                    <div style={{ fontSize: 14, marginBottom: 4 }}>{g.icon}</div>
                    {g.label}
                  </button>
                ))}
              </div>
              {gameType !== null && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: PX.text, fontSize: 8, marginBottom: 8, textAlign: "center", letterSpacing: 1 }}>
                    {">"} CHOOSE YOUR STRATEGY
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button onClick={() => setStrategy("greedy")} style={{
                      padding: "12px 8px", cursor: "pointer",
                      border: `${PIXEL_BORDER} ${strategy === "greedy" ? PX.red : PX.dim}`,
                      borderRadius: 0,
                      background: strategy === "greedy" ? "rgba(255,51,51,0.1)" : PX.panel,
                      color: strategy === "greedy" ? PX.red : PX.text,
                      fontFamily: PX.font, fontSize: 9, fontWeight: "bold",
                      letterSpacing: 1, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>🔥</div>
                      GREEDY
                      <div style={{ fontSize: 7, color: PX.dim, marginTop: 4 }}>HIGH RISK HIGH REWARD</div>
                    </button>
                    <button onClick={() => setStrategy("safu")} style={{
                      padding: "12px 8px", cursor: "pointer",
                      border: `${PIXEL_BORDER} ${strategy === "safu" ? PX.green : PX.dim}`,
                      borderRadius: 0,
                      background: strategy === "safu" ? "rgba(51,255,51,0.1)" : PX.panel,
                      color: strategy === "safu" ? PX.green : PX.text,
                      fontFamily: PX.font, fontSize: 9, fontWeight: "bold",
                      letterSpacing: 1, textAlign: "center",
                    }}>
                      <div style={{ fontSize: 16, marginBottom: 4 }}>🛡️</div>
                      SAFU
                      <div style={{ fontSize: 7, color: PX.dim, marginTop: 4 }}>SAFE AND STEADY</div>
                    </button>
                  </div>
                </div>
              )}

              {gameType !== null && strategy !== null && (
                <button onClick={startNegotiation} style={{
                  display: "block", width: "100%", padding: "12px",
                  border: `${PIXEL_BORDER} ${PX.green}`,
                  borderRadius: 0, background: "rgba(51,255,51,0.08)",
                  color: PX.green, fontFamily: PX.font, fontSize: 13,
                  fontWeight: "bold", cursor: "pointer", letterSpacing: 2,
                }}>
                  {">"} START_NEGOTIATION
                </button>
              )}
            </div>
          )}

          {/* NEGOTIATION CHAT */}
          {(phase === "negotiating" || phase === "agreed" || phase === "error") && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {chatLog.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 8,
                    flexDirection: msg.agent === "player" ? "row-reverse" : "row",
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, flexShrink: 0,
                      border: `2px solid ${msg.agent === "clanker" ? PX.cyan : PX.orange}`,
                      borderRadius: 0,
                      background: msg.agent === "clanker" ? "rgba(0,210,255,0.1)" : "rgba(255,140,0,0.1)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 15, imageRendering: "pixelated",
                    }}>
                      {msg.agent === "clanker" ? "C" : "P"}
                    </div>
                    {/* Message bubble */}
                    <div style={{
                      maxWidth: "78%",
                      border: `2px solid ${msg.agent === "clanker" ? PX.cyan : PX.orange}`,
                      borderRadius: 0,
                      background: PX.panel, padding: "8px 10px",
                    }}>
                      <div style={{
                        fontSize: 14, letterSpacing: 2, marginBottom: 3, fontWeight: "bold",
                        color: msg.agent === "clanker" ? PX.cyan : PX.orange,
                      }}>
                        {msg.agent === "clanker" ? "CLANKER // HOUSE" : "T800 // PLAYER"}
                      </div>
                      <div style={{ color: PX.text, fontSize: 14, lineHeight: 1.6 }}>
                        {msg.text}
                        {/* Blinking cursor while typing */}
                        {phase === "negotiating" && i === chatLog.length - 1 && (
                          <span style={{ animation: "blink 0.7s step-end infinite", color: PX.cyan }}>_</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {waitingForEnter && (
                  <div style={{
                    textAlign: "center", color: PX.gold, fontSize: 11,
                    letterSpacing: 2, padding: "8px 0",
                    animation: "blink 1.2s step-end infinite",
                  }}>
                    {">"} PRESS ENTER TO CONTINUE
                  </div>
                )}
                {phase === "negotiating" && !waitingForEnter && (
                  <div style={{ textAlign: "center", color: PX.cyan, fontSize: 9, letterSpacing: 1, padding: "8px 0", animation: "blink 1s step-end infinite" }}>
                    {chatLog.length === 0 ? "> CONNECTING TO AGENTS..." : "> THINKING..."}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* DEAL REACHED */}
              {phase === "agreed" && (
                <div style={{
                  textAlign: "center",
                  border: `${PIXEL_BORDER} ${PX.green}`,
                  background: "rgba(51,255,51,0.04)",
                  padding: "14px", marginTop: 8,
                }}>
                  <div style={{ color: PX.green, fontSize: 13, fontWeight: "bold", letterSpacing: 2 }}>
                    *** DEAL REACHED ***
                  </div>
                  <div style={{ color: PX.gold, fontSize: 15, marginTop: 6, letterSpacing: 1 }}>
                    GAME: &quot;{gameName}&quot;
                  </div>
                  <button onClick={deployTemplate} style={{
                    marginTop: 12, padding: "10px 24px",
                    border: `${PIXEL_BORDER} ${PX.cyan}`,
                    borderRadius: 0, background: "rgba(0,210,255,0.1)",
                    color: PX.cyan, fontFamily: PX.font, fontSize: 15,
                    fontWeight: "bold", cursor: "pointer", letterSpacing: 2,
                  }}>
                    {">"} DEPLOY_ON_CHAIN
                  </button>
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div style={{
                  border: `${PIXEL_BORDER} ${PX.red}`, background: "rgba(255,51,51,0.05)",
                  padding: "10px", marginTop: 8, textAlign: "center",
                }}>
                  <div style={{ color: PX.red, fontSize: 13, letterSpacing: 1 }}>ERR: {error}</div>
                  <button onClick={() => { setPhase("idle"); setChatLog([]); setError(null); }} style={{
                    marginTop: 8, padding: "6px 16px",
                    border: `2px solid ${PX.red}`, borderRadius: 0,
                    background: "transparent", color: PX.red,
                    fontFamily: PX.font, fontSize: 13, cursor: "pointer",
                  }}>RETRY</button>
                </div>
              )}
            </div>
          )}

          {/* DEPLOYING */}
          {phase === "deploying" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ color: PX.cyan, fontSize: 13, letterSpacing: 2 }}>
                {">"} DEPLOYING &quot;{gameName}&quot;<span style={{ animation: "blink 0.5s step-end infinite" }}>_</span>
              </div>
              <div style={{ color: PX.dim, fontSize: 15, marginTop: 6, letterSpacing: 1 }}>
                WRITING TO SOLANA...
              </div>
            </div>
          )}

          {/* DEPLOYED */}
          {phase === "deployed" && (
            <div style={{ textAlign: "center", padding: "30px 0" }}>
              <div style={{ color: PX.green, fontSize: 15, fontWeight: "bold", letterSpacing: 3, marginBottom: 6 }}>
                GAME DEPLOYED
              </div>
              <div style={{
                border: `${PIXEL_BORDER} ${PX.gold}`, display: "inline-block",
                padding: "6px 16px", marginBottom: 16,
              }}>
                <span style={{ color: PX.gold, fontSize: 13, letterSpacing: 1 }}>&quot;{gameName}&quot;</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={autoPlay} style={{
                  padding: "10px 24px", border: `${PIXEL_BORDER} ${PX.green}`, borderRadius: 0,
                  background: "rgba(51,255,51,0.1)", color: PX.green, fontFamily: PX.font,
                  fontSize: 11, fontWeight: "bold", cursor: "pointer", letterSpacing: 2,
                }}>{">"} LET T800 PLAY</button>
                <button onClick={() => { setPhase("idle"); setChatLog([]); setGameType(null); setStrategy(null); }} style={{
                  padding: "10px 20px", border: `${PIXEL_BORDER} ${PX.dim}`, borderRadius: 0,
                  background: "transparent", color: PX.dim, fontFamily: PX.font,
                  fontSize: 11, cursor: "pointer",
                }}>FORGE AGAIN</button>
              </div>
            </div>
          )}

          {/* PLAYING */}
          {(phase === "playing" || phase === "played") && (
            <div style={{ padding: "16px 0" }}>
              <div style={{ color: PX.cyan, fontSize: 11, fontWeight: "bold", letterSpacing: 2, marginBottom: 12, textAlign: "center" }}>
                T800 PLAYING &quot;{gameName}&quot;
              </div>
              <div style={{
                border: `${PIXEL_BORDER} ${PX.dim}`,
                background: PX.panel, padding: "12px",
                minHeight: 120,
              }}>
                {playLog.map((line, i) => (
                  <div key={i} style={{ color: line.includes("WIN") ? PX.green : line.includes("LOST") || line.includes("ERROR") ? PX.red : PX.text, fontSize: 10, lineHeight: 2, letterSpacing: 1 }}>
                    {line}
                  </div>
                ))}
                {phase === "playing" && (
                  <span style={{ color: PX.cyan, animation: "blink 0.7s step-end infinite" }}>_</span>
                )}
              </div>
              {phase === "played" && (
                <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
                  <button onClick={autoPlay} style={{
                    padding: "8px 20px", border: `${PIXEL_BORDER} ${PX.green}`, borderRadius: 0,
                    background: "transparent", color: PX.green, fontFamily: PX.font,
                    fontSize: 10, fontWeight: "bold", cursor: "pointer",
                  }}>PLAY AGAIN</button>
                  <button onClick={() => { setPhase("idle"); setChatLog([]); setGameType(null); setStrategy(null); setPlayLog([]); }} style={{
                    padding: "8px 20px", border: `${PIXEL_BORDER} ${PX.cyan}`, borderRadius: 0,
                    background: "transparent", color: PX.cyan, fontFamily: PX.font,
                    fontSize: 10, cursor: "pointer",
                  }}>FORGE NEW</button>
                  <button onClick={onClose} style={{
                    padding: "8px 20px", border: `${PIXEL_BORDER} ${PX.dim}`, borderRadius: 0,
                    background: "transparent", color: PX.dim, fontFamily: PX.font,
                    fontSize: 10, cursor: "pointer",
                  }}>CLOSE</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "6px 16px", borderTop: `2px solid ${PX.dim}`,
          background: PX.panel, textAlign: "center",
        }}>
          <span style={{ color: PX.dim, fontSize: 13, letterSpacing: 2 }}>
            ESC TO EXIT
          </span>
        </div>
      </div>
    </div>
  );
}
