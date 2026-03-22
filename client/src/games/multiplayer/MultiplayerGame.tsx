"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import {
  getSessionKeypair,
  callCreateTable,
  callJoinTable,
  callTableAction,
  callTableTimeout,
  fetchTable,
  fetchGameTemplate,
  fetchPlayer,
  getPlayerPDA,
  toFriendlyError,
  PublicKey,
} from "../../lib/solana";

interface MultiplayerGameProps {
  onClose: () => void;
}

type Phase = "lobby" | "waiting_opponent" | "playing" | "waiting_vrf" | "result";

const CHOICE_LABELS: Record<number, string> = {
  0: "HIT", 1: "STAND", 2: "FOLD", 3: "RAISE", 4: "CHECK",
  5: "HIGHER", 6: "LOWER", 7: "RED", 8: "BLACK",
};
const CHOICE_COLORS: Record<number, string> = {
  0: "#2ecc71", 1: "#e74c3c", 2: "#95a5a6", 3: "#f39c12", 4: "#3498db",
  5: "#2ecc71", 6: "#e74c3c", 7: "#e74c3c", 8: "#2c3e50",
};

const KEYFRAMES = `
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(255,152,0,0.3); }
  50%      { box-shadow: 0 0 40px rgba(255,152,0,0.5); }
}
`;

// Template IDs available for multiplayer
const TEMPLATE_IDS = [1, 2, 3];

function decodeTemplateName(nameBytes: number[]): string {
  const bytes = new Uint8Array(nameBytes);
  const end = bytes.indexOf(0);
  return new TextDecoder().decode(bytes.slice(0, end === -1 ? bytes.length : end)).trim() || "Unnamed";
}

function getStatusKey(status: unknown): string {
  if (!status || typeof status !== "object") return "unknown";
  return Object.keys(status)[0] || "unknown";
}

export default function MultiplayerGame({ onClose }: MultiplayerGameProps) {
  const keypair = getSessionKeypair();
  const myKey = keypair.publicKey.toBase58();
  const shortAddr = `${myKey.slice(0, 6)}...${myKey.slice(-4)}`;

  const [phase, setPhase] = useState<Phase>("lobby");
  const [templates, setTemplates] = useState<{ id: number; name: string; minBet: number; maxBet: number }[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [bet, setBet] = useState("");
  const [tableId, setTableId] = useState<number | null>(null);
  const [joinTableId, setJoinTableId] = useState("");
  const [chipBalance, setChipBalance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tableData, setTableData] = useState<{
    seat1: string; seat2: string;
    seat1Values: number[]; seat2Values: number[];
    sharedValues: number[];
    pot: number; currentTurn: number; winner: number;
    status: string; turnDeadline: number;
  } | null>(null);
  const [mySeat, setMySeat] = useState<1 | 2>(1);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { overlayRef.current?.focus(); }, []);

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
          });
        }
      }
      setTemplates(loaded);
    };
    load().catch(() => {});
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTable = useCallback(async (tId: number) => {
    const table = await fetchTable(keypair, tId);
    if (!table) return;
    const status = getStatusKey(table.status);
    setTableData({
      seat1: table.seat1?.toBase58?.() || "",
      seat2: table.seat2?.toBase58?.() || "",
      seat1Values: table.seat1Values || [],
      seat2Values: table.seat2Values || [],
      sharedValues: table.sharedValues || [],
      pot: Number(table.pot),
      currentTurn: table.currentTurn,
      winner: table.winner,
      status,
      turnDeadline: Number(table.turnDeadline),
    });

    const isSeat1 = table.seat1?.toBase58?.() === myKey;
    setMySeat(isSeat1 ? 1 : 2);

    if (status === "waitingSeat") {
      setPhase("waiting_opponent");
    } else if (status === "waitingTurn") {
      setPhase("playing");
    } else if (status === "waitingVrf" || status === "active") {
      setPhase("waiting_vrf");
    } else if (status === "settled") {
      setPhase("result");
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }
  }, [keypair, myKey]);

  const startPolling = useCallback((tId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => refreshTable(tId), 3000);
  }, [refreshTable]);

  const handleCreate = useCallback(async () => {
    if (selectedTemplate === null || !bet) return;
    const betNum = parseInt(bet);
    if (isNaN(betNum) || betNum <= 0) return;

    setError(null);
    setLoading(true);
    try {
      const tId = Date.now() % 1000000;
      await callCreateTable(keypair, tId, selectedTemplate, betNum);
      setTableId(tId);
      setPhase("waiting_opponent");
      startPolling(tId);
    } catch (e) {
      setError(toFriendlyError(e));
    }
    setLoading(false);
  }, [selectedTemplate, bet, keypair, startPolling]);

  const handleJoin = useCallback(async () => {
    if (selectedTemplate === null || !joinTableId) return;
    const tId = parseInt(joinTableId);
    if (isNaN(tId)) return;

    setError(null);
    setLoading(true);
    try {
      const table = await fetchTable(keypair, tId);
      if (!table) throw new Error("Table not found");
      const seat1Key = table.seat1 as PublicKey;
      await callJoinTable(keypair, tId, selectedTemplate, seat1Key);
      setTableId(tId);
      setMySeat(2);
      startPolling(tId);
    } catch (e) {
      setError(toFriendlyError(e));
    }
    setLoading(false);
  }, [selectedTemplate, joinTableId, keypair, startPolling]);

  const handleAction = useCallback(async (choiceBit: number) => {
    if (tableId === null || selectedTemplate === null || !tableData) return;
    setError(null);
    setLoading(true);
    try {
      const seat1 = new PublicKey(tableData.seat1);
      const seat2 = new PublicKey(tableData.seat2);
      await callTableAction(keypair, tableId, selectedTemplate, seat1, seat2, choiceBit);
      await refreshTable(tableId);
    } catch (e) {
      setError(toFriendlyError(e));
    }
    setLoading(false);
  }, [tableId, selectedTemplate, tableData, keypair, refreshTable]);

  const handleTimeout = useCallback(async () => {
    if (tableId === null || !tableData) return;
    setError(null);
    setLoading(true);
    try {
      const seat1 = new PublicKey(tableData.seat1);
      const seat2 = new PublicKey(tableData.seat2);
      await callTableTimeout(keypair, tableId, seat1, seat2);
      await refreshTable(tableId);
    } catch (e) {
      setError(toFriendlyError(e));
    }
    setLoading(false);
  }, [tableId, tableData, keypair, refreshTable]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); }
  }, [onClose]);

  const reset = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setPhase("lobby");
    setTableId(null);
    setTableData(null);
    setError(null);
    setBet("");
    setJoinTableId("");
    fetchPlayer(keypair).then((p) => { if (p) setChipBalance(Number(p.balance)); }).catch(() => {});
  };

  const isMyTurn = tableData && tableData.currentTurn === mySeat;
  const myValues = tableData ? (mySeat === 1 ? tableData.seat1Values : tableData.seat2Values) : [];
  const opponentValues = tableData ? (mySeat === 1 ? tableData.seat2Values : tableData.seat1Values) : [];
  const didWin = tableData ? tableData.winner === mySeat : false;
  const isDraw = tableData?.winner === 3;

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
        background: "linear-gradient(170deg, #1a0d00 0%, #0f0a05 40%, #1a0d05 100%)",
        border: "2px solid #ff9800",
        borderRadius: 16, padding: "24px 32px",
        position: "relative",
        animation: "glowPulse 4s ease-in-out infinite",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: "#ff9800", fontSize: 22, margin: 0, letterSpacing: 2 }}>MULTIPLAYER</h2>
            <p style={{ color: "#5a4a3a", fontSize: 11, margin: "2px 0 0" }}>PvP Tables</p>
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

        {/* Lobby */}
        {phase === "lobby" && (
          <div>
            {templates.length === 0 ? (
              <div style={{ textAlign: "center", color: "#555", padding: "40px 0" }}>
                No game templates available for multiplayer.
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: "#888", fontSize: 11, marginBottom: 6 }}>SELECT GAME</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {templates.map((t) => (
                      <button key={t.id} onClick={() => setSelectedTemplate(t.id)} style={{
                        padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                        border: selectedTemplate === t.id ? "2px solid #ff9800" : "2px solid #222",
                        background: selectedTemplate === t.id ? "rgba(255,152,0,0.1)" : "rgba(10,10,20,0.6)",
                        color: selectedTemplate === t.id ? "#ff9800" : "#888",
                        fontFamily: "inherit", fontSize: 12,
                      }}>{t.name}</button>
                    ))}
                  </div>
                </div>

                {selectedTemplate !== null && (
                  <>
                    <div style={{ color: "#ff9800", fontSize: 13, margin: "16px 0 8px" }}>CREATE TABLE</div>
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <input type="number" value={bet} onChange={(e) => setBet(e.target.value)} placeholder="Bet amount"
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#0a0a14", color: "#fdd835", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                      <button onClick={handleCreate} disabled={loading || !bet} style={{
                        padding: "8px 20px", borderRadius: 8, background: "#ff9800", color: "#fff",
                        border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
                        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
                      }}>{loading ? "..." : "CREATE"}</button>
                    </div>

                    <div style={{ color: "#ff9800", fontSize: 13, margin: "8px 0 8px" }}>OR JOIN TABLE</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type="number" value={joinTableId} onChange={(e) => setJoinTableId(e.target.value)} placeholder="Table ID"
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #333", background: "#0a0a14", color: "#ff9800", fontFamily: "inherit", fontSize: 13, outline: "none" }} />
                      <button onClick={handleJoin} disabled={loading || !joinTableId} style={{
                        padding: "8px 20px", borderRadius: 8, background: "#e65100", color: "#fff",
                        border: "none", fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
                        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
                      }}>{loading ? "..." : "JOIN"}</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* Waiting for opponent */}
        {phase === "waiting_opponent" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ color: "#ff9800", fontSize: 16, marginBottom: 8, animation: "pulse 2s infinite" }}>
              Waiting for opponent...
            </div>
            {tableId !== null && (
              <div style={{ color: "#888", fontSize: 12 }}>
                Table ID: <span style={{ color: "#fdd835", fontWeight: "bold" }}>{tableId}</span>
                <br /><span style={{ fontSize: 10, color: "#555" }}>Share this ID with your opponent</span>
              </div>
            )}
          </div>
        )}

        {/* Active gameplay */}
        {phase === "playing" && tableData && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <div style={{ color: "#888", fontSize: 10 }}>YOUR VALUES</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                  {myValues.map((v, i) => (
                    <span key={i} style={{ background: "rgba(255,152,0,0.15)", border: "1px solid #ff9800", borderRadius: 6, padding: "4px 8px", color: "#ff9800", fontSize: 13 }}>{v}</span>
                  ))}
                  {myValues.length === 0 && <span style={{ color: "#555", fontSize: 12 }}>--</span>}
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#fdd835", fontSize: 13 }}>POT: {tableData.pot}</div>
                <div style={{ color: isMyTurn ? "#4caf50" : "#e94560", fontSize: 11, marginTop: 4 }}>
                  {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "#888", fontSize: 10 }}>OPPONENT</div>
                <div style={{ display: "flex", gap: 4, marginTop: 4, justifyContent: "flex-end" }}>
                  {opponentValues.map((v, i) => (
                    <span key={i} style={{ background: "rgba(233,69,96,0.15)", border: "1px solid #e94560", borderRadius: 6, padding: "4px 8px", color: "#e94560", fontSize: 13 }}>{v}</span>
                  ))}
                  {opponentValues.length === 0 && <span style={{ color: "#555", fontSize: 12 }}>--</span>}
                </div>
              </div>
            </div>

            {isMyTurn && (
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                {[0, 1, 4].map((bit) => (
                  <button key={bit} onClick={() => handleAction(bit)} disabled={loading} style={{
                    padding: "10px 20px", borderRadius: 8,
                    background: CHOICE_COLORS[bit] || "#555", color: "#fff",
                    border: "2px solid rgba(255,255,255,0.2)",
                    fontFamily: "inherit", fontSize: 13, fontWeight: "bold",
                    cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1,
                  }}>{CHOICE_LABELS[bit] || `ACTION ${bit}`}</button>
                ))}
              </div>
            )}

            {!isMyTurn && (
              <div style={{ textAlign: "center" }}>
                <div style={{ color: "#888", fontSize: 12, marginBottom: 8 }}>Waiting for opponent...</div>
                <button onClick={handleTimeout} disabled={loading} style={{
                  padding: "6px 16px", borderRadius: 6,
                  background: "rgba(233,69,96,0.2)", color: "#e94560",
                  border: "1px solid #e94560", fontFamily: "inherit", fontSize: 11,
                  cursor: "pointer",
                }}>CLAIM TIMEOUT</button>
              </div>
            )}
          </div>
        )}

        {/* Waiting VRF */}
        {phase === "waiting_vrf" && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#ff9800" }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>Processing (VRF)...</div>
            <div style={{ fontSize: 11, color: "#555" }}>On-chain randomness being generated</div>
          </div>
        )}

        {/* Result */}
        {phase === "result" && tableData && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{
              fontSize: 28, fontWeight: "bold", letterSpacing: 2, marginBottom: 12,
              color: didWin ? "#4caf50" : isDraw ? "#fdd835" : "#e94560",
            }}>
              {didWin ? "YOU WIN!" : isDraw ? "DRAW" : "YOU LOST"}
            </div>
            {didWin && <div style={{ color: "#aaa", fontSize: 13 }}>Pot: {tableData.pot || "collected"}</div>}
            <button onClick={reset} style={{
              marginTop: 20, padding: "10px 32px", borderRadius: 8,
              background: "#ff9800", color: "#fff", border: "none",
              fontFamily: "inherit", fontSize: 14, fontWeight: "bold", cursor: "pointer",
            }}>BACK TO LOBBY</button>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 10, color: "#3a2a1a", marginTop: 16 }}>
          Press ESC to close
        </p>
      </div>
    </div>
  );
}
