"use client";
import { useState, useCallback, useMemo, useRef } from "react";

/* ─── types ─── */
type Suit = "hearts" | "diamonds" | "clubs" | "spades";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
interface Card { rank: Rank; suit: Suit; hidden?: boolean }

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CHIP_VALUES = [1, 5, 25, 100] as const;

const SUIT_SYMBOLS: Record<Suit, string> = { hearts: "\u2665", diamonds: "\u2666", clubs: "\u2663", spades: "\u2660" };
const SUIT_COLORS: Record<Suit, string> = { hearts: "#e74c3c", diamonds: "#e74c3c", clubs: "#1a1a2e", spades: "#1a1a2e" };

/* ─── Wakana expressions ─── */
const WAKANA_BASE = "/Wakana Merchant/wakana_merchant_";
type Expression = "neutral" | "happy" | "excited" | "devious" | "devious2" | "surprised" |
  "disappointed" | "pleased" | "annoyed" | "proud" | "sad" | "unimpressed";

function getDealerExpression(phase: Phase, result: Result | null): Expression {
  if (phase === "betting") return "neutral";
  if (phase === "playing") return "excited";
  if (phase === "dealer_turn") return "devious";
  // result phase
  if (result === "blackjack") return "surprised";
  if (result === "win") return "disappointed";
  if (result === "lose") return "proud";
  if (result === "push") return "pleased";
  return "neutral";
}

function getDefaultQuote(phase: Phase, result: Result | null): string {
  if (phase === "betting") return "Place your wager...";
  if (phase === "playing") return "Hit or stand?";
  if (phase === "dealer_turn") return "Let me see...";
  if (result === "blackjack") return "Blackjack?! Impressive...";
  if (result === "win") return "Well played...";
  if (result === "lose") return "Better luck next time~";
  if (result === "push") return "A tie! How rare.";
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

const WAKANA_SYSTEM = `You are Wakana, a charming and witty blackjack dealer at House of Stark casino. You're a young woman in a traditional merchant outfit. You're playful, slightly flirty but always classy — never crude. You deflect overly forward comments with humor. You love your job and sometimes tease players about their luck. Keep responses to 1-2 short sentences max. Use ~ occasionally. Never break character.`;

/* ─── helpers ─── */
function makeDeck(): Card[] {
  const d: Card[] = [];
  for (const suit of SUITS) for (const rank of RANKS) d.push({ rank, suit });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function cardValue(rank: Rank): number {
  if (rank === "A") return 11;
  if (["K", "Q", "J"].includes(rank)) return 10;
  return parseInt(rank);
}

function handTotal(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of hand) {
    if (c.hidden) continue;
    total += cardValue(c.rank);
    if (c.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(hand: Card[]): boolean {
  return hand.length === 2 && handTotal(hand) === 21;
}

type Phase = "betting" | "playing" | "dealer_turn" | "result";
type Result = "win" | "lose" | "push" | "blackjack";

interface Props {
  onClose: () => void;
  onResult?: (won: boolean, amount: number) => void;
  playerCoins: number;
}

export function BlackjackGame({ onClose, onResult, playerCoins }: Props) {
  const [deck, setDeck] = useState<Card[]>(() => makeDeck());
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [bet, setBet] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [doubled, setDoubled] = useState(false);

  const playerTotal = useMemo(() => handTotal(playerHand), [playerHand]);
  const dealerTotal = useMemo(() => handTotal(dealerHand), [dealerHand]);
  const expression = getDealerExpression(phase, result);
  const defaultQuote = getDefaultQuote(phase, result);

  // Flirt chat state
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [wakanaReply, setWakanaReply] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [showFlirtMenu, setShowFlirtMenu] = useState(false);
  const chatHistoryRef = useRef<{ role: string; content: string }[]>([]);

  const dealerQuote = wakanaReply || defaultQuote;

  const sendFlirt = async (msg: string) => {
    setShowFlirtMenu(false);
    setChatLoading(true);
    setWakanaReply("...");
    setChatMessages(prev => [...prev, { role: "user", text: msg }]);

    chatHistoryRef.current.push({ role: "user", content: msg });

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
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
      setChatMessages(prev => [...prev, { role: "assistant", text: reply }]);
      chatHistoryRef.current.push({ role: "assistant", content: reply });
      // Clear reply after 5s to return to game quotes
      setTimeout(() => setWakanaReply(null), 5000);
    } catch {
      setWakanaReply("Heh, I'm speechless~");
      setTimeout(() => setWakanaReply(null), 3000);
    }
    setChatLoading(false);
  };

  const draw = useCallback((d: Card[], n: number): [Card[], Card[]] => {
    const drawn = d.slice(0, n);
    const rest = d.slice(n);
    return [drawn, rest];
  }, []);

  const addChip = (val: number) => {
    if (phase !== "betting") return;
    if (bet + val > playerCoins) return;
    setBet(b => b + val);
  };

  const clearBet = () => { if (phase === "betting") setBet(0); };

  const deal = () => {
    if (bet <= 0) return;
    const fresh = makeDeck();
    const pCards = [fresh[0], fresh[2]];
    const dCards = [fresh[1], { ...fresh[3], hidden: true }];
    const remaining = fresh.slice(4);

    setDeck(remaining);
    setPlayerHand(pCards);
    setDealerHand(dCards);
    setDoubled(false);
    setResult(null);
    setMessage("");

    if (isBlackjack(pCards)) {
      const revealedDealer = dCards.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      if (isBlackjack(revealedDealer)) {
        setResult("push");
        setMessage("Both Blackjack! Push.");
        setPhase("result");
      } else {
        setResult("blackjack");
        setMessage("Blackjack! You win 3:2!");
        setPhase("result");
        onResult?.(true, Math.floor(bet * 1.5));
      }
    } else {
      setPhase("playing");
    }
  };

  const hit = () => {
    if (phase !== "playing") return;
    const [drawn, rest] = draw(deck, 1);
    const newHand = [...playerHand, ...drawn];
    setDeck(rest);
    setPlayerHand(newHand);
    const total = handTotal(newHand);
    if (total > 21) {
      const revealedDealer = dealerHand.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      setResult("lose");
      setMessage("Bust! You lose.");
      setPhase("result");
      onResult?.(false, doubled ? bet * 2 : bet);
    } else if (total === 21) {
      stand();
    }
  };

  const doubleBet = () => {
    if (phase !== "playing" || playerHand.length !== 2) return;
    if (bet * 2 > playerCoins) return;
    setDoubled(true);
    const [drawn, rest] = draw(deck, 1);
    const newHand = [...playerHand, ...drawn];
    setDeck(rest);
    setPlayerHand(newHand);
    const total = handTotal(newHand);
    if (total > 21) {
      const revealedDealer = dealerHand.map(c => ({ ...c, hidden: false }));
      setDealerHand(revealedDealer);
      setResult("lose");
      setMessage("Bust! You lose.");
      setPhase("result");
      onResult?.(false, bet * 2);
    } else {
      runDealerTurn(newHand, rest);
    }
  };

  const stand = () => {
    if (phase !== "playing") return;
    runDealerTurn(playerHand, deck);
  };

  const runDealerTurn = (pHand: Card[], currentDeck: Card[]) => {
    setPhase("dealer_turn");
    let dHand: Card[] = dealerHand.map(c => ({ ...c, hidden: false }));
    let d = [...currentDeck];

    while (handTotal(dHand) < 17) {
      const [drawn, rest] = draw(d, 1);
      dHand = [...dHand, ...drawn];
      d = rest;
    }

    setDealerHand(dHand);
    setDeck(d);

    const pTotal = handTotal(pHand);
    const dTotal = handTotal(dHand);
    const actualBet = doubled ? bet * 2 : bet;

    if (dTotal > 21) {
      setResult("win");
      setMessage("Dealer busts! You win!");
      onResult?.(true, actualBet);
    } else if (pTotal > dTotal) {
      setResult("win");
      setMessage("You win!");
      onResult?.(true, actualBet);
    } else if (pTotal < dTotal) {
      setResult("lose");
      setMessage("Dealer wins.");
      onResult?.(false, actualBet);
    } else {
      setResult("push");
      setMessage("Push. Bet returned.");
    }
    setPhase("result");
  };

  const newRound = () => {
    setBet(0);
    setPlayerHand([]);
    setDealerHand([]);
    setResult(null);
    setMessage("");
    setDoubled(false);
    setPhase("betting");
  };

  const actualBet = doubled ? bet * 2 : bet;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 900,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.85)",
      fontFamily: "'Courier New', monospace",
    }}>
      <div style={{
        display: "flex", alignItems: "stretch",
        maxWidth: "95vw", maxHeight: "90vh",
        gap: 0,
      }}>
        {/* Wakana dealer character - left side */}
        <div style={{
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
        </div>

        {/* Table */}
        <div style={{
          width: 650, height: 600,
          background: "radial-gradient(ellipse at 50% 40%, #1a6b3c 0%, #145a30 50%, #0e4525 100%)",
          borderRadius: "0 24px 24px 0",
          border: "4px solid #5a3a1a",
          borderLeft: "2px solid #5a3a1a",
          boxShadow: "0 0 0 4px #3a2510, 0 0 60px rgba(0,0,0,0.5), inset 0 0 80px rgba(0,0,0,0.3)",
          position: "relative",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Top bar */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "8px 16px",
            background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)",
          }}>
            <div style={{ color: "#ffd700", fontSize: 14, fontWeight: "bold" }}>
              BLACKJACK
            </div>
            <div style={{ color: "#ccc", fontSize: 12 }}>
              Coins: {playerCoins}
            </div>
            <button onClick={onClose} style={{
              background: "rgba(200,50,50,0.8)", color: "#fff", border: "none",
              borderRadius: 6, padding: "4px 12px", cursor: "pointer",
              fontFamily: "inherit", fontSize: 12, fontWeight: "bold",
            }}>X</button>
          </div>

          {/* Dealer area */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ color: "#aaa", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>
              Dealer {phase !== "betting" && phase !== "playing" ? `(${dealerTotal})` : dealerHand.length > 0 ? `(${handTotal(dealerHand.filter(c => !c.hidden))})` : ""}
            </div>
            <div style={{ display: "flex", gap: 8, minHeight: 100 }}>
              {dealerHand.map((c, i) => <CardView key={i} card={c} />)}
            </div>
          </div>

          {/* Message */}
          {message && (
            <div style={{
              textAlign: "center", padding: "8px 0",
              color: result === "win" || result === "blackjack" ? "#4cff4c" : result === "lose" ? "#ff6b6b" : "#ffd700",
              fontSize: 18, fontWeight: "bold",
              textShadow: "0 0 10px rgba(0,0,0,0.5)",
            }}>
              {message}
            </div>
          )}

          {/* Bet display */}
          <div style={{
            textAlign: "center", padding: "4px 0",
            color: "#ffd700", fontSize: 13,
          }}>
            {phase === "betting" ? (bet > 0 ? `Bet: ${bet} coins` : "Place your bet") : `Bet: ${actualBet} coins`}
          </div>

          {/* Player area */}
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <div style={{ display: "flex", gap: 8, minHeight: 100 }}>
              {playerHand.map((c, i) => <CardView key={i} card={c} />)}
            </div>
            <div style={{ color: "#ddd", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>
              You {playerHand.length > 0 ? `(${playerTotal})` : ""}
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
                {CHIP_VALUES.map(val => (
                  <ChipButton key={val} value={val} onClick={() => addChip(val)} disabled={bet + val > playerCoins} />
                ))}
                <ActionButton label="CLEAR" onClick={clearBet} color="#888" />
                <ActionButton label="DEAL" onClick={deal} color="#e6a817" disabled={bet <= 0} />
              </>
            )}
            {phase === "playing" && (
              <>
                <ActionButton label="HIT" onClick={hit} color="#2ecc71" />
                <ActionButton label="STAND" onClick={stand} color="#e74c3c" />
                <ActionButton
                  label="DOUBLE"
                  onClick={doubleBet}
                  color="#9b59b6"
                  disabled={playerHand.length !== 2 || bet * 2 > playerCoins}
                />
              </>
            )}
            {phase === "result" && (
              <ActionButton label="NEW HAND" onClick={newRound} color="#e6a817" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Card component ─── */
function CardView({ card }: { card: Card }) {
  if (card.hidden) {
    return (
      <div style={{
        width: 65, height: 95, borderRadius: 8,
        background: "linear-gradient(135deg, #1a3a6b 0%, #0d2240 100%)",
        border: "2px solid #4a6fa5",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "2px 3px 8px rgba(0,0,0,0.4)",
      }}>
        <div style={{
          width: 45, height: 70, borderRadius: 4,
          border: "1px solid #4a6fa5",
          background: "repeating-linear-gradient(45deg, #1a3a6b, #1a3a6b 4px, #1e4080 4px, #1e4080 8px)",
        }} />
      </div>
    );
  }

  const color = SUIT_COLORS[card.suit];
  const symbol = SUIT_SYMBOLS[card.suit];

  return (
    <div style={{
      width: 65, height: 95, borderRadius: 8,
      background: "linear-gradient(180deg, #fff 0%, #f0ece4 100%)",
      border: "2px solid #ccc",
      display: "flex", flexDirection: "column",
      padding: "4px 6px",
      boxShadow: "2px 3px 8px rgba(0,0,0,0.3)",
      position: "relative",
    }}>
      <div style={{ color, fontSize: 14, fontWeight: "bold", lineHeight: 1 }}>
        {card.rank}
      </div>
      <div style={{ color, fontSize: 10, lineHeight: 1 }}>
        {symbol}
      </div>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        color, fontSize: 28,
      }}>
        {symbol}
      </div>
      <div style={{
        position: "absolute", bottom: 4, right: 6,
        transform: "rotate(180deg)", color, fontSize: 14, fontWeight: "bold", lineHeight: 1,
      }}>
        {card.rank}
      </div>
    </div>
  );
}

/* ─── Chip button ─── */
function ChipButton({ value, onClick, disabled }: { value: number; onClick: () => void; disabled?: boolean }) {
  const colors: Record<number, [string, string]> = {
    1: ["#e8e8e8", "#999"],
    5: ["#e74c3c", "#fff"],
    25: ["#2ecc71", "#fff"],
    100: ["#9b59b6", "#fff"],
  };
  const [bg, fg] = colors[value] || ["#888", "#fff"];

  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 48, height: 48, borderRadius: "50%",
      background: `radial-gradient(circle at 35% 35%, ${bg}, ${bg}dd)`,
      border: `3px dashed ${fg}66`,
      color: fg, fontWeight: "bold", fontSize: 13,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      fontFamily: "inherit",
      boxShadow: "1px 2px 6px rgba(0,0,0,0.3)",
    }}>
      {value}
    </button>
  );
}

/* ─── Action button ─── */
function ActionButton({ label, onClick, color, disabled }: { label: string; onClick: () => void; color: string; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "8px 20px", borderRadius: 8,
      background: color, color: "#fff", border: "2px solid rgba(255,255,255,0.2)",
      fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.4 : 1,
      letterSpacing: 1,
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    }}>
      {label}
    </button>
  );
}

export default BlackjackGame;
