"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useIsMobile } from "../../game/useMobile";
import {
  getSessionKeypair,
  callStartHand,
  callHit,
  callStand,
  callInitializeBlackjack,
  waitForBlackjackUpdate,
  fetchBlackjackState,
  fetchPlayer,
  cardFromRaw,
  handValue,
  toFriendlyError,
} from "../../lib/solana";

interface BlackjackGameProps {
  onClose: () => void;
  onResult?: (won: boolean, amount: number) => void;
}

type Phase = "betting" | "dealing" | "playing" | "dealer_turn" | "result";

const BET_PRESETS = [100, 250, 500, 1000];

/* ─── Wakana expressions ─── */
const WAKANA_BASE = "/Wakana Merchant/wakana_merchant_";
type Expression = "neutral" | "happy" | "excited" | "devious" | "devious2" | "surprised" |
  "disappointed" | "pleased" | "annoyed" | "proud" | "sad" | "unimpressed";

function getDealerExpression(phase: Phase, resultKey: string | undefined): Expression {
  if (phase === "betting") return "neutral";
  if (phase === "dealing") return "excited";
  if (phase === "playing") return "excited";
  if (phase === "dealer_turn") return "devious";
  if (resultKey === "blackjack") return "surprised";
  if (resultKey === "playerWin" || resultKey === "dealerBust") return "disappointed";
  if (resultKey === "dealerWin" || resultKey === "playerBust") return "proud";
  if (resultKey === "push") return "pleased";
  return "neutral";
}

function getDefaultQuote(phase: Phase, resultKey: string | undefined): string {
  if (phase === "betting") return "Place your wager~";
  if (phase === "dealing") return "Shuffling the deck...";
  if (phase === "playing") return "Hit or stand?";
  if (phase === "dealer_turn") return "Let me see...";
  if (resultKey === "blackjack") return "Blackjack?! Impressive...";
  if (resultKey === "playerWin" || resultKey === "dealerBust") return "Well played~";
  if (resultKey === "dealerWin" || resultKey === "playerBust") return "Better luck next time~";
  if (resultKey === "push") return "A tie! How rare.";
  return "";
}

const FLIRT_OPTIONS = [
  "You look stunning tonight",
  "Are you always this lucky?",
  "Can I buy you a drink?",
  "What's a girl like you doing dealing cards?",
  "You're distracting me from my cards",
  "Tell me a secret",
  "Do you come here often?",
  "Is it hot in here or is it just you?",
];

const WAKANA_SYSTEM = `You are Wakana, a charming and witty blackjack dealer at House of Solana casino. You're a young woman in a traditional merchant outfit. You're playful, slightly flirty but always classy — never crude. You deflect overly forward comments with humor. You love your job and sometimes tease players about their luck. Keep responses to 1-2 short sentences max. Use ~ occasionally. Never break character.`;

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "\u2665",
  diamonds: "\u2666",
  clubs: "\u2663",
  spades: "\u2660",
};
const SUIT_COLORS: Record<string, string> = {
  hearts: "#e74c3c",
  diamonds: "#e74c3c",
  clubs: "#e0e0e0",
  spades: "#e0e0e0",
};

const KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes cardDeal {
  0%   { opacity: 0; transform: translateY(-30px) scale(0.8); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
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
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(253,216,53,0.3), 0 0 40px rgba(253,216,53,0.1); }
  50%      { box-shadow: 0 0 30px rgba(253,216,53,0.5), 0 0 60px rgba(253,216,53,0.2); }
}
`;

function resultLabel(result: string | undefined): { text: string; won: boolean; color: string } {
  switch (result) {
    case "playerWin":
    case "dealerBust":
      return { text: "YOU WIN!", won: true, color: "#4caf50" };
    case "blackjack":
      return { text: "BLACKJACK!", won: true, color: "#ffd700" };
    case "push":
      return { text: "PUSH", won: false, color: "#fdd835" };
    case "dealerWin":
    case "playerBust":
      return { text: "YOU LOST", won: false, color: "#e94560" };
    default:
      return { text: "GAME OVER", won: false, color: "#888" };
  }
}

function getResultKey(bjResult: unknown): string | undefined {
  if (!bjResult || typeof bjResult !== "object") return undefined;
  const keys = Object.keys(bjResult);
  return keys[0];
}

function getStatusKey(bjStatus: unknown): string | undefined {
  if (!bjStatus || typeof bjStatus !== "object") return undefined;
  const keys = Object.keys(bjStatus);
  return keys[0];
}

export default function BlackjackGame({ onClose, onResult }: BlackjackGameProps) {
  const isMobile = useIsMobile();
  const keypair = getSessionKeypair();
  const address = keypair.publicKey.toBase58();
  const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;

  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(0);
  const [chipBalance, setChipBalance] = useState<number | null>(null);
  const [playerCards, setPlayerCards] = useState<number[]>([]);
  const [dealerCards, setDealerCards] = useState<number[]>([]);
  const [gameResult, setGameResult] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Wakana flirt state
  const [wakanaReply, setWakanaReply] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [showFlirtMenu, setShowFlirtMenu] = useState(false);
  const chatHistoryRef = useRef<{ role: string; content: string }[]>([]);

  const expression = getDealerExpression(phase, gameResult);
  const defaultQuote = getDefaultQuote(phase, gameResult);
  const dealerQuote = wakanaReply || defaultQuote;

  const sendFlirt = async (msg: string) => {
    setShowFlirtMenu(false);
    setChatLoading(true);
    setWakanaReply("...");
    chatHistoryRef.current.push({ role: "user", content: msg });
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: "player",
          messages: [
            { role: "system", content: WAKANA_SYSTEM },
            ...chatHistoryRef.current.slice(-8),
          ],
          max_tokens: 80,
        }),
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "Hmm~?";
      setWakanaReply(reply);
      chatHistoryRef.current.push({ role: "assistant", content: reply });
      setTimeout(() => setWakanaReply(null), 5000);
    } catch {
      setWakanaReply("Heh, I'm speechless~");
      setTimeout(() => setWakanaReply(null), 3000);
    }
    setChatLoading(false);
  };

  useEffect(() => { overlayRef.current?.focus(); }, []);

  // Load chip balance on mount
  useEffect(() => {
    fetchPlayer(keypair).then((p) => {
      if (p) setChipBalance(Number(p.balance));
    }).catch(() => {});
    // Check if there's an existing hand
    fetchBlackjackState(keypair).then((bj) => {
      if (!bj) return;
      const status = getStatusKey(bj.status);
      if (status === "playerTurn") {
        setPlayerCards(bj.playerCards || []);
        setDealerCards(bj.dealerCards || []);
        setBet(Number(bj.betAmount));
        setPhase("playing");
      } else if (status === "settled" || status === "idle") {
        // Can start new hand
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape" || e.key === "e" || e.key === "E") {
      e.stopPropagation();
      onClose();
    }
  }, [onClose]);

  const handleDeal = useCallback(async () => {
    if (bet <= 0) return;
    setError(null);
    setLoading(true);
    setPhase("dealing");
    try {
      // Ensure blackjack account exists before starting
      const existing = await fetchBlackjackState(keypair);
      if (!existing) {
        await callInitializeBlackjack(keypair);
      }
      await callStartHand(keypair, bet);
      const bj = await waitForBlackjackUpdate(keypair);
      setPlayerCards(bj.playerCards || []);
      setDealerCards(bj.dealerCards || []);

      const status = getStatusKey(bj.status);
      if (status === "settled") {
        const rk = getResultKey(bj.result);
        setGameResult(rk);
        setPhase("result");
        const info = resultLabel(rk);
        onResult?.(info.won, Number(bj.betAmount));
      } else {
        setPhase("playing");
      }
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("betting");
    }
    setLoading(false);
  }, [bet, keypair, onResult]);

  const handleHit = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      await callHit(keypair);
      const bj = await waitForBlackjackUpdate(keypair);
      setPlayerCards(bj.playerCards || []);
      setDealerCards(bj.dealerCards || []);

      const status = getStatusKey(bj.status);
      if (status === "settled") {
        const rk = getResultKey(bj.result);
        setGameResult(rk);
        setPhase("result");
        const info = resultLabel(rk);
        onResult?.(info.won, Number(bj.betAmount));
      }
    } catch (e) {
      setError(toFriendlyError(e));
    }
    setLoading(false);
  }, [keypair, onResult]);

  const handleStand = useCallback(async () => {
    setError(null);
    setLoading(true);
    setPhase("dealer_turn");
    try {
      await callStand(keypair);
      const bj = await waitForBlackjackUpdate(keypair);
      setPlayerCards(bj.playerCards || []);
      setDealerCards(bj.dealerCards || []);

      const rk = getResultKey(bj.result);
      setGameResult(rk);
      setPhase("result");
      const info = resultLabel(rk);
      onResult?.(info.won, Number(bj.betAmount));
    } catch (e) {
      setError(toFriendlyError(e));
      setPhase("playing");
    }
    setLoading(false);
  }, [keypair, onResult]);

  const newHand = useCallback(() => {
    setPhase("betting");
    setBet(0);
    setPlayerCards([]);
    setDealerCards([]);
    setGameResult(undefined);
    setError(null);
    fetchPlayer(keypair).then((p) => {
      if (p) setChipBalance(Number(p.balance));
    }).catch(() => {});
  }, [keypair]);

  const playerTotal = handValue(playerCards);
  const dealerTotal = handValue(dealerCards);
  const showDealerHole = phase === "result" || phase === "dealer_turn";
  const dealerVisibleTotal = showDealerHole
    ? dealerTotal
    : dealerCards.length > 0 ? cardFromRaw(dealerCards[0]).value : 0;

  const resultInfo = gameResult ? resultLabel(gameResult) : null;

  return (
    <div
      ref={overlayRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(4px)",
        outline: "none",
        animation: "fadeIn 0.3s ease-out",
        fontFamily: "'Courier New', monospace",
      }}
    >
      <style>{KEYFRAMES}</style>

      <div style={{
        display: "flex", alignItems: isMobile ? "center" : "stretch",
        flexDirection: isMobile ? "column" : "row",
        maxWidth: "95vw", maxHeight: "90vh",
        width: isMobile ? "95vw" : "auto",
        gap: 0,
      }}>
        {/* Wakana dealer character - left side (hidden on mobile) */}
        {!isMobile && <div style={{
          width: 220, minWidth: 220,
          background: "linear-gradient(180deg, #1a1520 0%, #2a2030 50%, #1a1520 100%)",
          borderRadius: "24px 0 0 24px",
          border: "4px solid #5a3a1a",
          borderRight: "none",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "flex-end",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Speech bubble */}
          <div style={{
            position: "absolute", top: 12, left: 12, right: 12,
            background: "rgba(255,255,255,0.9)",
            borderRadius: 12,
            padding: "8px 10px",
            fontSize: 11, color: "#1a1a2e",
            textAlign: "center",
            zIndex: 2,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            <div style={{
              position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderTop: "6px solid rgba(255,255,255,0.9)",
            }} />
            {dealerQuote}
          </div>

          {/* Wakana image */}
          <img
            src={`${WAKANA_BASE}${expression}.png`}
            alt="Dealer Wakana"
            style={{
              width: 200, height: "auto",
              objectFit: "contain",
              imageRendering: "auto",
              filter: "drop-shadow(0 0 12px rgba(100,60,200,0.3))",
              transition: "opacity 0.3s",
            }}
          />

          {/* Flirt button + menu */}
          <div style={{ position: "absolute", bottom: 30, left: 0, right: 0, zIndex: 3 }}>
            {showFlirtMenu && (
              <div style={{
                position: "absolute", bottom: 32, left: 8, right: 8,
                background: "rgba(20,15,30,0.95)",
                border: "1px solid #ffd70066",
                borderRadius: 8,
                padding: 6,
                maxHeight: 200, overflowY: "auto",
              }}>
                {FLIRT_OPTIONS.map((opt, i) => (
                  <button key={i} onClick={() => sendFlirt(opt)} disabled={chatLoading} style={{
                    display: "block", width: "100%",
                    background: "transparent", border: "none",
                    color: "#ffd700", fontSize: 10, fontFamily: "inherit",
                    padding: "5px 6px", textAlign: "left",
                    cursor: chatLoading ? "not-allowed" : "pointer",
                    borderBottom: i < FLIRT_OPTIONS.length - 1 ? "1px solid #ffffff15" : "none",
                  }}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => setShowFlirtMenu(!showFlirtMenu)} style={{
              display: "block", margin: "0 auto",
              background: "linear-gradient(135deg, #e91e63, #c2185b)",
              border: "2px solid #ffd70066",
              borderRadius: 16, padding: "4px 14px",
              color: "#fff", fontSize: 10, fontFamily: "inherit",
              cursor: "pointer", fontWeight: "bold",
              boxShadow: "0 2px 8px rgba(233,30,99,0.4)",
            }}>
              {showFlirtMenu ? "Nevermind" : "\u2764 Chat"}
            </button>
          </div>

          {/* Name plate */}
          <div style={{
            position: "absolute", bottom: 8, left: 0, right: 0,
            textAlign: "center",
            color: "#ffd700", fontSize: 11, fontWeight: "bold",
            letterSpacing: 2, textTransform: "uppercase",
            textShadow: "0 0 6px rgba(255,215,0,0.5)",
          }}>
            Wakana
          </div>
        </div>}

        {/* Mobile Wakana speech strip */}
        {isMobile && (
          <div style={{
            width: "100%",
            display: "flex", alignItems: "center", gap: 8,
            background: "linear-gradient(90deg, #1a1520, #2a2030)",
            borderRadius: "16px 16px 0 0",
            border: "2px solid #5a3a1a",
            borderBottom: "none",
            padding: "6px 12px",
          }}>
            <img
              src={`${WAKANA_BASE}${expression}.png`}
              alt="Wakana"
              style={{ width: 40, height: 40, objectFit: "cover", objectPosition: "center 10%", borderRadius: "50%", border: "2px solid #ffd700" }}
            />
            <div style={{ flex: 1, fontSize: 11, color: "#ddd", lineHeight: 1.4 }}>
              <span style={{ color: "#ffd700", fontWeight: "bold", marginRight: 6 }}>Wakana</span>
              {dealerQuote}
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowFlirtMenu(!showFlirtMenu)} style={{
                background: "linear-gradient(135deg, #e91e63, #c2185b)",
                border: "1px solid #ffd70066",
                borderRadius: 12, padding: "3px 10px",
                color: "#fff", fontSize: 9, fontFamily: "inherit",
                cursor: "pointer", fontWeight: "bold",
                whiteSpace: "nowrap",
              }}>
                {showFlirtMenu ? "X" : "\u2764"}
              </button>
              {showFlirtMenu && (
                <div style={{
                  position: "absolute", top: "100%", right: 0, marginTop: 4,
                  background: "rgba(20,15,30,0.97)",
                  border: "1px solid #ffd70066",
                  borderRadius: 8,
                  padding: 4,
                  width: 200,
                  maxHeight: 160, overflowY: "auto",
                  zIndex: 10,
                }}>
                  {FLIRT_OPTIONS.map((opt, i) => (
                    <button key={i} onClick={() => sendFlirt(opt)} disabled={chatLoading} style={{
                      display: "block", width: "100%",
                      background: "transparent", border: "none",
                      color: "#ffd700", fontSize: 10, fontFamily: "inherit",
                      padding: "4px 6px", textAlign: "left",
                      cursor: chatLoading ? "not-allowed" : "pointer",
                      borderBottom: i < FLIRT_OPTIONS.length - 1 ? "1px solid #ffffff15" : "none",
                    }}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{
          width: isMobile ? "100%" : 650,
          background: "radial-gradient(ellipse at 50% 40%, #1a6b3c 0%, #145a30 50%, #0e4525 100%)",
          borderRadius: isMobile ? "0 0 16px 16px" : "0 24px 24px 0",
          border: "4px solid #5a3a1a",
          borderLeft: isMobile ? "4px solid #5a3a1a" : "2px solid #5a3a1a",
          boxShadow: "0 0 0 4px #3a2510, 0 0 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.3)",
          position: "relative",
          display: "flex", flexDirection: "column",
          overflow: isMobile ? "visible" : "hidden",
          animation: "glowPulse 4s ease-in-out infinite",
        }}>
        {/* Top bar */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 16px",
          background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
        }}>
          <div style={{ color: "#ffd700", fontSize: 16, fontWeight: "bold", letterSpacing: 2 }}>
            BLACKJACK
          </div>
          <div style={{ color: "#aaa", fontSize: 12 }}>
            <span style={{ color: "#4caf50", marginRight: 8 }}>{shortAddr}</span>
            {chipBalance !== null && `${chipBalance} chips`}
          </div>
          <button onClick={onClose} style={{
            background: "rgba(200,50,50,0.8)", color: "#fff", border: "none",
            borderRadius: 6, padding: "4px 12px", cursor: "pointer",
            fontFamily: "inherit", fontSize: 12, fontWeight: "bold",
          }}>ESC</button>
        </div>

        {/* Dealer area */}
        <div style={{
          flex: isMobile ? "none" : 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4, padding: isMobile ? "6px 0" : "8px 0",
        }}>
          <div style={{ color: "#aaa", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>
            Dealer {dealerCards.length > 0 && `(${showDealerHole ? dealerTotal : dealerVisibleTotal}${!showDealerHole && dealerCards.length > 1 ? "+?" : ""})`}
          </div>
          <div style={{ display: "flex", gap: 6, minHeight: isMobile ? 50 : 100, flexWrap: "wrap", justifyContent: "center" }}>
            {dealerCards.map((c, i) => (
              <CardView key={i} cardByte={c} hidden={!showDealerHole && i === 1} index={i} />
            ))}
          </div>
        </div>

        {/* Message area */}
        {error && (
          <div style={{ textAlign: "center", padding: "6px 16px" }}>
            <span style={{ color: "#e94560", fontSize: 12 }}>{error}</span>
          </div>
        )}

        {phase === "dealing" && (
          <div style={{ textAlign: "center", padding: "8px 0", color: "#fdd835", fontSize: 14 }}>
            Dealing cards (VRF)...
          </div>
        )}

        {phase === "dealer_turn" && (
          <div style={{ textAlign: "center", padding: "8px 0", color: "#fdd835", fontSize: 14 }}>
            Dealer&apos;s turn (VRF)...
          </div>
        )}

        {phase === "result" && resultInfo && (
          <div style={{
            textAlign: "center", padding: "8px 0",
            animation: resultInfo.won ? "winGlow 1.5s ease-in-out infinite" : "loseShake 0.5s ease-out",
          }}>
            <div style={{ fontSize: 24, fontWeight: "bold", color: resultInfo.color, letterSpacing: 2 }}>
              {resultInfo.text}
            </div>
            <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
              {resultInfo.won ? `Payout: ${gameResult === "blackjack" ? "2.5x" : "2x"}` : gameResult === "push" ? "Bet returned" : "House keeps the bet"}
            </div>
          </div>
        )}

        {/* Bet display */}
        <div style={{ textAlign: "center", padding: "4px 0", color: "#ffd700", fontSize: 13 }}>
          {phase === "betting" ? (bet > 0 ? `Bet: ${bet} chips` : "Place your bet") : `Bet: ${bet} chips`}
        </div>

        {/* Player area */}
        <div style={{
          flex: isMobile ? "none" : 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 4, padding: isMobile ? "6px 0" : "8px 0",
        }}>
          <div style={{ display: "flex", gap: 6, minHeight: isMobile ? 50 : 100, flexWrap: "wrap", justifyContent: "center" }}>
            {playerCards.map((c, i) => (
              <CardView key={i} cardByte={c} hidden={false} index={i} />
            ))}
          </div>
          <div style={{ color: "#ddd", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>
            You {playerCards.length > 0 && `(${playerTotal})`}
          </div>
        </div>

        {/* Controls */}
        <div style={{
          padding: isMobile ? "8px 10px" : "12px 16px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
          display: "flex", justifyContent: "center", gap: isMobile ? 6 : 10, flexWrap: "wrap",
          flexShrink: 0,
        }}>
          {phase === "betting" && (
            <>
              {BET_PRESETS.map((val) => (
                <ChipButton
                  key={val}
                  value={val}
                  selected={bet === val}
                  onClick={() => setBet(val)}
                  disabled={chipBalance !== null && val > chipBalance}
                />
              ))}
              <ActionButton
                label="DEAL"
                onClick={handleDeal}
                color="#e6a817"
                disabled={bet <= 0 || loading}
              />
            </>
          )}
          {phase === "playing" && (
            <>
              <ActionButton label="HIT" onClick={handleHit} color="#2ecc71" disabled={loading} />
              <ActionButton label="STAND" onClick={handleStand} color="#e74c3c" disabled={loading} />
            </>
          )}
          {phase === "result" && (
            <ActionButton label="NEW HAND" onClick={newHand} color="#e6a817" />
          )}
        </div>
        </div>{/* end table */}
      </div>{/* end flex wrapper */}
    </div>
  );
}

function CardView({ cardByte, hidden, index }: { cardByte: number; hidden: boolean; index: number }) {
  const cw = "clamp(45px, 12vw, 65px)";
  const ch = "clamp(65px, 17vw, 95px)";

  if (hidden) {
    return (
      <div style={{
        width: cw, height: ch, borderRadius: 8,
        background: "linear-gradient(135deg, #1a3a6b 0%, #0d2240 100%)",
        border: "2px solid #4a6fa5",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
        animation: `cardDeal 0.4s ease-out ${index * 0.15}s both`,
      }}>
        <div style={{
          width: "70%", height: "75%", borderRadius: 4,
          border: "1px solid #4a6fa5",
          background: "repeating-linear-gradient(45deg, #1a3a6b, #1a3a6b 4px, #1e4080 4px, #1e4080 8px)",
        }} />
      </div>
    );
  }

  const info = cardFromRaw(cardByte);
  const color = SUIT_COLORS[info.suit] || "#e0e0e0";
  const symbol = SUIT_SYMBOLS[info.suit] || "?";

  return (
    <div style={{
      width: cw, height: ch, borderRadius: 8,
      background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)",
      border: "2px solid #ccc",
      display: "flex", flexDirection: "column",
      padding: "3px 5px",
      boxShadow: "2px 3px 8px rgba(0,0,0,0.3)",
      position: "relative",
      animation: `cardDeal 0.4s ease-out ${index * 0.15}s both`,
    }}>
      <div style={{ color, fontSize: "clamp(10px, 2.5vw, 14px)", fontWeight: "bold", lineHeight: 1 }}>{info.rank}</div>
      <div style={{ color, fontSize: "clamp(8px, 2vw, 10px)", lineHeight: 1 }}>{symbol}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: "clamp(18px, 5vw, 28px)" }}>
        {symbol}
      </div>
      <div style={{
        position: "absolute", bottom: 4, right: 6,
        transform: "rotate(180deg)", color, fontSize: 14, fontWeight: "bold", lineHeight: 1,
      }}>{info.rank}</div>
    </div>
  );
}

function ChipButton({ value, selected, onClick, disabled }: { value: number; selected: boolean; onClick: () => void; disabled?: boolean }) {
  const colors: Record<number, [string, string]> = {
    100: ["#e8e8e8", "#333"],
    250: ["#e74c3c", "#fff"],
    500: ["#2ecc71", "#fff"],
    1000: ["#9b59b6", "#fff"],
  };
  const [bg, fg] = colors[value] || ["#888", "#fff"];

  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "clamp(38px, 9vw, 50px)", height: "clamp(38px, 9vw, 50px)", borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${bg}, ${bg}dd)`,
      border: selected ? `3px solid #ffd700` : `3px dashed ${fg}66`,
      color: fg, fontWeight: "bold", fontSize: "clamp(10px, 2vw, 12px)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      fontFamily: "inherit",
      boxShadow: selected ? "0 0 12px rgba(255,215,0,0.5)" : "1px 2px 6px rgba(0,0,0,0.3)",
      transform: selected ? "scale(1.1)" : "scale(1)",
      transition: "all 0.2s",
    }}>
      {value}
    </button>
  );
}

function ActionButton({ label, onClick, color, disabled }: { label: string; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "clamp(6px, 1.5vw, 10px) clamp(14px, 4vw, 24px)", borderRadius: 8,
      background: color, color: "#fff", border: "2px solid rgba(255,255,255,0.2)",
      fontFamily: "inherit", fontSize: "clamp(11px, 2.5vw, 14px)", fontWeight: "bold",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      letterSpacing: 1,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      transition: "all 0.2s",
    }}>
      {label}
    </button>
  );
}
