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
        background: "#0a0b0d",
      }}
    >
      {/* Fixed Header */}
      <div
        className="absolute z-50 flex items-center justify-between pointer-events-none"
        style={{
          top: 'calc(1rem + env(safe-area-inset-top, 0px))',
          left: '1.5rem',
          right: '1.5rem',
        }}
      >
        <div className="pointer-events-auto">
          <h1 className="text-yellow-400 font-bold text-xl" style={{ fontFamily: "'Courier New', monospace" }}>
            PRICE PREDICTION
          </h1>
        </div>
        <div className="flex gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-yellow-500 rounded-full transition"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <span className="text-white text-lg">✕</span>
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'y mandatory',
          scrollSnapStop: 'always',
        }}
      >
        {markets.map((market) => (
          <div
            key={market}
            className="h-full w-full snap-start snap-always flex-shrink-0"
            style={{
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
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

      {/* Desktop Navigation Arrows */}
      {currentIndex > 0 && (
        <button
          onClick={() => scrollToMarket(currentIndex - 1)}
          className="absolute left-1/2 -translate-x-1/2 z-30 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition"
          style={{ top: 60 }}
        >
          <span className="text-gray-800 text-xl">↑</span>
        </button>
      )}

      {currentIndex < markets.length - 1 && (
        <button
          onClick={() => scrollToMarket(currentIndex + 1)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 p-3 bg-white rounded-full shadow-lg hover:bg-gray-100 transition"
        >
          <span className="text-gray-800 text-xl">↓</span>
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

      {/* ESC hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 16,
          zIndex: 50,
          color: 'rgba(255,255,255,0.3)',
          fontSize: 10,
          fontFamily: "'Courier New', monospace",
        }}
      >
        ESC to close
      </div>
    </div>
  )
}
