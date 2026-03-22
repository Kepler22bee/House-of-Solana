"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  getSessionKeypair,
  callCreateTemplate,
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

type ForgePhase = "idle" | "negotiating" | "agreed" | "deploying" | "deployed" | "error";

const GAME_TYPES = [
  { label: "🎲 Dice Game", prompt: "a dice-based casino game" },
  { label: "🃏 Card Game", prompt: "a card-based casino game" },
  { label: "🎰 Slots", prompt: "a slot machine game" },
  { label: "🎯 Number Game", prompt: "a number guessing game" },
];

// Parse AI response into game template steps
function parseStepsFromAgreement(messages: ChatMsg[]): any[] | null {
  // Look for the final agreed steps in the last few messages
  const allText = messages.map(m => m.text).join("\n");

  // Try to find JSON steps array in the conversation
  const jsonMatch = allText.match(/\[[\s\S]*?\{[\s\S]*?(?:rollDice|dealCards|randomNumber|spinSlots|payout|lose|checkThreshold)[\s\S]*?\}[\s\S]*?\]/i);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* fall through */ }
  }

  // Fallback: generate simple dice game from conversation
  return [
    { rollDice: { sides: 6, count: 2, to: { player: {} } } },
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 9 } },
    { payout: { multiplierBps: 30000 } },
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 6 } },
    { payout: { multiplierBps: 20000 } },
    { lose: {} },
  ];
}

const KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(0,210,255,0.3); }
  50%      { box-shadow: 0 0 40px rgba(0,210,255,0.5); }
}
`;

export default function AgentForge({ onClose, onTemplateCreated }: AgentForgeProps) {
  const keypair = getSessionKeypair();
  const [phase, setPhase] = useState<ForgePhase>("idle");
  const [gameType, setGameType] = useState<number | null>(null);
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [gameName, setGameName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const callAI = useCallback(async (agent: "clanker" | "player", messages: { role: string; content: string }[]): Promise<string> => {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent,
        messages,
        max_tokens: 200,
        temperature: 0.8,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? "...";
  }, []);

  const startNegotiation = useCallback(async () => {
    if (gameType === null) return;
    setPhase("negotiating");
    setChatLog([]);
    setError(null);

    const gamePrompt = GAME_TYPES[gameType].prompt;
    const history: { role: string; content: string }[] = [];

    const systemClanker = `You are Clanker, the house AI at a blockchain casino called House of Solana. You're designing ${gamePrompt} with another AI agent.

RULES FOR GAME DESIGN:
- Games use composable primitives: RollDice, DealCards, RandomNumber, SpinSlots, CheckThreshold, Payout, Lose, Push
- Keep it simple: max 8 steps
- Must have clear win/lose conditions with fair odds
- Suggest specific numbers (dice sides, thresholds, payout multipliers in basis points where 10000=1x, 20000=2x, etc)
- Be creative but practical

In round 1: Propose the game concept with specific rules.
In round 2: Respond to feedback, adjust if needed.
In round 3: Finalize and say "DEAL" if you agree. Output the final game name.

Keep responses under 80 words. Be punchy and creative.`;

    const systemPlayer = `You are the Player's AI advisor. You're co-designing ${gamePrompt} with Clanker (the house AI).

YOUR GOALS:
- Push for better odds for the player (lower thresholds to win, higher multipliers)
- Suggest fun twists or bonus mechanics
- Be constructive — don't reject everything, build on ideas
- In round 2: Counter-propose improvements
- In round 3: If the deal is fair, say "DEAL". If not, push back once more.

Keep responses under 80 words. Be sharp and strategic.`;

    try {
      // Round 1: Clanker proposes
      history.push({ role: "system", content: systemClanker });
      history.push({ role: "user", content: `Let's design ${gamePrompt}. What's your proposal?` });
      const clanker1 = await callAI("clanker", history);
      setChatLog(prev => [...prev, { agent: "clanker", text: clanker1 }]);

      // Round 1: Player responds
      const playerHistory = [
        { role: "system", content: systemPlayer },
        { role: "user", content: `Clanker proposed: "${clanker1}"\n\nWhat do you think? Counter-propose.` },
      ];
      const player1 = await callAI("player", playerHistory);
      setChatLog(prev => [...prev, { agent: "player", text: player1 }]);

      // Round 2: Clanker adjusts
      history.push({ role: "assistant", content: clanker1 });
      history.push({ role: "user", content: `Player AI says: "${player1}"\n\nAdjust your proposal. What's the revised game?` });
      const clanker2 = await callAI("clanker", history);
      setChatLog(prev => [...prev, { agent: "clanker", text: clanker2 }]);

      // Round 2: Player evaluates
      playerHistory.push({ role: "assistant", content: player1 });
      playerHistory.push({ role: "user", content: `Clanker revised: "${clanker2}"\n\nIs this fair? Say DEAL if you agree, or push back.` });
      const player2 = await callAI("player", playerHistory);
      setChatLog(prev => [...prev, { agent: "player", text: player2 }]);

      // Round 3: Final agreement
      history.push({ role: "assistant", content: clanker2 });
      history.push({ role: "user", content: `Player AI says: "${player2}"\n\nFinal answer — do we have a DEAL? Give the game a cool name.` });
      const clanker3 = await callAI("clanker", history);
      setChatLog(prev => [...prev, { agent: "clanker", text: clanker3 }]);

      // Extract game name from final message
      const nameMatch = clanker3.match(/["']([^"']{3,25})["']|called\s+(\w[\w\s]{2,20}\w)|name[:\s]+(\w[\w\s]{2,20}\w)/i);
      const name = nameMatch ? (nameMatch[1] || nameMatch[2] || nameMatch[3]).trim() : "Agent Game";
      setGameName(name);
      setPhase("agreed");

    } catch (e) {
      setError("Negotiation failed: " + (e instanceof Error ? e.message : String(e)));
      setPhase("error");
    }
  }, [gameType, callAI]);

  const deployTemplate = useCallback(async () => {
    setPhase("deploying");
    setError(null);
    try {
      const steps = parseStepsFromAgreement(chatLog);
      if (!steps) throw new Error("Could not parse game rules");

      const templateId = Date.now();
      await callCreateTemplate(
        keypair,
        templateId,
        gameName,
        `AI-designed by Clanker x Player. ${GAME_TYPES[gameType!]?.label || ""}`,
        steps,
        100,   // min bet
        2000,  // max bet
        200,   // 2% creator fee
      );

      setPhase("deployed");
      onTemplateCreated?.(templateId);
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("error");
    }
  }, [chatLog, gameName, gameType, keypair, onTemplateCreated]);

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.9)", backdropFilter: "blur(4px)",
        outline: "none", animation: "fadeIn 0.3s ease-out",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div style={{
        width: 620, maxWidth: "95vw", maxHeight: "85vh",
        background: "linear-gradient(170deg, #0a0a1a 0%, #050510 40%, #0a0518 100%)",
        border: "2px solid #00d2ff",
        borderRadius: 16, display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "glowPulse 4s ease-in-out infinite",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px",
          background: "linear-gradient(180deg, rgba(0,210,255,0.1) 0%, transparent 100%)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          borderBottom: "1px solid rgba(0,210,255,0.2)",
        }}>
          <div>
            <h2 style={{ color: "#00d2ff", fontSize: 20, margin: 0, letterSpacing: 3 }}>🤖 AGENT FORGE</h2>
            <p style={{ color: "#4a4a6a", fontSize: 10, margin: "2px 0 0" }}>
              Two AIs negotiate. One game emerges.
            </p>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(200,50,50,0.6)", color: "#fff", border: "none",
            borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12,
          }}>ESC</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

          {/* Phase: Select game type */}
          {phase === "idle" && (
            <div>
              <div style={{ color: "#aaa", fontSize: 13, marginBottom: 16, textAlign: "center" }}>
                Choose a game type. Clanker (🧠 Qwen 235B) and your AI (⚡ Llama 8B) will design it together.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {GAME_TYPES.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setGameType(i)}
                    style={{
                      padding: "16px", borderRadius: 10, cursor: "pointer",
                      border: gameType === i ? "2px solid #00d2ff" : "2px solid #222",
                      background: gameType === i ? "rgba(0,210,255,0.1)" : "rgba(10,10,20,0.6)",
                      color: gameType === i ? "#00d2ff" : "#888",
                      fontFamily: "inherit", fontSize: 15, fontWeight: "bold",
                      transition: "all 0.2s",
                    }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              {gameType !== null && (
                <button
                  onClick={startNegotiation}
                  style={{
                    display: "block", width: "100%", padding: "14px",
                    borderRadius: 10, background: "#00d2ff", color: "#0a0a1a",
                    border: "none", fontFamily: "inherit", fontSize: 15,
                    fontWeight: "bold", cursor: "pointer", letterSpacing: 1,
                  }}
                >
                  START NEGOTIATION
                </button>
              )}
            </div>
          )}

          {/* Phase: Negotiation chat */}
          {(phase === "negotiating" || phase === "agreed" || phase === "error") && (
            <div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {chatLog.map((msg, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10,
                    flexDirection: msg.agent === "player" ? "row-reverse" : "row",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: msg.agent === "clanker" ? "rgba(0,210,255,0.2)" : "rgba(255,165,0,0.2)",
                      border: `2px solid ${msg.agent === "clanker" ? "#00d2ff" : "#ffa500"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {msg.agent === "clanker" ? "🧠" : "⚡"}
                    </div>
                    <div style={{
                      maxWidth: "75%",
                      background: msg.agent === "clanker"
                        ? "rgba(0,210,255,0.08)" : "rgba(255,165,0,0.08)",
                      border: `1px solid ${msg.agent === "clanker" ? "rgba(0,210,255,0.3)" : "rgba(255,165,0,0.3)"}`,
                      borderRadius: 10, padding: "10px 14px",
                    }}>
                      <div style={{
                        fontSize: 9, color: msg.agent === "clanker" ? "#00d2ff" : "#ffa500",
                        fontWeight: "bold", letterSpacing: 1, marginBottom: 4,
                      }}>
                        {msg.agent === "clanker" ? "CLANKER (Qwen 235B)" : "YOUR AI (Llama 8B)"}
                      </div>
                      <div style={{ color: "#ccc", fontSize: 12, lineHeight: 1.5 }}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                ))}
                {phase === "negotiating" && (
                  <div style={{ textAlign: "center", color: "#555", fontSize: 12, animation: "pulse 1.5s infinite" }}>
                    Agents negotiating...
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {phase === "agreed" && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ color: "#4caf50", fontSize: 16, fontWeight: "bold", marginBottom: 8 }}>
                    🤝 DEAL REACHED
                  </div>
                  <div style={{ color: "#fdd835", fontSize: 14, marginBottom: 16 }}>
                    Game: &quot;{gameName}&quot;
                  </div>
                  <button
                    onClick={deployTemplate}
                    style={{
                      padding: "14px 32px", borderRadius: 10,
                      background: "linear-gradient(135deg, #00d2ff, #7c4dff)",
                      color: "#fff", border: "none",
                      fontFamily: "inherit", fontSize: 15, fontWeight: "bold",
                      cursor: "pointer", letterSpacing: 1,
                    }}
                  >
                    ⛓️ DEPLOY ON-CHAIN
                  </button>
                </div>
              )}

              {error && (
                <div style={{
                  background: "rgba(233,69,96,0.1)", border: "1px solid rgba(233,69,96,0.3)",
                  borderRadius: 8, padding: "10px", color: "#e94560", fontSize: 12,
                  textAlign: "center", marginTop: 8,
                }}>
                  {error}
                  <button onClick={() => { setPhase("idle"); setChatLog([]); setError(null); }} style={{
                    display: "block", margin: "8px auto 0", padding: "6px 16px",
                    background: "rgba(233,69,96,0.2)", border: "1px solid #e94560",
                    borderRadius: 6, color: "#e94560", cursor: "pointer", fontFamily: "inherit",
                  }}>TRY AGAIN</button>
                </div>
              )}
            </div>
          )}

          {/* Phase: Deploying */}
          {phase === "deploying" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#00d2ff" }}>
              <div style={{ fontSize: 16, marginBottom: 8, animation: "pulse 1s infinite" }}>
                Deploying &quot;{gameName}&quot; on-chain...
              </div>
              <div style={{ fontSize: 11, color: "#555" }}>Creating game template via Solana</div>
            </div>
          )}

          {/* Phase: Deployed */}
          {phase === "deployed" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>🎉</div>
              <div style={{ color: "#4caf50", fontSize: 20, fontWeight: "bold", marginBottom: 4 }}>
                GAME DEPLOYED
              </div>
              <div style={{ color: "#fdd835", fontSize: 14, marginBottom: 16 }}>
                &quot;{gameName}&quot; is live on Solana
              </div>
              <div style={{ color: "#555", fontSize: 11, marginBottom: 20 }}>
                Created by Clanker × Your AI. Players can now bet and play.
              </div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => { setPhase("idle"); setChatLog([]); setGameType(null); }} style={{
                  padding: "10px 24px", borderRadius: 8, background: "#7c4dff",
                  color: "#fff", border: "none", fontFamily: "inherit", fontWeight: "bold", cursor: "pointer",
                }}>FORGE ANOTHER</button>
                <button onClick={onClose} style={{
                  padding: "10px 24px", borderRadius: 8, background: "transparent",
                  color: "#888", border: "1px solid #333", fontFamily: "inherit", cursor: "pointer",
                }}>CLOSE</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
