/**
 * Pyth Network Configuration for Base Network
 *
 * Documentation:
 * - Price Feed IDs: https://pyth.network/developers/price-feed-ids
 * - Hermes API: https://docs.pyth.network/price-feeds/api-instances-and-providers/hermes
 * - Base Integration: https://docs.base.org/learn/onchain-app-development/finance/access-real-time-asset-data-pyth-price-feeds
 */

// Pyth contract addresses on Base
export const PYTH_CONTRACT_ADDRESSES = {
  BASE_MAINNET: '0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a',
  BASE_SEPOLIA: '0xA2aa501b19aff244D90cc15a4Cf739D2725B5729',
} as const

// Hermes API endpoint (public - consider using a private endpoint in production)
export const HERMES_ENDPOINT = 'https://hermes.pyth.network'

// Token metadata with Pyth price feed IDs
export interface TokenConfig {
  symbol: string
  name: string
  priceFeedId: string
  decimals: number
  logo?: string
}

// Pyth Price Feed IDs (universal across all chains)
export const PYTH_PRICE_FEED_IDS = {
  ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  BNB_USD: '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
  SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  MATIC_USD: '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
  AVAX_USD: '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
  LINK_USD: '0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221',
  ARB_USD: '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
  OP_USD: '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
} as const

// Supported tokens configuration
export const SUPPORTED_TOKENS: Record<string, TokenConfig> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    priceFeedId: PYTH_PRICE_FEED_IDS.ETH_USD,
    decimals: 18,
  },
  BTC: {
    symbol: 'BTC',
    name: 'Bitcoin',
    priceFeedId: PYTH_PRICE_FEED_IDS.BTC_USD,
    decimals: 8,
  },
  BNB: {
    symbol: 'BNB',
    name: 'BNB',
    priceFeedId: PYTH_PRICE_FEED_IDS.BNB_USD,
    decimals: 18,
  },
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    priceFeedId: PYTH_PRICE_FEED_IDS.SOL_USD,
    decimals: 9,
  },
  MATIC: {
    symbol: 'MATIC',
    name: 'Polygon',
    priceFeedId: PYTH_PRICE_FEED_IDS.MATIC_USD,
    decimals: 18,
  },
  AVAX: {
    symbol: 'AVAX',
    name: 'Avalanche',
    priceFeedId: PYTH_PRICE_FEED_IDS.AVAX_USD,
    decimals: 18,
  },
  LINK: {
    symbol: 'LINK',
    name: 'Chainlink',
    priceFeedId: PYTH_PRICE_FEED_IDS.LINK_USD,
    decimals: 18,
  },
  ARB: {
    symbol: 'ARB',
    name: 'Arbitrum',
    priceFeedId: PYTH_PRICE_FEED_IDS.ARB_USD,
    decimals: 18,
  },
  OP: {
    symbol: 'OP',
    name: 'Optimism',
    priceFeedId: PYTH_PRICE_FEED_IDS.OP_USD,
    decimals: 18,
  },
} as const

// Get all supported token symbols
export const SUPPORTED_TOKEN_SYMBOLS = Object.keys(SUPPORTED_TOKENS) as Array<keyof typeof SUPPORTED_TOKENS>

// Get all price feed IDs for bulk fetching
export const ALL_PRICE_FEED_IDS = SUPPORTED_TOKEN_SYMBOLS.map(
  (symbol) => SUPPORTED_TOKENS[symbol].priceFeedId
)
