"use client"

import { usePythPrice } from './usePythPrice'
import { SUPPORTED_TOKENS } from './pyth-config'

export type PriceSource = 'pyth'

interface PriceResult {
  price: number | null
  source: PriceSource | null
  isLoading: boolean
  error: string | null
}

export function usePriceWithFallback(
  tokenSymbol: keyof typeof SUPPORTED_TOKENS,
  _preferredSource: PriceSource = 'pyth'
): PriceResult {
  const { price, isLoading, error } = usePythPrice(tokenSymbol)

  return {
    price,
    source: price !== null ? 'pyth' : null,
    isLoading,
    error,
  }
}
