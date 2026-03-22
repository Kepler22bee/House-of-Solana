"use client"

import { useEffect, useState, useRef } from 'react'
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, ReferenceLine } from 'recharts'

interface EthPriceChartProps {
  currentPrice: number | null
  lockPrice: number | null
}

interface PriceDataPoint {
  time: number
  price: number
}

export default function EthPriceChart({ currentPrice, lockPrice }: EthPriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PriceDataPoint[]>([])
  const priceRef = useRef<number | null>(null)
  const initRef = useRef(false)

  // Keep ref updated
  priceRef.current = currentPrice

  // Initialize and update - runs ONCE
  useEffect(() => {
    // Wait for price
    const waitForPrice = setInterval(() => {
      if (!priceRef.current || initRef.current) return

      initRef.current = true
      clearInterval(waitForPrice)

      const initialData: PriceDataPoint[] = []
      const now = Date.now()

      for (let i = 0; i < 30; i++) {
        initialData.push({
          time: now - (30 - i) * 2000,
          price: priceRef.current,
        })
      }

      console.log('📈 Chart initialized at $' + priceRef.current.toFixed(2))
      setPriceHistory(initialData)
    }, 500)

    // Update interval
    const updateInterval = setInterval(() => {
      if (!priceRef.current || !initRef.current) return

      setPriceHistory((prev) => {
        if (prev.length === 0) return prev
        return [...prev, { time: Date.now(), price: priceRef.current! }].slice(-60)
      })
      console.log(`📊 Updated: $${priceRef.current.toFixed(2)}`)
    }, 5000)

    return () => {
      clearInterval(waitForPrice)
      clearInterval(updateInterval)
    }
  }, [])

  if (priceHistory.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-black opacity-50 text-sm">
            {!currentPrice ? 'Loading ETH price...' : 'Initializing chart...'}
          </p>
          <p className="text-black opacity-30 text-xs mt-1">
            {currentPrice ? `Current: $${currentPrice.toFixed(2)}` : 'Fetching from Chainlink oracle'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={priceHistory} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide />

          {/* Reference line showing lock price (captured at 30s mark) */}
          {lockPrice !== null && (
            <ReferenceLine
              y={lockPrice}
              stroke="#000000"
              strokeDasharray="4 4"
              strokeWidth={2}
              opacity={0.5}
            />
          )}

          <Line
            type="monotone"
            dataKey="price"
            stroke="#000000"
            strokeWidth={4}
            dot={(props) => {
              const { cx, cy, index } = props
              // Only show dot on the last (current) data point
              if (index === priceHistory.length - 1) {
                return (
                  <g key={`dot-${index}`}>
                    {/* Outer pulse ring */}
                    <circle
                      key={`outer-${index}`}
                      cx={cx}
                      cy={cy}
                      r={8}
                      fill="#000000"
                      opacity={0.2}
                    />
                    {/* Inner solid dot */}
                    <circle
                      key={`inner-${index}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill="#000000"
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                  </g>
                )
              }
              // Return an empty element instead of null so the return type is always a React element
              return <g key={`dot-${index}`} />
            }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
