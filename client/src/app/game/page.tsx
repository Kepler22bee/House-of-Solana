"use client";
import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useRef, type CSSProperties } from "react";
import {
  getSessionKeypair,
  clearSessionKeypair,
  authenticateTee,
  getBaseConnection,
  fetchPlayer,
  fetchBlackjackState,
  callInitializePlayer,
  callInitializeBlackjack,
  callSetupPermissions,
} from "../../lib/solana";
import { setPlayerMoney } from "../../game/GameCanvas";

const GameCanvas = dynamic(() => import("../../game/GameCanvas"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#0a0a0a" }}>
      <p style={{ color: "#fdd835", fontFamily: "'Courier New', monospace", fontSize: "18px" }}>
        Loading world...
      </p>
    </div>
  ),
});

export default function GamePage() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const keypair = getSessionKeypair();
      const pubkey = keypair.publicKey.toBase58();
      console.log("[Wallet] Session keypair:", pubkey);

      // Get SOL balance
      const conn = getBaseConnection();
      const bal = await conn.getBalance(keypair.publicKey);
      setBalance(bal / 1e9);

      // Authenticate with Private ER (TEE) — continue even if TEE is unavailable
      try {
        await authenticateTee(keypair);
        console.log("[Wallet] TEE authenticated");
      } catch (e) {
        console.warn("[Wallet] TEE auth unavailable, using base chain:", e);
      }

      // Initialize player on-chain if not yet done
      let player = await fetchPlayer(keypair);
      if (!player) {
        try {
          await callInitializePlayer(keypair);
          player = await fetchPlayer(keypair);
        } catch (e) {
          console.warn("[Wallet] Player init failed (may already exist):", e);
          player = await fetchPlayer(keypair);
        }
      }

      // Ensure blackjack PDA exists (for players created before blackjack was added)
      const bj = await fetchBlackjackState(keypair);
      if (!bj) {
        try {
          await callInitializeBlackjack(keypair);
          console.log("[Wallet] Blackjack account created");
        } catch (e) {
          console.warn("[Wallet] Blackjack init failed (may already exist):", e);
        }
      }

      // Setup Private ER permissions for game accounts (coin toss + blackjack)
      try {
        await callSetupPermissions(keypair);
        console.log("[Wallet] PER permissions set up");
      } catch (e) {
        console.warn("[Wallet] Permission setup skipped (may already exist):", e);
      }

      // Sync on-chain chip balance to game state
      if (player) {
        setPlayerMoney(Number(player.balance));
      }

      setAddress(pubkey);
      setStatus("connected");
    } catch (e) {
      console.error("[Wallet] Connection failed:", e);
      setError(e instanceof Error ? e.message : "Connection failed");
      setStatus("disconnected");
    }
  }, []);

  // Periodically sync on-chain chip balance
  const balanceInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (status !== "connected") return;
    const sync = () => {
      const kp = getSessionKeypair();
      fetchPlayer(kp).then((p) => {
        if (p) setPlayerMoney(Number(p.balance));
      }).catch(() => {});
    };
    balanceInterval.current = setInterval(sync, 5000);
    return () => { if (balanceInterval.current) clearInterval(balanceInterval.current); };
  }, [status]);

  const handleDisconnect = useCallback(() => {
    clearSessionKeypair();
    setAddress(null);
    setBalance(null);
    setStatus("disconnected");
  }, []);

  const buttonStyle: CSSProperties = {
    background: "rgba(0,0,0,0.85)",
    border: "2px solid #fdd835",
    borderRadius: 12,
    padding: "8px 16px",
    fontFamily: "'Courier New', monospace",
    fontSize: 16,
    fontWeight: "bold",
    color: "#fdd835",
    letterSpacing: 1,
    boxShadow: "0 0 20px rgba(253,216,53,0.3)",
    cursor: "pointer",
  };

  const shortAddr = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : null;

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0a0a0a" }}>
      <GameCanvas />
      <div
        style={{
          position: "fixed",
          top: 10,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          fontFamily: "'Courier New', monospace",
        }}
      >
        {status === "disconnected" && (
          <button type="button" style={buttonStyle} onClick={handleConnect}>
            Connect Wallet
          </button>
        )}

        {status === "connecting" && (
          <div style={{ ...buttonStyle, cursor: "default", opacity: 0.7 }}>
            Connecting...
          </div>
        )}

        {status === "connected" && shortAddr && (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div
              style={{
                background: "rgba(0,0,0,0.85)",
                border: "2px solid #4caf50",
                borderRadius: 12,
                padding: "8px 16px",
                fontFamily: "'Courier New', monospace",
                fontSize: 14,
                color: "#4caf50",
                letterSpacing: 1,
              }}
            >
              {shortAddr}
              {balance !== null && (
                <span style={{ color: "#fdd835", marginLeft: 8 }}>
                  {balance.toFixed(3)} SOL
                </span>
              )}
            </div>
            <button
              type="button"
              style={{ ...buttonStyle, fontSize: 12, padding: "6px 12px", borderColor: "#666", color: "#666" }}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              background: "rgba(233,69,96,0.15)",
              border: "1px solid #e94560",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              color: "#e94560",
              maxWidth: 300,
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
