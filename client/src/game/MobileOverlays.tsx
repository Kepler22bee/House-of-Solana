"use client";
import { useState, useEffect, useCallback } from "react";

/** Rotate prompt — shown when phone is in portrait mode */
export function RotatePrompt() {
  const [isPortrait, setIsPortrait] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.95)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 20,
      fontFamily: "'Courier New', monospace",
      color: "#fdd835",
      padding: 30,
      textAlign: "center",
    }}>
      {/* Rotating phone icon */}
      <div style={{
        fontSize: 64,
        animation: "rotatePhone 2s ease-in-out infinite",
      }}>
        📱
      </div>
      <style>{`
        @keyframes rotatePhone {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-90deg); }
          50%, 75% { transform: rotate(-90deg); }
        }
      `}</style>
      <div style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2 }}>
        ROTATE YOUR DEVICE
      </div>
      <div style={{ fontSize: 12, color: "#888", maxWidth: 260, lineHeight: 1.6 }}>
        House of Solana plays best in landscape mode. Please rotate your phone sideways.
      </div>
    </div>
  );
}

/** Fullscreen button — small icon in top-right corner */
export function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  return (
    <button
      onClick={toggle}
      onTouchStart={(e) => { e.preventDefault(); toggle(); }}
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 90,
        width: 36,
        height: 36,
        borderRadius: 8,
        border: "1px solid #555",
        background: "rgba(0,0,0,0.7)",
        color: "#aaa",
        fontSize: 16,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
      }}
      title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
    >
      {isFullscreen ? "⊡" : "⛶"}
    </button>
  );
}
