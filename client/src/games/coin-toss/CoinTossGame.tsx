"use client";
import { useState, useCallback, useEffect, useRef } from "react";

// TODO: Replace with Solana contract integration
interface GameResult {
  won: boolean;
}

interface CoinTossGameProps {
  onClose: () => void;
  initialChoice?: number | null;
  autoFlip?: boolean;
}

type Step =
  | { id: "idle" }
  | { id: "betting" }
  | { id: "waiting_token" }
  | { id: "flipping" }
  | { id: "settling" }
  | { id: "done"; result: GameResult }
  | { id: "error"; message: string };

const STEP_LABELS: Partial<Record<Step["id"], string>> = {
  betting: "Approving & placing bet...",
  waiting_token: "Confirming bet...",
  flipping: "Flipping (VRF)...",
  settling: "Settling bet...",
};

const STEPS_ORDER = ["betting", "waiting_token", "flipping", "settling"];

/* ── Keyframes injected once ─────────────────────────────────── */
const KEYFRAMES = `
@keyframes coinFlip {
  0%   { transform: rotateY(0deg) rotateX(0deg); }
  25%  { transform: rotateY(900deg) rotateX(15deg); }
  50%  { transform: rotateY(1800deg) rotateX(-10deg); }
  75%  { transform: rotateY(2520deg) rotateX(5deg); }
  100% { transform: rotateY(3240deg) rotateX(0deg); }
}
@keyframes coinBounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}
@keyframes coinLand {
  0%   { transform: rotateY(0deg) scale(1); }
  30%  { transform: rotateY(180deg) scale(1.15); }
  60%  { transform: rotateY(360deg) scale(1.05); }
  100% { transform: rotateY(0deg) scale(1); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(253,216,53,0.3), 0 0 40px rgba(253,216,53,0.1); }
  50%      { box-shadow: 0 0 30px rgba(253,216,53,0.5), 0 0 60px rgba(253,216,53,0.2); }
}
@keyframes resultSlide {
  0%   { opacity: 0; transform: scale(0.5) translateY(20px); }
  60%  { opacity: 1; transform: scale(1.1) translateY(-4px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes winGlow {
  0%, 100% { text-shadow: 0 0 10px rgba(76,175,80,0.5); }
  50%      { text-shadow: 0 0 25px rgba(76,175,80,0.9), 0 0 50px rgba(76,175,80,0.4); }
}
@keyframes loseShake {
  0%, 100% { transform: translateX(0); }
  20%  { transform: translateX(-4px); }
  40%  { transform: translateX(4px); }
  60%  { transform: translateX(-3px); }
  80%  { transform: translateX(3px); }
}
`;

export default function CoinTossGame({ onClose, initialChoice, autoFlip }: CoinTossGameProps) {
  // TODO: Replace with Solana wallet hook
  const account = null as any;
  const address = null as string | null;

  const [choice, setChoice] = useState<number | null>(initialChoice ?? null);
  const autoFlipDone = useRef(false);
  const [step, setStep] = useState<Step>({ id: "idle" });
  const [coinHover, setCoinHover] = useState<number | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ choice: string; won: boolean }[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    overlayRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "e" || e.key === "E") {
        e.stopPropagation();
        onClose();
      }
    },
    [onClose]
  );

  const askAI = useCallback(async () => {
    setAiLoading(true);
    setAiAdvice(null);
    try {
      const historyContext = aiHistory.length > 0
        ? `\nRecent results: ${aiHistory.slice(-5).map(h => `${h.choice} → ${h.won ? "WIN" : "LOSS"}`).join(", ")}`
        : "";
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemma3:4b",
          messages: [
            {
              role: "system",
              content: "You are a superstitious casino advisor AI in a blockchain coin toss game. Give a short, confident pick (HEADS or TAILS) with a brief fun reason. Max 2 sentences. Be dramatic and entertaining."
            },
            {
              role: "user",
              content: `I'm about to flip a coin. Should I pick HEADS or TAILS?${historyContext}\nGive me your pick and a quick reason.`
            }
          ],
          max_tokens: 80,
          temperature: 1.0,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "The spirits are silent...";
      setAiAdvice(text);
      // Auto-select if AI mentions heads or tails
      const lower = text.toLowerCase();
      if (lower.includes("heads") && !lower.includes("tails")) setChoice(0);
      else if (lower.includes("tails") && !lower.includes("heads")) setChoice(1);
    } catch {
      setAiAdvice("Connection to the oracle failed... trust your gut!");
    }
    setAiLoading(false);
  }, [aiHistory]);

  const handleFlip = useCallback(async () => {
    if (choice === null) return;

    try {
      // TODO: Replace with Solana program calls
      setStep({ id: "betting" });
      setStep({ id: "error", message: "Solana integration not yet implemented" });
    } catch (err: any) {
      const msg = err?.message ?? "Transaction failed";
      setStep({ id: "error", message: msg.slice(0, 160) });
    }
  }, [choice]);

  const reset = useCallback(() => {
    setStep({ id: "idle" });
    setChoice(null);
    setAiAdvice(null);
  }, []);

  // Auto-flip when Clanker triggers the bet
  useEffect(() => {
    if (autoFlip && initialChoice !== null && initialChoice !== undefined && !autoFlipDone.current && step.id === "idle") {
      autoFlipDone.current = true;
      handleFlip();
    }
  }, [autoFlip, initialChoice, step.id, handleFlip]);

  const isProcessing = STEPS_ORDER.includes(step.id);
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not connected";

  return (
    <div
      ref={overlayRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        outline: "none",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div
        style={{
          background: "linear-gradient(170deg, #0d1117 0%, #0a0f14 40%, #0d1a0f 100%)",
          border: "2px solid #c8a84e",
          borderRadius: 16,
          padding: "28px 36px 24px",
          maxWidth: 520,
          width: "92%",
          fontFamily: "'Courier New', monospace",
          color: "#e0e0e0",
          position: "relative",
          animation: "glowPulse 3s ease-in-out infinite",
          overflow: "hidden",
        }}
      >
        {/* Felt texture overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 30%, rgba(34,85,34,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Decorative top border accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, transparent, #fdd835, #c8a84e, #fdd835, transparent)",
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 10,
            right: 14,
            background: "none",
            border: "1px solid #333",
            borderRadius: 6,
            color: "#888",
            fontSize: 14,
            cursor: "pointer",
            fontFamily: "inherit",
            padding: "2px 8px",
            transition: "all 0.2s",
            zIndex: 2,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#c8a84e";
            e.currentTarget.style.color = "#fdd835";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.color = "#888";
          }}
        >
          ESC
        </button>

        {/* Title */}
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <h2
            style={{
              color: "#fdd835",
              fontSize: 26,
              margin: "0 0 2px",
              letterSpacing: "0.15em",
              textShadow: "0 0 20px rgba(253,216,53,0.4)",
              fontWeight: "bold",
            }}
          >
            COIN TOSS
          </h2>
          <p
            style={{
              color: "#6b6b4e",
              fontSize: 12,
              margin: "0 0 24px",
              letterSpacing: "0.08em",
            }}
          >
            0.001 ETH &middot; DOUBLE OR NOTHING
          </p>
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
            {/* Address bar */}
            <div
              style={{
                textAlign: "center",
                fontSize: 11,
                color: "#4a5568",
                marginBottom: 20,
              }}
            >
              <span
                style={{
                  background: "rgba(200,168,78,0.1)",
                  border: "1px solid #2a2a1e",
                  borderRadius: 4,
                  padding: "3px 10px",
                  display: "inline-block",
                }}
              >
                {shortAddr}
              </span>
              <span style={{ color: "#4caf50", fontSize: 9, marginLeft: 8 }}>CONTROLLER</span>
            </div>

            {/* ── IDLE: Choose side + flip ─────────────── */}
            {step.id === "idle" && (
              <>
                {/* Coin selection */}
                <div
                  style={{
                    display: "flex",
                    gap: 20,
                    justifyContent: "center",
                    marginBottom: 24,
                  }}
                >
                  <CoinChoice
                    side={0}
                    label="HEADS"
                    selected={choice === 0}
                    hovered={coinHover === 0}
                    onClick={() => setChoice(0)}
                    onHover={() => setCoinHover(0)}
                    onLeave={() => setCoinHover(null)}
                  />
                  <CoinChoice
                    side={1}
                    label="TAILS"
                    selected={choice === 1}
                    hovered={coinHover === 1}
                    onClick={() => setChoice(1)}
                    onHover={() => setCoinHover(1)}
                    onLeave={() => setCoinHover(null)}
                  />
                </div>

                {/* AI Advisor */}
                <div style={{ marginBottom: 16 }}>
                  {!aiAdvice && !aiLoading && (
                    <button
                      onClick={askAI}
                      style={{
                        display: "block",
                        width: "100%",
                        padding: "10px 0",
                        fontSize: 12,
                        fontWeight: "bold",
                        fontFamily: "'Courier New', monospace",
                        letterSpacing: "0.1em",
                        border: "1px solid #7c4dff",
                        borderRadius: 8,
                        background: "rgba(124,77,255,0.08)",
                        color: "#b388ff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(124,77,255,0.18)";
                        e.currentTarget.style.borderColor = "#b388ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(124,77,255,0.08)";
                        e.currentTarget.style.borderColor = "#7c4dff";
                      }}
                    >
                      ASK AI ORACLE
                    </button>
                  )}
                  {aiLoading && (
                    <div style={{
                      textAlign: "center",
                      padding: "10px 0",
                      fontSize: 12,
                      color: "#b388ff",
                      animation: "glowPulse 1.5s ease-in-out infinite",
                    }}>
                      <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>&#9734;</span>
                      {" "}Consulting the oracle...
                    </div>
                  )}
                  {aiAdvice && (
                    <div style={{
                      background: "rgba(124,77,255,0.06)",
                      border: "1px solid rgba(124,77,255,0.3)",
                      borderRadius: 8,
                      padding: "10px 14px",
                    }}>
                      <div style={{ fontSize: 9, color: "#7c4dff", letterSpacing: "0.15em", marginBottom: 4, fontWeight: "bold" }}>
                        AI ORACLE
                      </div>
                      <p style={{ color: "#d1c4e9", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                        {aiAdvice}
                      </p>
                    </div>
                  )}
                </div>

                {/* Flip button */}
                <button
                  onClick={handleFlip}
                  disabled={choice === null}
                  style={{
                    ...primaryBtnStyle(choice !== null),
                    ...(choice !== null
                      ? {
                          background: "linear-gradient(135deg, rgba(253,216,53,0.15) 0%, rgba(200,168,78,0.1) 100%)",
                          backgroundSize: "200% auto",
                          animation: "shimmer 3s linear infinite",
                        }
                      : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (choice !== null) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 20px rgba(253,216,53,0.3)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {choice !== null ? "FLIP COIN" : "SELECT A SIDE"}
                </button>
              </>
            )}

            {/* ── PROCESSING ──────────────────────────── */}
            {isProcessing && (
              <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
                <CoinDisplay side={choice} state="flipping" />

                <p
                  style={{
                    color: "#fdd835",
                    marginTop: 16,
                    fontSize: 14,
                    letterSpacing: "0.05em",
                  }}
                >
                  {STEP_LABELS[step.id as keyof typeof STEP_LABELS]}
                </p>

                <StepDots current={step.id} />

                <p
                  style={{
                    color: "#3a3a3a",
                    fontSize: 11,
                    marginTop: 10,
                  }}
                >
                  Confirm each prompt in your wallet
                </p>
              </div>
            )}

            {/* ── DONE ────────────────────────────────── */}
            {step.id === "done" && (
              <div
                style={{
                  textAlign: "center",
                  padding: "8px 0 8px",
                  animation: "resultSlide 0.6s ease-out",
                }}
              >
                <CoinDisplay
                  side={step.result.won ? choice : (choice === 0 ? 1 : 0)}
                  state="result"
                />

                <p
                  style={{
                    fontSize: 28,
                    fontWeight: "bold",
                    color: step.result.won ? "#4caf50" : "#e94560",
                    margin: "16px 0 6px",
                    letterSpacing: "0.1em",
                    animation: step.result.won
                      ? "winGlow 1.5s ease-in-out infinite"
                      : "loseShake 0.5s ease-out",
                  }}
                >
                  {step.result.won ? "YOU WON!" : "YOU LOST"}
                </p>

                <p style={{ color: "#6b6b6b", fontSize: 13, marginBottom: 4 }}>
                  You called:{" "}
                  <strong style={{ color: "#c8a84e" }}>
                    {choice === 0 ? "Heads" : "Tails"}
                  </strong>
                </p>
                <p
                  style={{
                    color: step.result.won ? "#4caf50" : "#6b4545",
                    fontSize: 13,
                    marginBottom: 24,
                    fontWeight: step.result.won ? "bold" : "normal",
                  }}
                >
                  {step.result.won
                    ? "2x payout sent to your wallet!"
                    : "House keeps the bet."}
                </p>

                <div style={{ display: "flex", gap: 12 }}>
                  <button
                    onClick={reset}
                    style={primaryBtnStyle(true)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(253,216,53,0.2)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(253,216,53,0.08)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    PLAY AGAIN
                  </button>
                  <button
                    onClick={onClose}
                    style={secondaryBtnStyle()}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#555";
                      e.currentTarget.style.color = "#999";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#2a2a2a";
                      e.currentTarget.style.color = "#666";
                    }}
                  >
                    CLOSE
                  </button>
                </div>
              </div>
            )}

            {/* ── ERROR ───────────────────────────────── */}
            {step.id === "error" && (
              <div
                style={{
                  textAlign: "center",
                  padding: "16px 0",
                  animation: "loseShake 0.4s ease-out",
                }}
              >
                <div
                  style={{
                    background: "rgba(233,69,96,0.08)",
                    border: "1px solid rgba(233,69,96,0.3)",
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 16,
                  }}
                >
                  <p style={{ color: "#e94560", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                    {step.message}
                  </p>
                </div>
                <button
                  onClick={reset}
                  style={{
                    ...primaryBtnStyle(true),
                    borderColor: "#e94560",
                    color: "#e94560",
                    background: "rgba(233,69,96,0.08)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(233,69,96,0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(233,69,96,0.08)";
                  }}
                >
                  TRY AGAIN
                </button>
              </div>
            )}
          </div>

        {/* Footer */}
        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "#2a2a2a",
            marginTop: 16,
            position: "relative",
            zIndex: 1,
          }}
        >
          Press ESC to close
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */

/** Large animated coin display shown during flipping & results */
function CoinDisplay({
  side,
  state,
}: {
  side: number | null;
  state: "idle" | "flipping" | "result";
}) {
  const isHeads = side === 0 || side === null;

  const animStyle: React.CSSProperties =
    state === "flipping"
      ? { animation: "coinFlip 2s cubic-bezier(0.22,1,0.36,1) infinite" }
      : state === "result"
        ? { animation: "coinLand 0.8s ease-out" }
        : { animation: "coinBounce 3s ease-in-out infinite" };

  return (
    <div
      style={{
        width: 100,
        height: 100,
        margin: "0 auto",
        perspective: 600,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: isHeads
            ? "radial-gradient(ellipse at 35% 35%, #ffe082, #fdd835 40%, #c8a84e 80%, #8b6914)"
            : "radial-gradient(ellipse at 35% 35%, #c0c0c0, #a0a0a0 40%, #707070 80%, #404040)",
          border: `3px solid ${isHeads ? "#b8942a" : "#555"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          boxShadow: isHeads
            ? "0 4px 20px rgba(253,216,53,0.4), inset 0 -3px 8px rgba(0,0,0,0.3)"
            : "0 4px 20px rgba(100,100,100,0.3), inset 0 -3px 8px rgba(0,0,0,0.3)",
          transformStyle: "preserve-3d",
          ...animStyle,
        }}
      >
        <span
          style={{
            fontSize: 36,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.4))",
          }}
        >
          {isHeads ? "\u2655" : "\u2656"}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: "bold",
            fontFamily: "'Courier New', monospace",
            color: isHeads ? "#6b4e00" : "#333",
            marginTop: 2,
            letterSpacing: "0.1em",
            textShadow: isHeads
              ? "0 1px 0 rgba(255,255,255,0.3)"
              : "0 1px 0 rgba(255,255,255,0.15)",
          }}
        >
          {isHeads ? "HEADS" : "TAILS"}
        </span>
      </div>
    </div>
  );
}

/** Coin selection button for heads / tails */
function CoinChoice({
  side,
  label,
  selected,
  hovered,
  onClick,
  onHover,
  onLeave,
}: {
  side: number;
  label: string;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}) {
  const isHeads = side === 0;
  const active = selected || hovered;

  return (
    <button
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        width: 110,
        padding: "14px 0 10px",
        border: `2px solid ${selected ? "#fdd835" : active ? "#6b6b4e" : "#2a2a2a"}`,
        borderRadius: 12,
        background: selected
          ? "rgba(253,216,53,0.1)"
          : active
            ? "rgba(253,216,53,0.04)"
            : "rgba(10,10,20,0.6)",
        cursor: "pointer",
        transition: "all 0.2s ease",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        fontFamily: "'Courier New', monospace",
        transform: active ? "translateY(-2px)" : "translateY(0)",
        boxShadow: selected
          ? "0 4px 16px rgba(253,216,53,0.2)"
          : "none",
      }}
    >
      {/* Mini coin */}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: isHeads
            ? "radial-gradient(ellipse at 35% 35%, #ffe082, #fdd835 40%, #c8a84e 80%, #8b6914)"
            : "radial-gradient(ellipse at 35% 35%, #c0c0c0, #a0a0a0 40%, #707070 80%, #404040)",
          border: `2px solid ${isHeads ? (active ? "#fdd835" : "#8b6914") : (active ? "#999" : "#555")}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: active
            ? `0 2px 12px ${isHeads ? "rgba(253,216,53,0.4)" : "rgba(150,150,150,0.3)"}`
            : "inset 0 -2px 4px rgba(0,0,0,0.3)",
          transition: "all 0.2s ease",
        }}
      >
        <span
          style={{
            fontSize: 22,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.3))",
          }}
        >
          {isHeads ? "\u2655" : "\u2656"}
        </span>
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: "bold",
          color: selected ? "#fdd835" : active ? "#999" : "#555",
          letterSpacing: "0.12em",
          transition: "color 0.2s",
        }}
      >
        {label}
      </span>
    </button>
  );
}

/** Step progress indicator */
function StepDots({ current }: { current: string }) {
  const idx = STEPS_ORDER.indexOf(current);
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        marginTop: 12,
        alignItems: "center",
      }}
    >
      {STEPS_ORDER.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: active ? 10 : 8,
                height: active ? 10 : 8,
                borderRadius: "50%",
                background: done
                  ? "#4caf50"
                  : active
                    ? "#fdd835"
                    : "#2a2a2a",
                border: active ? "2px solid rgba(253,216,53,0.4)" : "none",
                transition: "all 0.3s ease",
                boxShadow: active
                  ? "0 0 8px rgba(253,216,53,0.5)"
                  : done
                    ? "0 0 4px rgba(76,175,80,0.3)"
                    : "none",
              }}
            />
            {i < STEPS_ORDER.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  background: done ? "#4caf50" : "#1a1a1a",
                  borderRadius: 1,
                  transition: "background 0.3s",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Style helpers
   ═══════════════════════════════════════════════════════════════ */

function primaryBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: "14px 0",
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.12em",
    border: `2px solid ${enabled ? "#c8a84e" : "#222"}`,
    borderRadius: 10,
    background: enabled ? "rgba(253,216,53,0.08)" : "#0d0d0d",
    color: enabled ? "#fdd835" : "#444",
    cursor: enabled ? "pointer" : "not-allowed",
    transition: "all 0.25s ease",
  };
}

function secondaryBtnStyle(): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    padding: "14px 0",
    fontSize: 15,
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    letterSpacing: "0.12em",
    border: "2px solid #2a2a2a",
    borderRadius: 10,
    background: "transparent",
    color: "#666",
    cursor: "pointer",
    transition: "all 0.25s ease",
  };
}
