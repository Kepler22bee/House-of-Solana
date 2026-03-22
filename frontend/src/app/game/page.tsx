"use client";
import dynamic from "next/dynamic";
import { ControllerConnector } from "@cartridge/connector";
import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

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
  const { address } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [copyLabel, setCopyLabel] = useState("Copy");
  const shortAddr = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null;
  const controllerConnector = connectors.find(
    (connector) => connector.id === "controller",
  ) as ControllerConnector | undefined;

  useEffect(() => {
    if (copyLabel === "Copy") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyLabel("Copy"), 1500);
    return () => window.clearTimeout(timeout);
  }, [copyLabel]);

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

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    }
  };

  const handleCopyAddress = async () => {
    if (!address) {
      return;
    }

    const copied = await copyToClipboard(address);
    setCopyLabel(copied ? "Copied" : "Failed");
  };

  const handleConnect = async () => {
    if (!controllerConnector) {
      return;
    }

    // Cartridge iframe requires HTTPS — use redirect flow on localhost
    const isHttp = typeof window !== "undefined" && window.location.protocol === "http:";
    if (isHttp) {
      controllerConnector.controller.open({ redirectUrl: window.location.href });
      return;
    }

    try {
      await connectAsync({ connector: controllerConnector });
    } catch {
      controllerConnector.controller.open({ redirectUrl: window.location.href });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", background: "#0a0a0a" }}>
      <GameCanvas />
      {/* Wallet */}
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
          {address ? (
            <>
              <button
                type="button"
                onClick={handleCopyAddress}
                title={address}
                style={buttonStyle}
              >
                {shortAddr}
              </button>
              <button type="button" onClick={handleCopyAddress} style={buttonStyle}>
                {copyLabel}
              </button>
              <button type="button" onClick={() => disconnect()} style={buttonStyle}>
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={!controllerConnector || isPending}
              style={{
                ...buttonStyle,
                opacity: !controllerConnector || isPending ? 0.6 : 1,
                cursor: !controllerConnector || isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
