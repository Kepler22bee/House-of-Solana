"use client";
import { useState, useCallback, useEffect, useRef } from "react";
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
        width: 700, maxWidth: "95vw", maxHeight: "90vh",
        background: "radial-gradient(ellipse at 50% 40%, #1a6b3c 0%, #145a30 50%, #0e4525 100%)",
        borderRadius: 20,
        border: "4px solid #5a3a1a",
        boxShadow: "0 0 0 4px #3a2510, 0 0 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.3)",
        position: "relative",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
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
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0",
        }}>
          <div style={{ color: "#aaa", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>
            Dealer {dealerCards.length > 0 && `(${showDealerHole ? dealerTotal : dealerVisibleTotal}${!showDealerHole && dealerCards.length > 1 ? "+?" : ""})`}
          </div>
          <div style={{ display: "flex", gap: 8, minHeight: 100, flexWrap: "wrap", justifyContent: "center" }}>
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
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 0",
        }}>
          <div style={{ display: "flex", gap: 8, minHeight: 100, flexWrap: "wrap", justifyContent: "center" }}>
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
          padding: "12px 16px",
          background: "linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%)",
          display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap",
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
      </div>
    </div>
  );
}

function CardView({ cardByte, hidden, index }: { cardByte: number; hidden: boolean; index: number }) {
  if (hidden) {
    return (
      <div style={{
        width: 65, height: 95, borderRadius: 8,
        background: "linear-gradient(135deg, #1a3a6b 0%, #0d2240 100%)",
        border: "2px solid #4a6fa5",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
        animation: `cardDeal 0.4s ease-out ${index * 0.15}s both`,
      }}>
        <div style={{
          width: 45, height: 70, borderRadius: 4,
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
      width: 65, height: 95, borderRadius: 8,
      background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)",
      border: "2px solid #ccc",
      display: "flex", flexDirection: "column",
      padding: "4px 6px",
      boxShadow: "2px 3px 8px rgba(0,0,0,0.3)",
      position: "relative",
      animation: `cardDeal 0.4s ease-out ${index * 0.15}s both`,
    }}>
      <div style={{ color, fontSize: 14, fontWeight: "bold", lineHeight: 1 }}>{info.rank}</div>
      <div style={{ color, fontSize: 10, lineHeight: 1 }}>{symbol}</div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color, fontSize: 28 }}>
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
      width: 50, height: 50, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${bg}, ${bg}dd)`,
      border: selected ? `3px solid #ffd700` : `3px dashed ${fg}66`,
      color: fg, fontWeight: "bold", fontSize: 12,
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
      padding: "10px 24px", borderRadius: 8,
      background: color, color: "#fff", border: "2px solid rgba(255,255,255,0.2)",
      fontFamily: "inherit", fontSize: 14, fontWeight: "bold",
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
