"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  getSessionKeypair,
  callStartFactoryGame,
  callPlayerChoice,
  waitForSessionUpdate,
  fetchGameSession,
  fetchGameTemplate,
  fetchPlayer,
  toFriendlyError,
  BN,
} from "../../lib/solana";

interface FactoryGameProps {
  onClose: () => void;
}

type Phase = "select" | "playing" | "waiting_vrf" | "choosing" | "result";

const CHOICE_LABELS: Record<number, string> = {
  0: "HIT",
  1: "STAND",
  2: "FOLD",
  3: "RAISE",
  4: "CHECK",
  5: "HIGHER",
  6: "LOWER",
  7: "RED",
  8: "BLACK",
  9: "ODD",
  10: "EVEN",
  11: "SPLIT",
  12: "DOUBLE",
};

const CHOICE_COLORS: Record<number, string> = {
  0: "#2ecc71",
  1: "#e74c3c",
  2: "#95a5a6",
  3: "#f39c12",
  4: "#3498db",
  5: "#2ecc71",
  6: "#e74c3c",
  7: "#e74c3c",
  8: "#2c3e50",
  9: "#9b59b6",
  10: "#16a085",
  11: "#e67e22",
  12: "#8e44ad",
};

function decodeTemplateName(nameBytes: number[]): string {
  const bytes = new Uint8Array(nameBytes);
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? bytes.length : end)).trim() || "Unnamed Game";
}

function getAvailableChoices(optionsMask: number): number[] {
  const choices: number[] = [];
  for (let i = 0; i < 13; i++) {
    if (optionsMask & (1 << i)) choices.push(i);
  }
  return choices;
}

const KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(124,77,255,0.3); }
  50%      { box-shadow: 0 0 40px rgba(124,77,255,0.5); }
}
@keyframes winGlow {
  0%, 100% { text-shadow: 0 0 10px rgba(76,175,80,0.5); }
  50%      { text-shadow: 0 0 25px rgba(76,175,80,0.9); }
}
`;

// Hardcoded template IDs the casino offers — agents create these
const TEMPLATE_IDS = [1, 2, 3];

export default function FactoryGame({ onClose }: FactoryGameProps) {
  const keypair = getSessionKeypair();
  const shortAddr = `${keypair.publicKey.toBase58().slice(0, 6)}...${keypair.publicKey.toBase58().slice(-4)}`;

  const [phase, setPhase] = useState<Phase>("select");
  const [templates, setTemplates] = useState<{ id: number; name: string; minBet: number; maxBet: number; plays: number; feeBps: number }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [bet, setBet] = useState("");
  const [chipBalance, setChipBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionData, setSessionData] = useState<{
    playerValues: number[];
    dealerValues: number[];
    sharedValues: number[];
    optionsMask: number;
    status: string;
    multiplierBps: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => { overlayRef.current?.focus(); }, []);

  // Load templates and balance
  useEffect(() => {
    const load = async () => {
      const player = await fetchPlayer(keypair);
      if (player) setChipBalance(Number(player.balance));

      const loaded: typeof templates = [];
      for (const id of TEMPLATE_IDS) {
        const t = await fetchGameTemplate(keypair, id);
        if (t && t.active) {
          loaded.push({
            id,
            name: decodeTemplateName(t.name),
            minBet: Number(t.minBet),
            maxBet: Number(t.maxBet),
            plays: Number(t.totalPlays),
            feeBps: Number(t.creatorFeeBps),
          });
        }
      }
      setTemplates(loaded);

      // Check for existing session
      const session = await fetchGameSession(keypair);
      if (session) {
        const statusKey = Object.keys(session.status)[0];
        if (statusKey === "waitingForChoice") {
          loadSessionState(session);
          setPhase("choosing");
        } else if (statusKey === "active" || statusKey === "waitingForVrf") {
          setPhase("waiting_vrf");
          pollSession();
        }
      }
    };
    load().catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSessionState = (session: any) => {
    // Find the AwaitChoice step's options_mask from template
    // For now we extract from status
    setSessionData({
      playerValues: session.playerValues || [],
      dealerValues: session.dealerValues || [],
      sharedValues: session.sharedValues || [],
      optionsMask: 0xFFFF, // allow all until we can read the template step
      status: Object.keys(session.status)[0],
      multiplierBps: Number(session.resultMultiplierBps || 0),
    });
  };

  const pollSession = async () => {
    try {
      const session = await waitForSessionUpdate(keypair);
      loadSessionState(session);
      const statusKey = Object.keys(session.status)[0];
      if (statusKey === "settled") {
        setPhase("result");
      } else if (statusKey === "waitingForChoice") {
        setPhase("choosing");
      }
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("select");
    }
  };

  const handleStart = useCallback(async () => {
    if (selectedTemplate === null || !bet) return;
    const betNum = parseInt(bet);
    if (isNaN(betNum) || betNum <= 0) return;

    setError(null);
    setLoading(true);
    setPhase("waiting_vrf");
    try {
      await callStartFactoryGame(keypair, selectedTemplate, betNum);
      await pollSession();
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("select");
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, bet, keypair]);

  const handleChoice = useCallback(async (choiceBit: number) => {
    if (selectedTemplate === null) return;
    setError(null);
    setLoading(true);
    setPhase("waiting_vrf");
    try {
      await callPlayerChoice(keypair, selectedTemplate, choiceBit);
      await pollSession();
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("choosing");
    }
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate, keypair]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
  }, [onClose]);

  const reset = () => {
    setPhase("select");
    setSelectedTemplate(null);
    setBet("");
    setSessionData(null);
    setError(null);
    fetchPlayer(keypair).then((p) => { if (p) setChipBalance(Number(p.balance)); }).catch(() => {});
  };

  const isSettled = sessionData?.status === "settled";
  const won = isSettled && (sessionData?.multiplierBps || 0) > 0;

  return (
    <div
      ref={overlayRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
        outline: "none", animation: "fadeIn 0.3s ease-out",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div style={{
        width: 560, maxWidth: "95vw",
        background: "linear-gradient(170deg, #0d0d1a 0%, #0a0f14 40%, #0d0a1a 100%)",
        border: "2px solid #7c4dff",
        borderRadius: 16, padding: "24px 32px",
        position: "relative",
        animation: "glowPulse 4s ease-in-out infinite",
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: "#b388ff", fontSize: 22, margin: 0, letterSpacing: 2 }}>GAME FACTORY</h2>
            <p style={{ color: "#4a4a6a", fontSize: 11, margin: "2px 0 0" }}>Agent-authored games</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#4caf50", fontSize: 11 }}>{shortAddr}</div>
            <div style={{ color: "#fdd835", fontSize: 13 }}>{chipBalance} chips</div>
          </div>
        </div>

        <button onClick={onClose} style={{
          position: "absolute", top: 10, right: 14,
          background: "none", border: "1px solid #333", borderRadius: 6,
          color: "#888", fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "2px 8px",
        }}>ESC</button>

        {error && (
          <div style={{
            background: "rgba(233,69,96,0.1)", border: "1px solid rgba(233,69,96,0.3)",
            borderRadius: 8, padding: "8px 12px", marginBottom: 12, color: "#e94560", fontSize: 12,
          }}>{error}</div>
        )}

        {/* Template Select */}
        {phase === "select" && (
          <div>
            {templates.length === 0 ? (
              <div style={{ textAlign: "center", color: "#555", padding: "40px 0" }}>
                No game templates available yet.<br />
                <span style={{ fontSize: 11 }}>AI agents create games — check back soon.</span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      style={{
                        padding: "12px 16px", borderRadius: 10, cursor: "pointer",
                        border: selectedTemplate === t.id ? "2px solid #b388ff" : "2px solid #222",
                        background: selectedTemplate === t.id ? "rgba(124,77,255,0.1)" : "rgba(10,10,20,0.6)",
                        color: "#e0e0e0", fontFamily: "inherit", textAlign: "left",
                        transition: "all 0.2s",
                      }}
                    >
                      <div style={{ fontWeight: "bold", fontSize: 14, color: selectedTemplate === t.id ? "#b388ff" : "#ccc" }}>
                        {t.name}
                      </div>
                      <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                        Bet: {t.minBet}–{t.maxBet} chips | Plays: {t.plays} | Fee: {(t.feeBps / 100).toFixed(1)}%
                      </div>
                    </button>
                  ))}
                </div>

                {selectedTemplate !== null && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number"
                      value={bet}
                      onChange={(e) => setBet(e.target.value)}
                      placeholder="Bet amount"
                      style={{
                        flex: 1, padding: "10px 14px", borderRadius: 8,
                        border: "1px solid #333", background: "#0a0a14", color: "#fdd835",
                        fontFamily: "inherit", fontSize: 14, outline: "none",
                      }}
                    />
                    <button
                      onClick={handleStart}
                      disabled={loading || !bet || parseInt(bet) <= 0}
                      style={{
                        padding: "10px 24px", borderRadius: 8,
                        background: "#7c4dff", color: "#fff", border: "none",
                        fontFamily: "inherit", fontSize: 14, fontWeight: "bold",
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.5 : 1,
                      }}
                    >
                      {loading ? "..." : "PLAY"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Waiting for VRF */}
        {phase === "waiting_vrf" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#b388ff" }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>Waiting for VRF oracle...</div>
            <div style={{ fontSize: 11, color: "#555" }}>Randomness is being generated on-chain</div>
          </div>
        )}

        {/* Player Choice */}
        {phase === "choosing" && sessionData && (
          <div>
            {/* Show current values */}
            {sessionData.playerValues.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>YOUR VALUES</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sessionData.playerValues.map((v, i) => (
                    <span key={i} style={{
                      background: "rgba(124,77,255,0.15)", border: "1px solid #7c4dff",
                      borderRadius: 6, padding: "4px 10px", color: "#b388ff", fontSize: 14,
                    }}>{v}</span>
                  ))}
                </div>
              </div>
            )}
            {sessionData.dealerValues.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#888", fontSize: 11, marginBottom: 4 }}>DEALER VALUES</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sessionData.dealerValues.map((v, i) => (
                    <span key={i} style={{
                      background: "rgba(233,69,96,0.15)", border: "1px solid #e94560",
                      borderRadius: 6, padding: "4px 10px", color: "#e94560", fontSize: 14,
                    }}>{v}</span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ color: "#fdd835", fontSize: 14, textAlign: "center", margin: "16px 0 12px" }}>
              MAKE YOUR CHOICE
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              {getAvailableChoices(sessionData.optionsMask).map((bit) => (
                <button
                  key={bit}
                  onClick={() => handleChoice(bit)}
                  disabled={loading}
                  style={{
                    padding: "10px 20px", borderRadius: 8,
                    background: CHOICE_COLORS[bit] || "#555",
                    color: "#fff", border: "2px solid rgba(255,255,255,0.2)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {CHOICE_LABELS[bit] || `CHOICE ${bit}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Result */}
        {phase === "result" && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{
              fontSize: 28, fontWeight: "bold", letterSpacing: 2,
              color: won ? "#4caf50" : "#e94560",
              animation: won ? "winGlow 1.5s ease-in-out infinite" : undefined,
              marginBottom: 8,
            }}>
              {won ? "YOU WIN!" : "YOU LOST"}
            </div>
            {won && sessionData && (
              <div style={{ color: "#aaa", fontSize: 13 }}>
                Payout: {((sessionData.multiplierBps || 0) / 100).toFixed(1)}x
              </div>
            )}
            <button onClick={reset} style={{
              marginTop: 20, padding: "10px 32px", borderRadius: 8,
              background: "#7c4dff", color: "#fff", border: "none",
              fontFamily: "inherit", fontSize: 14, fontWeight: "bold", cursor: "pointer",
            }}>
              PLAY AGAIN
            </button>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 10, color: "#2a2a3a", marginTop: 16 }}>
          Press ESC to close
        </p>
      </div>
    </div>
  );
}
