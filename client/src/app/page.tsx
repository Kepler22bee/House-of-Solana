"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const [stars, setStars] = useState<{ x: number; y: number; size: number; opacity: number }[]>([]);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const s = Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.8 + 0.2,
    }));
    setStars(s);
  }, []);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0b0e2d 0%, #1a1040 40%, #2d1b4e 70%, #1a3a2a 100%)" }}>

      {/* Stars */}
      {stars.map((star, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            opacity: star.opacity,
            animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 3}s`,
          }}
        />
      ))}

      {/* Moon */}
      <div className="absolute top-12 right-24 w-20 h-20 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 35%, #fffde7, #fdd835)",
          boxShadow: "0 0 40px 10px rgba(253,216,53,0.3)",
        }}
      />

      {/* Ground silhouette */}
      <div className="absolute bottom-0 left-0 right-0 h-48"
        style={{
          background: "linear-gradient(0deg, #0d1a0d 0%, #1a3a2a 60%, transparent 100%)",
        }}
      />

      {/* Trees silhouettes */}
      <svg className="absolute bottom-20 left-10 w-32 h-40 opacity-60" viewBox="0 0 100 120">
        <polygon points="50,0 10,80 90,80" fill="#0d2818" />
        <polygon points="50,20 15,90 85,90" fill="#0a2015" />
        <rect x="42" y="80" width="16" height="30" fill="#1a0f0a" />
      </svg>
      <svg className="absolute bottom-16 right-16 w-24 h-36 opacity-50" viewBox="0 0 100 120">
        <polygon points="50,0 10,80 90,80" fill="#0d2818" />
        <polygon points="50,20 15,90 85,90" fill="#0a2015" />
        <rect x="42" y="80" width="16" height="30" fill="#1a0f0a" />
      </svg>
      <svg className="absolute bottom-12 left-1/3 w-20 h-28 opacity-40" viewBox="0 0 100 120">
        <polygon points="50,5 15,80 85,80" fill="#0d2818" />
        <rect x="42" y="75" width="16" height="25" fill="#1a0f0a" />
      </svg>

      {/* Title */}
      <div className="relative z-10 text-center mb-12">
        <h1
          className="text-6xl md:text-8xl font-bold mb-4 tracking-wider"
          style={{
            fontFamily: "'Courier New', monospace",
            color: "#fdd835",
            textShadow: "0 0 20px rgba(253,216,53,0.5), 0 4px 8px rgba(0,0,0,0.8), 2px 2px 0px #b8860b",
            letterSpacing: "0.15em",
          }}
        >
          PIXEL QUEST
        </h1>
        <p
          className="text-lg md:text-xl tracking-widest uppercase"
          style={{
            color: "#8ecae6",
            textShadow: "0 0 10px rgba(142,202,230,0.3)",
            letterSpacing: "0.3em",
          }}
        >
          Adventure Awaits
        </p>
      </div>

      {/* Animated character preview */}
      <div className="relative z-10 mb-12">
        <div
          className="w-16 h-16 mx-auto"
          style={{
            imageRendering: "pixelated",
            animation: "bounce 2s ease-in-out infinite",
          }}
        >
          <svg viewBox="0 0 16 16" width="64" height="64">
            {/* Hair */}
            <rect x="4" y="1" width="8" height="4" fill="#f5f5f5" />
            <rect x="3" y="2" width="1" height="3" fill="#f5f5f5" />
            <rect x="12" y="2" width="1" height="3" fill="#f5f5f5" />
            {/* Face */}
            <rect x="4" y="4" width="8" height="4" fill="#ffcc99" />
            {/* Eyes */}
            <rect x="5" y="5" width="2" height="2" fill="#2d1b4e" />
            <rect x="9" y="5" width="2" height="2" fill="#2d1b4e" />
            {/* Body / red cloak */}
            <rect x="3" y="8" width="10" height="5" fill="#c0392b" />
            <rect x="6" y="8" width="4" height="5" fill="#e74c3c" />
            {/* Legs */}
            <rect x="4" y="13" width="3" height="2" fill="#4a3728" />
            <rect x="9" y="13" width="3" height="2" fill="#4a3728" />
          </svg>
        </div>
      </div>

      {/* Play button */}
      <button
        onClick={() => router.push("/game")}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="relative z-10 px-12 py-4 text-2xl font-bold rounded-lg transition-all duration-300 cursor-pointer border-2"
        style={{
          fontFamily: "'Courier New', monospace",
          background: hover
            ? "linear-gradient(180deg, #fdd835, #f9a825)"
            : "linear-gradient(180deg, #f9a825, #f57f17)",
          color: "#1a0f0a",
          borderColor: "#fdd835",
          boxShadow: hover
            ? "0 0 30px rgba(253,216,53,0.6), 0 8px 32px rgba(0,0,0,0.4)"
            : "0 0 15px rgba(253,216,53,0.3), 0 4px 16px rgba(0,0,0,0.4)",
          transform: hover ? "scale(1.05)" : "scale(1)",
          letterSpacing: "0.2em",
        }}
      >
        ▶ PLAY
      </button>

      {/* Controls hint */}
      <div className="relative z-10 mt-8 text-center">
        <p className="text-sm opacity-50" style={{ color: "#8ecae6", fontFamily: "'Courier New', monospace" }}>
          WASD or Arrow Keys to move &middot; E to interact
        </p>
      </div>

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}
