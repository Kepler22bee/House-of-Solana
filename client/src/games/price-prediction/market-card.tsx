"use client"

import { useState, useRef, useEffect } from "react"
import { usePriceWithFallback, type PriceSource } from "./usePriceWithFallback"
import { SUPPORTED_TOKENS } from "./pyth-config"
import EthPriceChart from "./eth-price-chart"

interface MarketCardProps {
  marketName: string
  onSwipeComplete: (direction: "up" | "down", marketName: string) => void
  hasSwipedThisRound: boolean
  onTimerReset: () => void
}

export default function MarketCard({ marketName, onSwipeComplete, hasSwipedThisRound, onTimerReset }: MarketCardProps) {
  const isSupported = marketName in SUPPORTED_TOKENS
  const tokenSymbol = isSupported ? marketName as keyof typeof SUPPORTED_TOKENS : 'ETH'

  const [preferredSource, setPreferredSource] = useState<PriceSource>('pyth')
  const { price, source, isLoading: isPriceLoading, error: priceError } = usePriceWithFallback(tokenSymbol, preferredSource)

  const [currentCardId, setCurrentCardId] = useState(1)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [isMagnetized, setIsMagnetized] = useState(false)
  const [timerProgress, setTimerProgress] = useState(0)
  const [lockPrice, setLockPrice] = useState<number | null>(null)
  const [currentEpoch, setCurrentEpoch] = useState(1)
  const dragStartX = useRef(0)
  const roundStartRef = useRef(Date.now())
  const lastResetEpochRef = useRef<number | null>(null)

  const ROUND_DURATION = 60
  const LOCK_TIME = 40

  // Simple local round timer
  useEffect(() => {
    roundStartRef.current = Date.now()

    const interval = setInterval(() => {
      const elapsed = (Date.now() - roundStartRef.current) / 1000
      const progress = Math.min((elapsed / ROUND_DURATION) * 100, 100)
      setTimerProgress(progress)

      // Lock price at LOCK_TIME
      if (elapsed >= LOCK_TIME && lockPrice === null && price !== null) {
        setLockPrice(price)
      }

      // Round ended
      if (elapsed >= ROUND_DURATION && lastResetEpochRef.current !== currentEpoch) {
        lastResetEpochRef.current = currentEpoch
        setLockPrice(null)
        setTimerProgress(0)
        roundStartRef.current = Date.now()
        setCurrentEpoch(e => e + 1)
        onTimerReset()
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentEpoch])

  const cards = [currentCardId, currentCardId + 1, currentCardId + 2]

  const elapsed = (Date.now() - roundStartRef.current) / 1000
  const isLockPhase = elapsed >= LOCK_TIME && elapsed < ROUND_DURATION
  const isRoundActive = elapsed < LOCK_TIME
  const isSwipeBlocked = !isRoundActive || isLockPhase || hasSwipedThisRound

  const showLockedPopup = isLockPhase && timerProgress < 100
  const showInactivePopup = false

  const handleDragStart = (clientX: number) => {
    if (isSwipeBlocked) return
    setIsDragging(true)
    setIsMagnetized(false)
    dragStartX.current = clientX
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging || isMagnetized || isSwipeBlocked) return
    const rawOffset = clientX - dragStartX.current
    const dragCoefficient = 0.5
    const offset = rawOffset * dragCoefficient
    const iconFullyVisibleThreshold = 80

    if (Math.abs(offset) >= iconFullyVisibleThreshold) {
      setIsMagnetized(true)
      setIsDragging(false)
      const direction = offset > 0 ? 1 : -1
      setDragOffset(direction * 500)
      setRotation(direction * 12)

      setTimeout(() => {
        setCurrentCardId(prev => prev + 1)
        setDragOffset(0)
        setRotation(0)
        setIsMagnetized(false)
        onSwipeComplete(direction > 0 ? "up" : "down", marketName)
      }, 400)
    } else {
      setDragOffset(offset)
      setRotation(offset / 20)
    }
  }

  const handleDragEnd = () => {
    if (isMagnetized) return
    setIsDragging(false)
    setDragOffset(0)
    setRotation(0)
  }

  const iconOpacity = Math.min(Math.abs(dragOffset) / 80, 0.6)
  const iconScale = Math.min(Math.abs(dragOffset) / 80, 1)

  return (
    <div className="relative h-full w-full overflow-hidden select-none">
      {/* Round Locked Popup */}
      {showLockedPopup && (
        <div className="absolute inset-0 z-[20] flex items-center justify-center pointer-events-none">
          <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-2xl px-8 py-6 mx-4 border-2 border-yellow-400">
            <p className="text-yellow-400 font-bold text-2xl sm:text-3xl text-center">
              ROUND LOCKED
            </p>
            <p className="text-white text-base sm:text-lg text-center mt-2 opacity-90">
              No more bets accepted
            </p>
          </div>
        </div>
      )}

      {/* Already Swiped Warning */}
      {hasSwipedThisRound && !showLockedPopup && (
        <div className="absolute inset-0 z-[20] flex items-center justify-center pointer-events-none">
          <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-2xl px-6 py-4 mx-4">
            <p className="text-yellow-400 font-bold text-lg sm:text-xl text-center">
              Already Swiped
            </p>
            <p className="text-white text-sm sm:text-base text-center mt-1 opacity-90">
              One swipe per round
            </p>
          </div>
        </div>
      )}

      {/* Swipe Feedback Icons */}
      {dragOffset > 0 && (
        <div
          className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 z-[15]"
          style={{
            opacity: iconOpacity,
            transform: `translateY(-50%) scale(${iconScale})`,
            transition: isMagnetized ? 'all 0.4s ease-out' : 'none',
          }}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
            <span className="text-white text-3xl sm:text-4xl font-bold">↑</span>
          </div>
        </div>
      )}

      {dragOffset < 0 && (
        <div
          className="absolute left-4 sm:left-8 top-1/2 -translate-y-1/2 z-[15]"
          style={{
            opacity: iconOpacity,
            transform: `translateY(-50%) scale(${iconScale})`,
            transition: isMagnetized ? 'all 0.4s ease-out' : 'none',
          }}
        >
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
            <span className="text-white text-3xl sm:text-4xl font-bold">↓</span>
          </div>
        </div>
      )}

      {/* Card Stack */}
      {cards.reverse().map((cardId, reverseIndex) => {
        const index = cards.length - 1 - reverseIndex
        const isTopCard = index === 0
        const opacity = 1 - (index * 0.15)

        return (
          <div
            key={cardId}
            className="absolute inset-4 sm:inset-6 bg-yellow-400 rounded-2xl sm:rounded-3xl p-4 sm:p-6 flex flex-col border border-yellow-500 select-none"
            style={{
              transform: isTopCard
                ? `translateX(${dragOffset}px) rotate(${rotation}deg)`
                : 'none',
              transition: isTopCard && (isDragging && !isMagnetized)
                ? 'none'
                : isTopCard && isMagnetized
                ? 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)'
                : 'all 0.6s cubic-bezier(0.4, 0.0, 0.2, 1)',
              zIndex: 10 - index,
              opacity: opacity,
              cursor: isTopCard ? (isSwipeBlocked ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab')) : 'default',
            }}
            onMouseDown={isTopCard ? (e) => handleDragStart(e.clientX) : undefined}
            onMouseMove={isTopCard ? (e) => handleDragMove(e.clientX) : undefined}
            onMouseUp={isTopCard ? handleDragEnd : undefined}
            onMouseLeave={isTopCard ? handleDragEnd : undefined}
            onTouchStart={isTopCard ? (e) => handleDragStart(e.touches[0].clientX) : undefined}
            onTouchMove={isTopCard ? (e) => handleDragMove(e.touches[0].clientX) : undefined}
            onTouchEnd={isTopCard ? handleDragEnd : undefined}
          >
            {showInactivePopup && (
              <div className="absolute inset-0 z-[20] flex items-center justify-center pointer-events-none">
                <div className="bg-black/80 backdrop-blur-sm rounded-2xl px-6 py-5 mx-4 border border-yellow-400/60 text-center">
                  <p className="text-yellow-400 font-bold text-xl sm:text-2xl">Waiting for next round</p>
                  <p className="text-yellow-100 opacity-80 text-sm mt-2">Rounds are not open yet. Please wait for the next start.</p>
                </div>
              </div>
            )}

            {/* Header Spacer */}
            <div
              className="mb-4 sm:mb-6"
              style={{
                height: 'calc(3rem + env(safe-area-inset-top, 0px))',
              }}
            />

            {/* Price Display */}
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center gap-2 mb-1 sm:mb-2">
                <p className="text-black opacity-90 text-3xl sm:text-4xl md:text-5xl">{marketName}/USD</p>
                <div className="flex items-center bg-black bg-opacity-10 rounded-full p-0.5 text-xs select-none">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPreferredSource('pyth') }}
                    className={`px-2 py-0.5 rounded-full transition-colors ${
                      source === 'pyth'
                        ? 'bg-yellow-300 text-black font-semibold'
                        : 'text-black opacity-50'
                    }`}
                  >
                    Pyth
                  </button>
                </div>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-black">
                {isPriceLoading ? (
                  <span className="opacity-50">Loading...</span>
                ) : priceError ? (
                  <span className="opacity-50 text-lg">Error loading price</span>
                ) : price !== null ? (
                  `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ) : (
                  <span className="opacity-50">--</span>
                )}
              </h2>
            </div>

            {/* Chart Area */}
            <div className="flex-1 mb-4 sm:mb-6 relative">
              {isSupported ? (
                <EthPriceChart currentPrice={price} lockPrice={lockPrice} />
              ) : (
                <>
                  <div className="absolute inset-0 flex items-end justify-center gap-0.5">
                    {Array.from({ length: 60 }).map((_, i) => {
                      const height = (Math.sin(i / 10) * 30 + 40).toFixed(2)
                      return (
                        <div
                          key={i}
                          className="flex-1 bg-yellow-500 opacity-60 rounded-t"
                          style={{ height: `${height}%` }}
                          suppressHydrationWarning
                        />
                      )
                    })}
                  </div>
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                    <polyline
                      points={Array.from({ length: 60 })
                        .map((_, i) => {
                          const y = (100 - (Math.sin(i / 10) * 30 + 40)).toFixed(2)
                          const x = ((i / 59) * 100).toFixed(2)
                          return `${x}% ${y}%`
                        })
                        .join(" ")}
                      fill="none"
                      stroke="rgba(0, 0, 0, 0.8)"
                      strokeWidth="2"
                      suppressHydrationWarning
                    />
                  </svg>
                </>
              )}
            </div>

            {/* Profit/Loss Info */}
            <div
              className="bg-yellow-500 rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-4 sm:mb-6 relative overflow-hidden"
            >
              {/* Timer Overlay */}
              <div
                className="absolute inset-0 bg-black pointer-events-none transition-all duration-75 ease-linear"
                style={{
                  width: `${timerProgress}%`,
                  opacity: 0.15,
                }}
              />

              <div className="relative z-10">
                <div className="mb-4 sm:mb-5">
                  <p className="text-black text-xs sm:text-sm opacity-75 mb-1">CURRENT ROUND #{currentEpoch}</p>
                  <p className="text-black font-bold text-2xl sm:text-3xl">
                    {isRoundActive ? 'SWIPE TO BET' : isLockPhase ? 'ROUND LOCKED' : 'ROUND ENDED'}
                  </p>
                  <p className="text-black text-xs sm:text-sm opacity-60">
                    {isRoundActive ? 'Swipe right = UP, left = DOWN' : isLockPhase ? 'Waiting for result...' : 'Next round starting...'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <p className="text-black text-xs sm:text-sm opacity-75 mb-1">Down (Bear)</p>
                    <p className="font-bold text-3xl sm:text-4xl" style={{ color: '#ed4b9e' }}>
                      1.95x
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-black text-xs sm:text-sm opacity-75 mb-1">Up (Bull)</p>
                    <p className="font-bold text-3xl sm:text-4xl" style={{ color: '#2e8656' }}>
                      1.95x
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Spacer */}
            <div
              style={{
                height: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
