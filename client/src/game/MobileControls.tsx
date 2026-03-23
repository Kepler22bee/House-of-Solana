"use client";
import { useRef, useCallback, useEffect, useState } from "react";

interface MobileControlsProps {
  keysRef: React.RefObject<Set<string>>;
  onInteract: () => void;
  onToggleChat: () => void;
  onToggleAgentMenu: () => void;
}

const JOYSTICK_SIZE = 120;
const KNOB_SIZE = 44;
const BTN_SIZE = 50;
const DEADZONE = 12;

function releaseAll(keysRef: React.RefObject<Set<string>>) {
  keysRef.current?.delete("ArrowUp");
  keysRef.current?.delete("ArrowDown");
  keysRef.current?.delete("ArrowLeft");
  keysRef.current?.delete("ArrowRight");
}

export default function MobileControls({ keysRef, onInteract, onToggleChat, onToggleAgentMenu }: MobileControlsProps) {
  const joystickRef = useRef<HTMLDivElement>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const handleJoystickTouch = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = joystickRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Track the first touch that started on the joystick
    let touch: React.Touch | undefined;
    if (touchIdRef.current !== null) {
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchIdRef.current) {
          touch = e.touches[i];
          break;
        }
      }
    }
    if (!touch) {
      touch = e.touches[0];
      touchIdRef.current = touch.identifier;
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = touch.clientX - cx;
    let dy = touch.clientY - cy;

    // Clamp to circle
    const maxR = JOYSTICK_SIZE / 2 - KNOB_SIZE / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }

    setKnobOffset({ x: dx, y: dy });

    releaseAll(keysRef);
    if (Math.abs(dx) > DEADZONE) {
      keysRef.current?.add(dx > 0 ? "ArrowRight" : "ArrowLeft");
    }
    if (Math.abs(dy) > DEADZONE) {
      keysRef.current?.add(dy > 0 ? "ArrowDown" : "ArrowUp");
    }
  }, [keysRef]);

  const handleJoystickEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    // Only release if our tracked touch ended
    if (touchIdRef.current !== null) {
      let stillActive = false;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchIdRef.current) {
          stillActive = true;
          break;
        }
      }
      if (!stillActive) {
        touchIdRef.current = null;
        setKnobOffset({ x: 0, y: 0 });
        releaseAll(keysRef);
      }
    }
  }, [keysRef]);

  // Prevent scrolling on touch
  useEffect(() => {
    const handler = (e: TouchEvent) => {
      if ((e.target as HTMLElement)?.closest?.(".mobile-controls")) {
        e.preventDefault();
      }
    };
    document.addEventListener("touchmove", handler, { passive: false });
    return () => document.removeEventListener("touchmove", handler);
  }, []);

  return (
    <div
      className="mobile-controls"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 80,
        touchAction: "none",
      }}
    >
      {/* Joystick (bottom-left) */}
      <div
        ref={joystickRef}
        onTouchStart={handleJoystickTouch}
        onTouchMove={handleJoystickTouch}
        onTouchEnd={handleJoystickEnd}
        onTouchCancel={handleJoystickEnd}
        style={{
          position: "absolute",
          bottom: 24,
          left: 16,
          width: JOYSTICK_SIZE,
          height: JOYSTICK_SIZE,
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        {/* Base ring */}
        <div style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.15)",
          background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.3) 100%)",
        }} />
        {/* Knob */}
        <div style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: KNOB_SIZE,
          height: KNOB_SIZE,
          borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, rgba(255,255,255,0.25), rgba(255,255,255,0.08))",
          border: "2px solid rgba(255,255,255,0.3)",
          transform: `translate(calc(-50% + ${knobOffset.x}px), calc(-50% + ${knobOffset.y}px))`,
          transition: knobOffset.x === 0 && knobOffset.y === 0 ? "transform 0.15s ease-out" : "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }} />
      </div>

      {/* Action buttons (bottom-right) */}
      <div style={{
        position: "absolute",
        bottom: 24,
        right: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignItems: "flex-end",
        pointerEvents: "auto",
        touchAction: "none",
      }}>
        {/* Interact (E) — biggest button */}
        <button
          onTouchStart={(e) => { e.preventDefault(); onInteract(); }}
          style={actionBtnStyle("#fdd835", "#1a1a0a", BTN_SIZE + 6)}
        >
          E
        </button>

        {/* Row: Chat + Agent */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onTouchStart={(e) => { e.preventDefault(); onToggleChat(); }}
            style={actionBtnStyle("#88ccff", "#0a1a2e", BTN_SIZE - 6)}
          >
            T
          </button>
          <button
            onTouchStart={(e) => { e.preventDefault(); onToggleAgentMenu(); }}
            style={actionBtnStyle("#ff8866", "#1a0a0a", BTN_SIZE - 6)}
          >
            B
          </button>
        </div>
      </div>
    </div>
  );
}

function actionBtnStyle(color: string, bg: string, size: number): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: "50%",
    border: `2px solid ${color}`,
    background: bg,
    color: color,
    fontSize: size > 50 ? 18 : 13,
    fontWeight: "bold",
    fontFamily: "'Courier New', monospace",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    opacity: 0.7,
    boxShadow: `0 0 10px ${color}33`,
    touchAction: "none",
    WebkitTapHighlightColor: "transparent",
  };
}
