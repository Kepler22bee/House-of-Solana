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

const PROGRAM_ID = new PublicKey(
  "8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg"
);

const BASE_RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "http://localhost:8899";
const TEE_ER_BASE_URL = process.env.NEXT_PUBLIC_TEE_URL || "http://localhost:8899";

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
// TEE validator for devnet Private ERs
const TEE_VALIDATOR = new PublicKey(
  "FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA"
);

const PLAYER_SEED = "player";
const COIN_TOSS_SEED = "coin_toss";
const BLACKJACK_SEED = "blackjack";
const VAULT_SEED = "vault";
const TEMPLATE_SEED = "template";
const SESSION_SEED = "session";
const PROPOSAL_SEED = "proposal";
const TABLE_SEED = "table";

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
  if (msg.includes("BetTooSmall")) {
    return "Bet amount is below the minimum (100 chips).";
  }
  if (msg.includes("BetTooLarge")) {
    return "Bet amount exceeds the maximum (5,000 chips).";
  }
  if (msg.includes("InsufficientBalance")) {
    return "Not enough chips. Buy more chips first.";
  }
  if (msg.includes("AlreadySettled")) {
    return "This game is already settled.";
  }
  if (msg.includes("HandInProgress")) {
    return "A blackjack hand is already in progress.";
  }
  if (msg.includes("NoActiveHand")) {
    return "No active hand to act on.";
  }
  if (msg.includes("NotPlayerTurn")) {
    return "It's not your turn.";
  }
  if (msg.includes("HandFull")) {
    return "Hand is full — maximum cards reached.";
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
  // Skip TEE auth for localhost (local validator has no TEE)
  const isLocal = TEE_ER_BASE_URL.includes("localhost") || TEE_ER_BASE_URL.includes("127.0.0.1");
  if (isLocal) {
    _teeErUrl = TEE_ER_BASE_URL;
    console.log("[TEE] Local mode — skipping TEE auth");
    return _teeErUrl;
  }

  // Return cached token if available
  if (_teeToken && _teeErUrl) return _teeErUrl;

  const cached = localStorage.getItem(TEE_TOKEN_KEY);
  if (cached) {
    _teeToken = cached;
    _teeErUrl = `${TEE_ER_BASE_URL}?token=${cached}`;
    return _teeErUrl;
  }

  const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
    ]);

  console.log("[TEE] Verifying TEE RPC integrity...");
  const isVerified = await withTimeout(verifyTeeRpcIntegrity(TEE_ER_BASE_URL), 10000, "TEE verify");
  if (!isVerified) {
    throw new Error("TEE RPC integrity verification failed");
  }
  console.log("[TEE] RPC integrity verified");

  console.log("[TEE] Acquiring auth token...");
  const authResult = await withTimeout(
    getAuthToken(
      TEE_ER_BASE_URL,
      keypair.publicKey,
      (message: Uint8Array) =>
        Promise.resolve(nacl.sign.detached(message, keypair.secretKey))
    ),
    10000,
    "TEE auth"
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
    const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
    _erConnection = new Connection(url, {
      commitment: "confirmed",
      wsEndpoint: isLocal ? url.replace("http://", "ws://") : url.replace("https://", "wss://"),
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

export function getPermissionPDA(account: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("permission:"), account.toBuffer()],
    PERMISSION_PROGRAM_ID
  );
}

export function getVaultPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault")],
    PROGRAM_ID
  );
}

export function getCoinTossStatePDA(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(COIN_TOSS_SEED), player.toBuffer()],
    PROGRAM_ID
  );
}

export function getBlackjackPDA(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BLACKJACK_SEED), player.toBuffer()],
    PROGRAM_ID
  );
}

export function getTemplatePDA(id: bigint | number): [PublicKey, number] {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(id), true);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TEMPLATE_SEED), Buffer.from(new Uint8Array(buf))],
    PROGRAM_ID
  );
}

export function getSessionPDA(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), player.toBuffer()],
    PROGRAM_ID
  );
}

export function getProposalPDA(id: bigint | number): [PublicKey, number] {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(id), true);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PROPOSAL_SEED), Buffer.from(new Uint8Array(buf))],
    PROGRAM_ID
  );
}

export function getTablePDA(id: bigint | number): [PublicKey, number] {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setBigUint64(0, BigInt(id), true);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TABLE_SEED), Buffer.from(new Uint8Array(buf))],
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
        .remainingAccounts([
          { pubkey: TEE_VALIDATOR, isSigner: false, isWritable: false },
        ])
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
  // Skip delegation on localhost (no ER delegation program)
  const isLocal = TEE_ER_BASE_URL.includes("localhost") || TEE_ER_BASE_URL.includes("127.0.0.1");
  if (isLocal) return;

  const cacheKey = getDelegationCacheKey(keypair.publicKey);
  if (typeof window !== "undefined" && localStorage.getItem(cacheKey) === "1")
    return;

  const [playerPDA] = getPlayerPDA(keypair.publicKey);
  const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);
  const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);

  await delegatePda(keypair, "delegatePlayer", playerPDA, "Player");
  await delegatePda(keypair, "delegateCoinToss", coinTossPDA, "Coin Toss");
  await delegatePda(keypair, "delegateBlackjack", blackjackPDA, "Blackjack");

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
    {
      pda: getBlackjackPDA(keypair.publicKey)[0],
      method: "commitBlackjack",
      label: "Blackjack",
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchBlackjackState(keypair: Keypair): Promise<any> {
  const [pda] = getBlackjackPDA(keypair.publicKey);
  return fetchAccountWithFallback(keypair, "blackjackState", pda);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchGameSession(keypair: Keypair): Promise<any> {
  const [pda] = getSessionPDA(keypair.publicKey);
  return fetchAccountWithFallback(keypair, "gameSession", pda);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchGameTemplate(keypair: Keypair, id: number): Promise<any> {
  const [pda] = getTemplatePDA(id);
  const program = getProgram(keypair, "base");
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await (program.account as any).gameTemplate.fetch(pda);
  } catch { return null; }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTable(keypair: Keypair, id: number): Promise<any> {
  const [pda] = getTablePDA(id);
  return fetchAccountWithFallback(keypair, "table", pda);
}

// ===== INSTRUCTIONS =====

export async function callInitializePlayer(keypair: Keypair): Promise<string> {
  const id = txPending("Initialize Player");
  try {
    const program = getProgram(keypair, "base");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);
    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .initializePlayer()
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          coinToss: coinTossPDA,
          blackjack: blackjackPDA,
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

export async function callInitializeBlackjack(keypair: Keypair): Promise<string> {
  const id = txPending("Initialize Blackjack");
  try {
    const program = getProgram(keypair, "base");
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);
    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .initializeBlackjack()
        .accounts({
          authority: keypair.publicKey,
          blackjack: blackjackPDA,
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

export async function callSetupPermissions(keypair: Keypair): Promise<string> {
  const id = txPending("Setup Permissions");
  try {
    const program = getProgram(keypair, "base");
    const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);
    const [permissionCoinToss] = getPermissionPDA(coinTossPDA);
    const [permissionBlackjack] = getPermissionPDA(blackjackPDA);

    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .setupPermissions()
        .accounts({
          authority: keypair.publicKey,
          coinToss: coinTossPDA,
          blackjack: blackjackPDA,
          permissionCoinToss,
          permissionBlackjack,
          permissionProgram: PERMISSION_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    txConfirmed(id, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    if (msg.includes("already in use")) {
      txConfirmed(id, "already-setup");
      return "already-setup";
    }
    txError(id, msg.slice(0, 80));
    throw e;
  }
}

// Rate: 1 SOL = 10,000 chips
const LAMPORTS_PER_CHIP = 100_000;

export async function callBuyChips(
  keypair: Keypair,
  solAmount: number // in SOL (e.g. 0.1)
): Promise<string> {
  const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
  const chips = lamports / LAMPORTS_PER_CHIP;
  const id = txPending(`Buy ${chips} chips`);
  try {
    const program = getProgram(keypair, "base");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [vaultPDA] = getVaultPDA();
    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .buyChips(new BN(lamports))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          vault: vaultPDA,
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

export async function callCashOut(
  keypair: Keypair,
  chips: number
): Promise<string> {
  const id = txPending(`Cash out ${chips} chips`);
  try {
    const program = getProgram(keypair, "base");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [vaultPDA] = getVaultPDA();
    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .cashOut(new BN(chips))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          vault: vaultPDA,
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
  "Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"
);

export async function callFlipCoin(
  keypair: Keypair,
  choice: number,
  betAmount: number = 100 // in-game chips (not lamports)
): Promise<string> {
  const side = choice === 0 ? "Heads" : "Tails";
  const id = txPending(`Flip Coin (${side})`);
  try {
    const program = getProgram(keypair, "base");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [coinTossPDA] = getCoinTossStatePDA(keypair.publicKey);

    const tx = await withBlockhashRetry<string>(() =>
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

/**
 * Wait for VRF callback to settle the coin toss.
 * Polls the coin toss account until status changes from Pending to Settled.
 */
export async function waitForCoinTossResult(
  keypair: Keypair,
  maxWaitMs: number = 30000
): Promise<{ won: boolean; result: number }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const state = await fetchCoinTossState(keypair);
    if (state && state.status?.settled !== undefined) {
      return { won: state.won, result: state.result };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("VRF callback timeout — coin toss not settled");
}

// ===== BLACKJACK =====

export async function callStartHand(
  keypair: Keypair,
  betAmount: number = 100
): Promise<string> {
  const id = txPending(`Blackjack Deal (${betAmount} chips)`);
  try {
    await ensureGameDelegated(keypair);
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .startHand(new BN(betAmount))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          blackjack: blackjackPDA,
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

export async function callHit(keypair: Keypair): Promise<string> {
  const id = txPending("Blackjack Hit");
  try {
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .hit()
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          blackjack: blackjackPDA,
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

export async function callStand(keypair: Keypair): Promise<string> {
  const id = txPending("Blackjack Stand");
  try {
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [blackjackPDA] = getBlackjackPDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .stand()
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          blackjack: blackjackPDA,
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
 * Poll blackjack state until it reaches PlayerTurn or Settled.
 * Used after startHand (wait for deal callback) and after hit/stand (wait for VRF).
 */
export async function waitForBlackjackUpdate(
  keypair: Keypair,
  maxWaitMs: number = 15000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const state = await fetchBlackjackState(keypair);
    if (state) {
      const s = state.status;
      // Return once we're in a state the UI can act on
      if (s?.playerTurn !== undefined || s?.settled !== undefined || s?.idle !== undefined) {
        return state;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Blackjack VRF callback timeout");
}

// ===== GAME FACTORY =====

export async function callCreateTemplate(
  keypair: Keypair,
  id: number,
  name: string,
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: any[],
  minBet: number,
  maxBet: number,
  creatorFeeBps: number
): Promise<string> {
  const txId = txPending("Create Template");
  try {
    const program = getProgram(keypair, "base");
    const [templatePDA] = getTemplatePDA(id);
    const [vaultPDA] = getVaultPDA();

    const nameBytes = new Uint8Array(32);
    const nameEnc = new TextEncoder().encode(name.slice(0, 32));
    nameBytes.set(nameEnc);

    const descBytes = new Uint8Array(128);
    const descEnc = new TextEncoder().encode(description.slice(0, 128));
    descBytes.set(descEnc);

    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .createTemplate(
          new BN(id),
          Array.from(nameBytes),
          Array.from(descBytes),
          steps,
          new BN(minBet),
          new BN(maxBet),
          creatorFeeBps
        )
        .accounts({
          creator: keypair.publicKey,
          vault: vaultPDA,
          template: templatePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    txConfirmed(txId, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(txId, msg.slice(0, 80));
    throw e;
  }
}

export async function callStartFactoryGame(
  keypair: Keypair,
  templateId: number,
  betAmount: number
): Promise<string> {
  const id = txPending(`Start Game (${betAmount} chips)`);
  try {
    await ensureGameDelegated(keypair);
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [templatePDA] = getTemplatePDA(templateId);
    const [sessionPDA] = getSessionPDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .startGame(new BN(betAmount))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          template: templatePDA,
          session: sessionPDA,
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

export async function callPlayerChoice(
  keypair: Keypair,
  templateId: number,
  choiceBit: number
): Promise<string> {
  const id = txPending(`Choice (bit ${choiceBit})`);
  try {
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [templatePDA] = getTemplatePDA(templateId);
    const [sessionPDA] = getSessionPDA(keypair.publicKey);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .playerChoice(choiceBit)
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          template: templatePDA,
          session: sessionPDA,
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
 * Poll game session until it reaches WaitingForChoice or Settled.
 */
export async function waitForSessionUpdate(
  keypair: Keypair,
  maxWaitMs: number = 15000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const state = await fetchGameSession(keypair);
    if (state) {
      const s = state.status;
      if (s?.waitingForChoice !== undefined || s?.settled !== undefined) {
        return state;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Game session VRF callback timeout");
}

// ===== NEGOTIATION =====

export async function callProposeGame(
  keypair: Keypair,
  id: number,
  coCreator: PublicKey,
  name: string,
  description: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  steps: any[],
  minBet: number,
  maxBet: number,
  creatorFeeBps: number,
  feeSplitBps: number
): Promise<string> {
  const txId = txPending("Propose Game");
  try {
    const program = getProgram(keypair, "base");
    const [proposalPDA] = getProposalPDA(id);

    const nameBytes = new Uint8Array(32);
    nameBytes.set(new TextEncoder().encode(name.slice(0, 32)));
    const descBytes = new Uint8Array(128);
    descBytes.set(new TextEncoder().encode(description.slice(0, 128)));

    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .proposeGame(
          new BN(id), coCreator,
          Array.from(nameBytes), Array.from(descBytes),
          steps, new BN(minBet), new BN(maxBet),
          creatorFeeBps, feeSplitBps
        )
        .accounts({
          proposer: keypair.publicKey,
          proposal: proposalPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    txConfirmed(txId, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(txId, msg.slice(0, 80));
    throw e;
  }
}

export async function callAcceptProposal(
  keypair: Keypair,
  proposalId: number
): Promise<string> {
  const txId = txPending("Accept Proposal");
  try {
    const program = getProgram(keypair, "base");
    const [proposalPDA] = getProposalPDA(proposalId);
    const [templatePDA] = getTemplatePDA(proposalId);
    const [vaultPDA] = getVaultPDA();

    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .acceptProposal()
        .accounts({
          coCreator: keypair.publicKey,
          proposal: proposalPDA,
          vault: vaultPDA,
          template: templatePDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc()
    );
    txConfirmed(txId, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(txId, msg.slice(0, 80));
    throw e;
  }
}

export async function callRejectProposal(
  keypair: Keypair,
  proposalId: number
): Promise<string> {
  const txId = txPending("Reject Proposal");
  try {
    const program = getProgram(keypair, "base");
    const [proposalPDA] = getProposalPDA(proposalId);

    const tx = await withBlockhashRetry<string>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .rejectProposal()
        .accounts({
          coCreator: keypair.publicKey,
          proposal: proposalPDA,
        })
        .rpc()
    );
    txConfirmed(txId, tx);
    return tx;
  } catch (e) {
    const msg = normalizeProgramError(e);
    txError(txId, msg.slice(0, 80));
    throw e;
  }
}

// ===== MULTIPLAYER TABLES =====

export async function callCreateTable(
  keypair: Keypair,
  tableId: number,
  templateId: number,
  betAmount: number
): Promise<string> {
  const id = txPending(`Create Table (${betAmount} chips)`);
  try {
    await ensureGameDelegated(keypair);
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [templatePDA] = getTemplatePDA(templateId);
    const [tablePDA] = getTablePDA(tableId);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .createTable(new BN(tableId), new BN(betAmount))
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          template: templatePDA,
          table: tablePDA,
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

export async function callJoinTable(
  keypair: Keypair,
  tableId: number,
  templateId: number,
  seat1Player: PublicKey
): Promise<string> {
  const id = txPending("Join Table");
  try {
    await ensureGameDelegated(keypair);
    const program = getProgram(keypair, "er");
    const [playerPDA] = getPlayerPDA(keypair.publicKey);
    const [seat1PlayerPDA] = getPlayerPDA(seat1Player);
    const [templatePDA] = getTemplatePDA(templateId);
    const [tablePDA] = getTablePDA(tableId);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .joinTable()
        .accounts({
          authority: keypair.publicKey,
          player: playerPDA,
          seat1Player: seat1PlayerPDA,
          template: templatePDA,
          table: tablePDA,
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

export async function callTableAction(
  keypair: Keypair,
  tableId: number,
  templateId: number,
  seat1Player: PublicKey,
  seat2Player: PublicKey,
  choiceBit: number
): Promise<string> {
  const id = txPending(`Table Action (${choiceBit})`);
  try {
    const program = getProgram(keypair, "er");
    const [seat1PDA] = getPlayerPDA(seat1Player);
    const [seat2PDA] = getPlayerPDA(seat2Player);
    const [templatePDA] = getTemplatePDA(templateId);
    const [tablePDA] = getTablePDA(tableId);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .tableAction(choiceBit)
        .accounts({
          authority: keypair.publicKey,
          seat1Player: seat1PDA,
          seat2Player: seat2PDA,
          template: templatePDA,
          table: tablePDA,
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

export async function callTableTimeout(
  keypair: Keypair,
  tableId: number,
  seat1Player: PublicKey,
  seat2Player: PublicKey
): Promise<string> {
  const id = txPending("Table Timeout");
  try {
    const program = getProgram(keypair, "er");
    const [seat1PDA] = getPlayerPDA(seat1Player);
    const [seat2PDA] = getPlayerPDA(seat2Player);
    const [tablePDA] = getTablePDA(tableId);

    const tx = await sendMethodTx(keypair, "er", () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (program.methods as any)
        .tableTimeout()
        .accounts({
          authority: keypair.publicKey,
          seat1Player: seat1PDA,
          seat2Player: seat2PDA,
          table: tablePDA,
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

// ===== CARD HELPERS (mirror contract logic) =====

export function cardFromRaw(cardByte: number): { rank: string; suit: string; value: number } {
  if (cardByte === 0) return { rank: "?", suit: "?", value: 0 };
  const idx = ((cardByte - 1) % 52);
  const rankIdx = (idx % 13) + 1;
  const suitIdx = Math.floor(idx / 13);

  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const rankNames = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const rank = rankNames[rankIdx] || "?";
  const suit = suits[suitIdx] || "?";

  let value = rankIdx;
  if (rankIdx >= 10) value = 10;
  if (rankIdx === 1) value = 11; // ace

  return { rank, suit, value };
}

export function handValue(cards: number[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c === 0) continue;
    const info = cardFromRaw(c);
    total += info.value;
    if (info.rank === "A") aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

export { BN, LAMPORTS_PER_SOL, PublicKey };
