/**
 * Solana Integration Layer — MagicBlock Private Ephemeral Rollups (TEE)
 *
 * Uses a locally-generated session Keypair stored in localStorage.
 * All transactions are auto-signed — no wallet popups during gameplay.
 * Private ER uses Intel TDX TEE for confidential state execution.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import {
  verifyTeeRpcIntegrity,
  getAuthToken,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import nacl from "tweetnacl";
import idlJSON from "./casino-idl.json";
import { txPending, txConfirmed, txError } from "./txlog";

// ===== CONSTANTS =====

// Placeholder — replace with actual deployed program ID
const PROGRAM_ID = new PublicKey(
  "11111111111111111111111111111111"
);

const BASE_RPC_URL = "https://api.devnet.solana.com";
const TEE_ER_BASE_URL = "https://tee.magicblock.app";

const DELEGATION_PROGRAM_ID = new PublicKey(
  "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh"
);
const PERMISSION_PROGRAM_ID = new PublicKey(
  "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1"
);
const MAGIC_PROGRAM_ID = new PublicKey(
  "Magic11111111111111111111111111111111111111"
);
const MAGIC_CONTEXT_ID = new PublicKey(
  "MagicContext1111111111111111111111111111111"
);

const PLAYER_SEED = "player";
const COIN_TOSS_SEED = "coin_toss";

const SESSION_KEY = "hos_session_keypair";
const ER_DELEGATION_KEY = "hos_er_delegated";
const TEE_TOKEN_KEY = "hos_tee_token";

// ===== ERROR HELPERS =====

function normalizeProgramError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function isBlockhashTransientError(error: unknown): boolean {
  const msg = normalizeProgramError(error).toLowerCase();
  return (
    msg.includes("blockhash not found") ||
    msg.includes("block height exceeded") ||
    msg.includes("transaction expired")
  );
}

async function withBlockhashRetry<T>(
  run: () => Promise<T>,
  retries = 1
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await run();
    } catch (error) {
      if (attempt >= retries || !isBlockhashTransientError(error)) {
        throw error;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

export function toFriendlyError(error: unknown): string {
  const msg = normalizeProgramError(error);
  if (msg.includes("AlreadyInitialized")) {
    return "Player already initialized.";
  }
  if (msg.includes("InvalidChoice")) {
    return "Choice must be heads (0) or tails (1).";
  }
  if (msg.includes("BetTooLarge")) {
    return "Bet amount exceeds your balance.";
  }
  if (msg.includes("AlreadySettled")) {
    return "This coin toss is already settled.";
  }
  if (isBlockhashTransientError(error)) {
    return "Network blockhash expired. Please retry.";
  }
  if (msg.includes("insufficient funds for fee")) {
    return "Not enough SOL for transaction fees.";
  }
  return msg;
}

function isIgnorableDelegationError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("already in use") ||
    lower.includes("already delegated") ||
    lower.includes("already initialized") ||
    lower.includes("instruction modified data of an account it does not own")
  );
}

// ===== SESSION KEYPAIR =====

export function getSessionKeypair(): Keypair {
  if (typeof window === "undefined") return Keypair.generate();

  const stored = localStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const bytes = new Uint8Array(JSON.parse(stored));
      return Keypair.fromSecretKey(bytes);
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }

  const kp = Keypair.generate();
  localStorage.setItem(SESSION_KEY, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

export function clearSessionKeypair(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(TEE_TOKEN_KEY);
  for (let i = localStorage.length - 1; i >= 0; i -= 1) {
    const k = localStorage.key(i);
    if (k && k.startsWith(`${ER_DELEGATION_KEY}:`)) {
      localStorage.removeItem(k);
    }
  }
}

// ===== TEE AUTHENTICATION =====

let _teeToken: string | null = null;
let _teeErUrl: string | null = null;

export async function authenticateTee(keypair: Keypair): Promise<string> {
  // Return cached token if available
  if (_teeToken && _teeErUrl) return _teeErUrl;

  const cached = localStorage.getItem(TEE_TOKEN_KEY);
  if (cached) {
    _teeToken = cached;
    _teeErUrl = `${TEE_ER_BASE_URL}?token=${cached}`;
    return _teeErUrl;
  }

  console.log("[TEE] Verifying TEE RPC integrity...");
  const isVerified = await verifyTeeRpcIntegrity(TEE_ER_BASE_URL);
  if (!isVerified) {
    throw new Error("TEE RPC integrity verification failed");
  }
  console.log("[TEE] RPC integrity verified");

  console.log("[TEE] Acquiring auth token...");
  const authResult = await getAuthToken(
    TEE_ER_BASE_URL,
    keypair.publicKey,
    (message: Uint8Array) =>
      Promise.resolve(nacl.sign.detached(message, keypair.secretKey))
  );

  // getAuthToken may return { token, expiresAt } or a string depending on SDK version
  const tokenStr = typeof authResult === "string" ? authResult : authResult.token;

  _teeToken = tokenStr;
  _teeErUrl = `${TEE_ER_BASE_URL}?token=${tokenStr}`;
  localStorage.setItem(TEE_TOKEN_KEY, tokenStr);
  console.log("[TEE] Auth token acquired");

  return _teeErUrl;
}

// ===== CONNECTION / PROVIDER / PROGRAM =====

let _baseConnection: Connection | null = null;
let _erConnection: Connection | null = null;

export function getBaseConnection(): Connection {
  if (!_baseConnection) {
    _baseConnection = new Connection(BASE_RPC_URL, "confirmed");
  }
  return _baseConnection;
}

export function getErConnection(): Connection {
  if (!_erConnection) {
    const url = _teeErUrl || TEE_ER_BASE_URL;
    _erConnection = new Connection(url, {
      commitment: "confirmed",
      wsEndpoint: url.replace("https://", "wss://"),
    });
  }
  return _erConnection;
}

/** Reset ER connection (e.g. after new TEE auth) */
export function resetErConnection(): void {
  _erConnection = null;
}

class SessionWallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() {
    return this.payer.publicKey;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signTransaction(tx: any) {
    tx.partialSign(this.payer);
    return tx;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async signAllTransactions(txs: any[]) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}

type Network = "base" | "er";

export function getProvider(
  keypair: Keypair,
  network: Network = "er"
): AnchorProvider {
  const connection = network === "er" ? getErConnection() : getBaseConnection();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = new SessionWallet(keypair) as any;
  const opts =
    network === "er"
      ? {
          commitment: "processed" as const,
          preflightCommitment: "processed" as const,
          skipPreflight: true,
          maxRetries: 5,
        }
      : { commitment: "confirmed" as const };
  return new AnchorProvider(connection, wallet, opts);
}

export function getProgram(
  keypair: Keypair,
  network: Network = "er"
): Program {
  const provider = getProvider(keypair, network);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const idl = { ...idlJSON } as any;
  idl.address = PROGRAM_ID.toString();
  return new Program(idl, provider);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendMethodTx(
  keypair: Keypair,
  network: Network,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buildMethod: () => any
): Promise<string> {
  if (network === "er") {
    return withBlockhashRetry(async () => {
      const tx = await buildMethod().transaction();
      const connection = getErConnection();
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("processed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = keypair.publicKey;
      tx.sign(keypair);
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 5,
      });
      void connection
        .confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "processed"
        )
        .catch(() => {});
      return signature;
    });
  }

  return withBlockhashRetry(async () => buildMethod().rpc());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAccountWithFallback(
  keypair: Keypair,
  accountName: string,
  pda: PublicKey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const networks: Network[] = ["er", "base"];
  for (const network of networks) {
    try {
      const program = getProgram(keypair, network);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await (program.account as any)[accountName].fetch(pda);
    } catch {
      // try next network
    }
  }
  return null;
}

// ===== PDA HELPERS =====

export function getPlayerPDA(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), player.toBuffer()],
    PROGRAM_ID
  );
}

export function getCoinTossStatePDA(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(COIN_TOSS_SEED), player.toBuffer()],
    PROGRAM_ID
  );
}

// ===== DELEGATION (Private ER — TEE) =====

function getDelegationCacheKey(player: PublicKey): string {
  return `${ER_DELEGATION_KEY}:${TEE_ER_BASE_URL}:${player.toBase58()}`;
}

async function delegatePda(
  keypair: Keypair,
  methodName: string,
  pda: PublicKey,
  label: string
): Promise<void> {
  const accountInfo = await getBaseConnection().getAccountInfo(pda, "confirmed");
  if (!accountInfo) return;
  if (!accountInfo.owner.equals(PROGRAM_ID)) return; // already delegated

  const id = txPending(`Delegate ${label}`);
  try {
    const program = getProgram(keypair, "base");
    await withBlockhashRetry(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        [methodName]()
        .accounts({
          payer: keypair.publicKey,
          pda,
        })
        .rpc()
    );
    txConfirmed(id, "delegated");
    console.log(`[Solana] ${label} delegated to TEE ER`);
  } catch (e) {
    const msg = normalizeProgramError(e);
    if (isIgnorableDelegationError(msg)) {
      txConfirmed(id, "already-delegated");
    } else {
      txError(id, msg.slice(0, 80));
      throw e;
    }
  }
}

export async function ensureGameDelegated(keypair: Keypair): Promise<void> {
  const cacheKey = getDelegationCacheKey(keypair.publicKey);
  if (typeof window !== "undefined" && localStorage.getItem(cacheKey) === "1")
    return;

  const [playerPDA] = getPlayerPDA(keypair.publicKey);
  const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);

  await delegatePda(keypair, "delegatePlayer", playerPDA, "Player");
  await delegatePda(keypair, "delegateCoinToss", coinTossPDA, "Coin Toss");

  if (typeof window !== "undefined") {
    localStorage.setItem(cacheKey, "1");
  }
}

async function undelegateAccount(
  keypair: Keypair,
  methodName: string,
  pda: PublicKey,
  label: string
): Promise<boolean> {
  const id = txPending(`Undelegate ${label}`);
  try {
    const program = getProgram(keypair, "er");
    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)[methodName]().accounts({
        payer: keypair.publicKey,
        pda,
        magicProgram: MAGIC_PROGRAM_ID,
        magicContext: MAGIC_CONTEXT_ID,
      })
    );
    txConfirmed(id, tx);
    console.log(`[Solana] ${label} undelegated`);
    return true;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(id, msg.slice(0, 80));
    return false;
  }
}

export async function ensureAllUndelegated(keypair: Keypair): Promise<void> {
  const conn = getBaseConnection();
  const accounts = [
    {
      pda: getPlayerPDA(keypair.publicKey)[0],
      method: "commitPlayer",
      label: "Player",
    },
    {
      pda: getCoinTossStatePDA(keypair.publicKey)[0],
      method: "commitCoinToss",
      label: "Coin Toss",
    },
  ];

  let undelegated = false;
  for (const acct of accounts) {
    try {
      const info = await conn.getAccountInfo(acct.pda, "confirmed");
      if (info && info.owner.equals(DELEGATION_PROGRAM_ID)) {
        console.log(
          `[Solana] ${acct.label} still delegated — undelegating...`
        );
        await undelegateAccount(keypair, acct.method, acct.pda, acct.label);
        undelegated = true;
      }
    } catch (e) {
      console.warn(
        `[Solana] Failed to check/undelegate ${acct.label}:`,
        e
      );
    }
  }

  if (undelegated) {
    const cacheKey = getDelegationCacheKey(keypair.publicKey);
    localStorage.removeItem(cacheKey);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

// ===== AIRDROP =====

export async function ensureFunded(keypair: Keypair): Promise<boolean> {
  const connection = getBaseConnection();
  const balance = await connection.getBalance(keypair.publicKey);
  if (balance < 0.5 * LAMPORTS_PER_SOL) {
    console.log("[Solana] Low balance, requesting airdrop...");
    try {
      const sig = await connection.requestAirdrop(
        keypair.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig, "confirmed");
      console.log("[Solana] Airdrop confirmed");
      return true;
    } catch (e) {
      const msg = normalizeProgramError(e);
      if (msg.includes("429")) {
        console.warn(
          "[Solana] Airdrop rate-limited. Fund manually at https://faucet.solana.com — address:",
          keypair.publicKey.toBase58()
        );
      } else {
        console.error("[Solana] Airdrop failed:", e);
      }
      return false;
    }
  }
  return true;
}

// ===== ACCOUNT FETCHERS =====

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchPlayer(keypair: Keypair): Promise<any> {
  const [pda] = getPlayerPDA(keypair.publicKey);
  return fetchAccountWithFallback(keypair, "player", pda);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchCoinTossState(keypair: Keypair): Promise<any> {
  const [pda] = getCoinTossStatePDA(keypair.publicKey);
  return fetchAccountWithFallback(keypair, "coinToss", pda);
}

// ===== INSTRUCTIONS =====

export async function callInitializePlayer(keypair: Keypair): Promise<string> {
  const id = txPending("Initialize Player");
  try {
    const program = getProgram(keypair, "base");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);
    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .initializePlayer()
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          coinToss: coinTossPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    txConfirmed(id, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(id, msg.slice(0, 80));
    throw e;
  }
}

// VRF Oracle Queue (MagicBlock default)
const VRF_ORACLE_QUEUE = new PublicKey(
  "oraaborPnkaKQ9MmQYaGQbsMfuYoh4LZdWJX4zhMyLk"
);

export async function callFlipCoin(
  keypair: Keypair,
  choice: number,
  betAmount: number = 100 // in-game chips (not lamports)
): Promise<string> {
  const side = choice === 0 ? "Heads" : "Tails";
  const id = txPending(`Flip Coin (${side})`);
  try {
    await ensureGameDelegated(keypair);
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .flipCoin(choice, new BN(betAmount))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          coinToss: coinTossPDA,
          oracleQueue: VRF_ORACLE_QUEUE,
          systemProgram: SystemProgram.programId,
        })
    );
    txConfirmed(id, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(id, msg.slice(0, 80));
    throw e;
  }
}

/**
 * Wait for VRF callback to settle the coin toss.
 * Polls the coin toss account until status changes from Pending to Settled.
 */
export async function waitForCoinTossResult(
  keypair: Keypair,
  maxWaitMs: number = 10000
): Promise<{ won: boolean; result: number }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const state = await fetchCoinTossState(keypair);
    if (state && state.status?.settled !== undefined) {
      return { won: state.won, result: state.result };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("VRF callback timeout — coin toss not settled");
}

export { BN, LAMPORTS_PER_SOL, PublicKey };
