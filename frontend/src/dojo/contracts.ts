import { AccountInterface, RpcProvider, hash } from "starknet";
import {
  COIN_TOSS_ADDRESS,
  VRF_PROVIDER_ADDRESS,
  CASINO_ADDRESS,
  FEE_TOKEN_ADDRESS,
} from "./config";

// Default bet: 0.001 ETH = 1e15 wei (as u256 low/high)
const DEFAULT_BET_LOW = "0x38D7EA4C68000";
const DEFAULT_BET_HIGH = "0x0";

// No special tx opts needed — Cartridge Controller handles gas

// ERC721 Transfer event selector — keccak("Transfer")
const TRANSFER_SELECTOR = hash.getSelectorFromName("Transfer");

export interface GameResult {
  gameOver: boolean;
  won: boolean;
  score: number;
}

/**
 * Step 1: Approve + place bet in a single multicall.
 * Returns transaction_hash. Call getTokenIdFromReceipt after.
 */
export async function approveAndPlaceBet(account: AccountInterface, choice: number) {
  return account.execute([
    {
      contractAddress: FEE_TOKEN_ADDRESS,
      entrypoint: "approve",
      calldata: [
        CASINO_ADDRESS,  // spender
        DEFAULT_BET_LOW, // amount.low
        DEFAULT_BET_HIGH,// amount.high
      ],
    },
    {
      contractAddress: CASINO_ADDRESS,
      entrypoint: "place_bet",
      calldata: [
        choice.toString(), // choice: u8 (0=heads, 1=tails)
        "1",               // player_name: Option::None (variant tag 1)
      ],
    },
  ]);
}

/**
 * Extract the minted ERC721 token_id from the place_bet transaction receipt.
 * Looks for Transfer event with from=0 (mint).
 *
 * EGS FullTokenContract Transfer event layout (OZ ERC721 with indexed token_id):
 *   keys[0] = Transfer selector
 *   keys[1] = from (0x0 for mint)
 *   keys[2] = to (player)
 *   keys[3] = token_id low (u256)
 *   keys[4] = token_id high (u256, always 0 for u64 ids)
 *   data = [] (empty)
 */
export async function getTokenIdFromReceipt(
  provider: RpcProvider,
  txHash: string
): Promise<number> {
  const receipt = await provider.waitForTransaction(txHash, {
    retryInterval: 1000,
  });

  const events = (receipt as any).events ?? [];

  for (const event of events) {
    const keys: string[] = event.keys ?? [];

    if (keys[0] !== TRANSFER_SELECTOR) continue;

    // Mint: from = 0x0 (in keys[1])
    if (keys[1] === "0x0" || keys[1] === "0") {
      // token_id is in keys[3] (low of u256)
      return Number(BigInt(keys[3]));
    }
  }

  throw new Error("Token ID not found in transaction receipt");
}

/**
 * Step 3: VRF request + flip (multicall).
 * request_random MUST be the first call — Cartridge Paymaster wraps it.
 *
 * Source enum serialization for Source::Nonce(address):
 *   [0, address]  (0 = Nonce variant tag)
 */
export async function flipCoin(
  account: AccountInterface,
  tokenId: number,
  choice: number
) {
  return account.execute(
    [
      // First: request VRF randomness from Cartridge
      {
        contractAddress: VRF_PROVIDER_ADDRESS,
        entrypoint: "request_random",
        calldata: [
          COIN_TOSS_ADDRESS, // caller: ContractAddress
          "0",               // Source::Nonce variant tag
          COIN_TOSS_ADDRESS, // Nonce(coin_toss_address)
        ],
      },
      // Then: flip using that randomness
      {
        contractAddress: COIN_TOSS_ADDRESS,
        entrypoint: "flip",
        calldata: [
          tokenId.toString(), // token_id: u64
          choice.toString(),  // choice: u8
        ],
      },
    ],
  );
}

/**
 * Step 4: Settle the bet — reads game result, pays out if won.
 */
export async function settleBet(account: AccountInterface, tokenId: number) {
  return account.execute(
    {
      contractAddress: CASINO_ADDRESS,
      entrypoint: "settle",
      calldata: [tokenId.toString()], // token_id: u64
    },
  );
}

/**
 * Read the game result directly from the coin_toss contract via view calls.
 * Call this after settle to show the player their result.
 */
export async function readGameResult(
  provider: RpcProvider,
  tokenId: number
): Promise<GameResult> {
  const [gameOverRes, scoreRes] = await Promise.all([
    provider.callContract({
      contractAddress: COIN_TOSS_ADDRESS,
      entrypoint: "game_over",
      calldata: [tokenId.toString()],
    }),
    provider.callContract({
      contractAddress: COIN_TOSS_ADDRESS,
      entrypoint: "score",
      calldata: [tokenId.toString()],
    }),
  ]);

  const gameOver = gameOverRes[0] !== "0x0" && gameOverRes[0] !== "0";
  const score = Number(BigInt(scoreRes[0]));

  return { gameOver, won: score > 0, score };
}
