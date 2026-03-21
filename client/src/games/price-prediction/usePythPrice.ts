"use client"

import { useEffect, useState } from 'react'
import { HermesClient } from '@pythnetwork/hermes-client'
import { HERMES_ENDPOINT, SUPPORTED_TOKENS } from './pyth-config'

interface PriceData {
  price: number
  expo: number
  conf: number
  publishTime: number
}

interface UsePythPriceResult {
  price: number | null
  confidence: number | null
  lastUpdated: Date | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook to fetch real-time price data for a specific token from Pyth Network
 *
 * Uses Pyth's Hermes API to get the latest price feeds.
 * Automatically refreshes every 10 seconds and handles errors gracefully.
 *
 * @param tokenSymbol - The symbol of the token (e.g., 'ETH', 'BTC', 'SOL')
 * @returns Price data including current price, confidence interval, and loading state
 *
 * @example
 * ```tsx
 * const { price, isLoading, error } = usePythPrice('ETH')
 * if (isLoading) return <div>Loading...</div>
 * if (error) return <div>Error: {error}</div>
 * return <div>ETH Price: ${price?.toFixed(2)}</div>
 * ```
 */
export function usePythPrice(tokenSymbol: keyof typeof SUPPORTED_TOKENS): UsePythPriceResult {
  const [price, setPrice] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const tokenConfig = SUPPORTED_TOKENS[tokenSymbol]

    if (!tokenConfig) {
      setError(`Unsupported token: ${tokenSymbol}`)
      setIsLoading(false)
      return
    }

    const hermesClient = new HermesClient(HERMES_ENDPOINT, {})

    const fetchPrice = async () => {
      try {
        console.log(`📊 Fetching ${tokenSymbol} price from Pyth Hermes...`)

        // Get latest price updates from Hermes
        const priceUpdates = await hermesClient.getLatestPriceUpdates([tokenConfig.priceFeedId])

        if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
          throw new Error('No price data returned from Hermes')
        }

        const priceData = priceUpdates.parsed[0].price

        // Convert price based on exponent
        // Pyth prices are returned as price * 10^expo
        // For example: price=180523, expo=-2 means actual price is 1805.23
        const formattedPrice = Number(priceData.price) * Math.pow(10, priceData.expo)
        const formattedConf = Number(priceData.conf) * Math.pow(10, priceData.expo)

        console.log(`✅ ${tokenSymbol}/USD: $${formattedPrice.toFixed(2)}`)
        console.log(`   Confidence: ±$${formattedConf.toFixed(2)}`)
        console.log(`   Publish Time: ${new Date(priceData.publish_time * 1000).toLocaleTimeString()}`)

        setPrice(formattedPrice)
        setConfidence(formattedConf)
        setLastUpdated(new Date(priceData.publish_time * 1000))
        setIsLoading(false)
        setError(null)
      } catch (err) {
        console.error(`❌ Error fetching ${tokenSymbol} price from Pyth:`, err)
        setError(err instanceof Error ? err.message : 'Failed to fetch price')
        setIsLoading(false)
      }
    }

    // Fetch immediately
    fetchPrice()

    // Refresh price every 10 seconds
    const interval = setInterval(fetchPrice, 10000)

    return () => {
      clearInterval(interval)
    }
  }, [tokenSymbol])

  return {
    price,
    confidence,
    lastUpdated,
    isLoading,
    error,
  }
}

/**
 * Hook to fetch prices for multiple tokens at once
 *
 * More efficient than calling usePythPrice multiple times as it batches
 * the API request to Hermes.
 *
 * @param tokenSymbols - Array of token symbols to fetch
 * @returns Map of token symbols to their price data
 *
 * @example
 * ```tsx
 * const prices = usePythPrices(['ETH', 'BTC', 'SOL'])
 * return (
 *   <div>
 *     <div>ETH: ${prices.ETH?.price?.toFixed(2)}</div>
 *     <div>BTC: ${prices.BTC?.price?.toFixed(2)}</div>
 *     <div>SOL: ${prices.SOL?.price?.toFixed(2)}</div>
 *   </div>
 * )
 * ```
 */
export function usePythPrices(
  tokenSymbols: Array<keyof typeof SUPPORTED_TOKENS>
): Record<string, UsePythPriceResult> {
  const [prices, setPrices] = useState<Record<string, UsePythPriceResult>>({})

  useEffect(() => {
    const hermesClient = new HermesClient(HERMES_ENDPOINT, {})

    // Initialize loading state for all tokens
    const initialState: Record<string, UsePythPriceResult> = {}
    tokenSymbols.forEach((symbol) => {
      initialState[symbol] = {
        price: null,
        confidence: null,
        lastUpdated: null,
        isLoading: true,
        error: null,
      }
    })
    setPrices(initialState)

    const fetchPrices = async () => {
      try {
        console.log(`📊 Fetching prices for ${tokenSymbols.join(', ')} from Pyth Hermes...`)

        // Get all price feed IDs
        const priceFeedIds = tokenSymbols
          .map((symbol) => SUPPORTED_TOKENS[symbol]?.priceFeedId)
          .filter(Boolean)

        if (priceFeedIds.length === 0) {
          console.warn('No valid price feed IDs found')
          return
        }

        // Batch fetch all prices
        const priceUpdates = await hermesClient.getLatestPriceUpdates(priceFeedIds)

        if (!priceUpdates || !priceUpdates.parsed || priceUpdates.parsed.length === 0) {
          throw new Error('No price data returned from Hermes')
        }

        // Process each price update
        const newPrices: Record<string, UsePythPriceResult> = {}

        priceUpdates.parsed.forEach((update, index) => {
          const symbol = tokenSymbols[index]
          const priceData = update.price

          const formattedPrice = Number(priceData.price) * Math.pow(10, priceData.expo)
          const formattedConf = Number(priceData.conf) * Math.pow(10, priceData.expo)

          console.log(`✅ ${symbol}/USD: $${formattedPrice.toFixed(2)} (±$${formattedConf.toFixed(2)})`)

          newPrices[symbol] = {
            price: formattedPrice,
            confidence: formattedConf,
            lastUpdated: new Date(priceData.publish_time * 1000),
            isLoading: false,
            error: null,
          }
        })

        setPrices(newPrices)
      } catch (err) {
        console.error('❌ Error fetching prices from Pyth:', err)

        // Set error state for all tokens
        const errorState: Record<string, UsePythPriceResult> = {}
        tokenSymbols.forEach((symbol) => {
          errorState[symbol] = {
            price: null,
            confidence: null,
            lastUpdated: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Failed to fetch price',
          }
        })
        setPrices(errorState)
      }
    }

    // Fetch immediately
    fetchPrices()

    // Refresh prices every 10 seconds
    const interval = setInterval(fetchPrices, 10000)

    return () => {
      clearInterval(interval)
    }
  }, [tokenSymbols.join(',')]) // Only re-run if token list changes

  return prices
}
