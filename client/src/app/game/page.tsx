"use client";
import dynamic from "next/dynamic";
import type { CSSProperties } from "react";

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
  // TODO: Replace with Solana wallet integration
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
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" style={buttonStyle}>
            Connect Wallet
          </button>
        </div>
      </div>
    </div>
  );
}
