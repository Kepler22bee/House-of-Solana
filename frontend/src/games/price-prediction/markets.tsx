"use client"

import MarketCard from "./market-card"
import CommitPopup from "./commit-popup"
import { useRef, useEffect, useState } from "react"

interface PricePredictionGameProps {
  onClose: () => void
}

export default function PricePredictionGame({ onClose }: PricePredictionGameProps) {
  const markets = ["ETH", "BTC", "SOL", "BNB", "AVAX", "LINK", "ARB", "OP"]
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showCommitPopup, setShowCommitPopup] = useState(false)
  const [commitDirection, setCommitDirection] = useState<"up" | "down">("up")
  const [swipesByMarket, setSwipesByMarket] = useState<Record<string, number>>({})
  const [currentEpoch, setCurrentEpoch] = useState(1)

  // ESC to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showCommitPopup) {
          setShowCommitPopup(false)
        } else {
          onClose()
        }
        e.stopPropagation()
      }
    }
    window.addEventListener("keydown", handleKey, { capture: true })
    return () => window.removeEventListener("keydown", handleKey, { capture: true })
  }, [onClose, showCommitPopup])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    let scrollTimeout: NodeJS.Timeout

    const handleScroll = () => {
      clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const scrollTop = container.scrollTop
        const itemHeight = container.clientHeight
        const index = Math.round(scrollTop / itemHeight)
        setCurrentIndex(index)

        container.scrollTo({
          top: index * itemHeight,
          behavior: 'smooth'
        })
      }, 150)
    }

    container.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      container.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimeout)
    }
  }, [])

  const scrollToMarket = (index: number) => {
    const container = scrollContainerRef.current
    if (!container) return

    const itemHeight = container.clientHeight
    container.scrollTo({
      top: index * itemHeight,
      behavior: 'smooth'
    })
    setCurrentIndex(index)
  }

  const handleSwipeComplete = (direction: "up" | "down", marketName: string) => {
    setCommitDirection(direction)
    setShowCommitPopup(true)
    setSwipesByMarket((prev) => ({
      ...prev,
      [marketName]: currentEpoch,
    }))
  }

  const handleCommitConfirm = (amount: string) => {
    console.log(`Committed ${amount} betting ${commitDirection.toUpperCase()}`)
    setShowCommitPopup(false)
  }

  const handleTimerReset = () => {
    setSwipesByMarket({})
    setCurrentEpoch(e => e + 1)
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      {/* Ancient tablet frame */}
      <div
        style={{
          width: 380,
          height: 700,
          background: "linear-gradient(160deg, #5a4a30 0%, #3d3020 30%, #2a2015 60%, #3d3020 100%)",
          borderRadius: 24,
          border: "4px solid #8a7a50",
          boxShadow: "0 20px 60px rgba(0,0,0,0.7), inset 0 2px 0 rgba(200,180,120,0.2), inset 0 -2px 0 rgba(0,0,0,0.4)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Ornamental top carving */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 32,
            background: "linear-gradient(90deg, transparent 10%, rgba(200,168,78,0.15) 30%, rgba(253,216,53,0.1) 50%, rgba(200,168,78,0.15) 70%, transparent 90%)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{
            color: "#c8a84e",
            fontSize: 11,
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.3em",
            fontWeight: "bold",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}>
            &#9670; ORACLE TABLET &#9670;
          </span>
        </div>

        {/* Screen area — ancient glass */}
        <div
          style={{
            flex: 1,
            borderRadius: 16,
            overflow: "hidden",
            margin: "32px 8px 4px",
            position: "relative",
            background: "#0a0b0d",
            border: "2px solid #5a4a30",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
          }}
        >
          {/* Header */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 50,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px 6px",
              background: "linear-gradient(180deg, rgba(10,11,13,0.95) 60%, transparent)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                color: "#c8a84e",
                fontWeight: "bold",
                fontSize: 13,
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.1em",
                pointerEvents: "auto",
              }}
            >
              PRICE ORACLE
            </span>
            <button
              onClick={onClose}
              style={{
                background: "rgba(200,168,78,0.2)",
                border: "1px solid #8a7a50",
                borderRadius: 6,
                width: 24,
                height: 24,
                color: "#c8a84e",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "auto",
                fontFamily: "'Courier New', monospace",
                fontWeight: "bold",
              }}
            >
              X
            </button>
          </div>

          {/* Scrollable market cards */}
          <div
            ref={scrollContainerRef}
            style={{
              height: "100%",
              overflowY: "scroll",
              scrollSnapType: "y mandatory",
              WebkitOverflowScrolling: "touch",
            }}
            className="scrollbar-hide"
          >
            {markets.map((market) => (
              <div
                key={market}
                style={{
                  height: "100%",
                  width: "100%",
                  scrollSnapAlign: "start",
                  flexShrink: 0,
                }}
              >
                <MarketCard
                  marketName={market}
                  onSwipeComplete={handleSwipeComplete}
                  hasSwipedThisRound={swipesByMarket[market] === currentEpoch}
                  onTimerReset={handleTimerReset}
                />
              </div>
            ))}
          </div>

          {/* Nav arrows */}
          {currentIndex > 0 && (
            <button
              onClick={() => scrollToMarket(currentIndex - 1)}
              style={{
                position: "absolute",
                top: 56,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 30,
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              ↑
            </button>
          )}

          {currentIndex < markets.length - 1 && (
            <button
              onClick={() => scrollToMarket(currentIndex + 1)}
              style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 30,
                background: "rgba(255,255,255,0.9)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              ↓
            </button>
          )}

          {/* Commit Popup */}
          {showCommitPopup && (
            <CommitPopup
              direction={commitDirection}
              onConfirm={handleCommitConfirm}
              onCancel={() => setShowCommitPopup(false)}
            />
          )}
        </div>

        {/* Phone home bar */}
        <div
          style={{
            height: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 100,
              height: 4,
              background: "#444",
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* ESC hint outside phone */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          color: "rgba(255,255,255,0.3)",
          fontSize: 11,
          fontFamily: "'Courier New', monospace",
        }}
      >
        Esc: Close
      </div>
    </div>
  )
}
