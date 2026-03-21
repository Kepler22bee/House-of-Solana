import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { verifyTeeRpcIntegrity, getAuthToken } from "@magicblock-labs/ephemeral-rollups-sdk";
import nacl from "tweetnacl";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const PERMISSION_PROGRAM_ID = new PublicKey("BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi");
const TEE_VALIDATOR = new PublicKey("FnE6VJT5QNZdedZPnCoLsARgBwoE6DeJNjBs2H1gySXA");

const PLAYER_SEED = "player";
const COIN_TOSS_SEED = "coin_toss";
const VAULT_SEED = "vault";

const BASE_RPC = "https://api.devnet.solana.com";
const TEE_ER_RPC = "https://tee.magicblock.app";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found on-chain");
  const program = new Program(idl, provider);

  const wallet = provider.wallet as anchor.Wallet;
  const player = wallet.payer;

  const baseConnection = new Connection(BASE_RPC, "confirmed");

  const [playerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), player.publicKey.toBuffer()], PROGRAM_ID
  );
  const [coinTossPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(COIN_TOSS_SEED), player.publicKey.toBuffer()], PROGRAM_ID
  );
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)], PROGRAM_ID
  );
  const [groupPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("group:"), player.publicKey.toBuffer()], PERMISSION_PROGRAM_ID
  );
  const [permissionPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("permission:"), coinTossPDA.toBuffer()], PERMISSION_PROGRAM_ID
  );

  console.log("=== PRIVATE ER TEST ===");
  console.log("Player:", player.publicKey.toBase58());
  console.log("CoinToss PDA:", coinTossPDA.toBase58());
  console.log("TEE Validator:", TEE_VALIDATOR.toBase58());

  // --- Step 1: Check permission setup ---
  console.log("\n--- 1. Verify Permissions ---");
  const permissionInfo = await baseConnection.getAccountInfo(permissionPDA);
  if (permissionInfo) {
    console.log("Permission PDA exists:", permissionPDA.toBase58());
    console.log("  Owner:", permissionInfo.owner.toBase58());
    console.log("  Size:", permissionInfo.data.length, "bytes");
  } else {
    console.log("Permission PDA NOT found — setting up...");
    try {
      await (program.methods as any).setupPermissions().accounts({
        authority: player.publicKey,
        coinToss: coinTossPDA,
        group: groupPDA,
        permissionCoinToss: permissionPDA,
        permissionProgram: PERMISSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      }).rpc();
      console.log("Permissions created");
    } catch (e: any) {
      console.log("Setup:", e.message?.slice(0, 100));
    }
  }

  const groupInfo = await baseConnection.getAccountInfo(groupPDA);
  if (groupInfo) {
    console.log("Group PDA exists:", groupPDA.toBase58());
    console.log("  Owner:", groupInfo.owner.toBase58());
    console.log("  Size:", groupInfo.data.length, "bytes");
  }

  // --- Step 2: Check CoinToss ownership on base chain ---
  console.log("\n--- 2. CoinToss Account State (Base Chain) ---");
  const coinTossInfoBase = await baseConnection.getAccountInfo(coinTossPDA);
  if (coinTossInfoBase) {
    console.log("Owner:", coinTossInfoBase.owner.toBase58());
    const isDelegated = !coinTossInfoBase.owner.equals(PROGRAM_ID);
    console.log("Delegated:", isDelegated);
    if (isDelegated) {
      console.log("  → Account is delegated to ER (owner is delegation program)");
    }
  }

  // --- Step 3: Read CoinToss from base chain ---
  console.log("\n--- 3. Read CoinToss from Base Chain ---");
  try {
    const tossBase = await (program.account as any).coinToss.fetch(coinTossPDA);
    console.log("Base chain read SUCCESS:");
    console.log("  Choice:", tossBase.choice, "(", tossBase.choice === 0 ? "Heads" : "Tails", ")");
    console.log("  Result:", tossBase.result);
    console.log("  Won:", tossBase.won);
    console.log("  Status:", Object.keys(tossBase.status)[0]);
  } catch (e: any) {
    console.log("Base chain read FAILED:", e.message?.slice(0, 100));
    console.log("  → This is expected if account is delegated to TEE ER");
  }

  // --- Step 4: Authenticate with TEE ---
  console.log("\n--- 4. TEE Authentication ---");
  let teeAuthedUrl = TEE_ER_RPC;
  try {
    console.log("Verifying TEE RPC integrity...");
    const verified = await verifyTeeRpcIntegrity(TEE_ER_RPC);
    console.log("TEE integrity verified:", verified);

    console.log("Acquiring auth token...");
    const authResult = await getAuthToken(
      TEE_ER_RPC,
      player.publicKey,
      (message: Uint8Array) =>
        Promise.resolve(nacl.sign.detached(message, player.secretKey))
    );
    const token = typeof authResult === "string" ? authResult : authResult.token;
    teeAuthedUrl = `${TEE_ER_RPC}?token=${token}`;
    console.log("TEE auth token acquired");
    console.log("Authenticated URL:", teeAuthedUrl.slice(0, 50) + "...");
  } catch (e: any) {
    console.log("TEE auth failed:", e.message?.slice(0, 150));
    console.log("  → Continuing with unauthenticated URL (some ops may fail)");
  }

  const teeAuthedConnection = new Connection(teeAuthedUrl, "confirmed");

  // --- Step 4b: Read CoinToss from TEE ER (authenticated) ---
  console.log("\n--- 4b. Read CoinToss from TEE ER (authenticated) ---");
  try {
    const teeProvider = new anchor.AnchorProvider(
      teeAuthedConnection, wallet, { commitment: "processed" }
    );
    const teeProgram = new Program(idl, teeProvider);
    const tossTee = await (teeProgram.account as any).coinToss.fetch(coinTossPDA);
    console.log("TEE ER read SUCCESS:");
    console.log("  Choice:", tossTee.choice, "(", tossTee.choice === 0 ? "Heads" : "Tails", ")");
    console.log("  Result:", tossTee.result);
    console.log("  Won:", tossTee.won);
    console.log("  Status:", Object.keys(tossTee.status)[0]);
  } catch (e: any) {
    console.log("TEE ER read FAILED:", e.message?.slice(0, 150));
    console.log("  → Account may not be delegated yet, or TEE auth issue");
  }

  // --- Step 5: Delegate to TEE and flip ---
  console.log("\n--- 5. Delegate CoinToss to TEE ER ---");
  // Check if already delegated
  const preDelegate = await baseConnection.getAccountInfo(coinTossPDA);
  const alreadyDelegated = preDelegate && !preDelegate.owner.equals(PROGRAM_ID);

  if (!alreadyDelegated) {
    try {
      const tx = await (program.methods as any).delegateCoinToss().accounts({
        payer: player.publicKey,
        pda: coinTossPDA,
      }).remainingAccounts([
        { pubkey: TEE_VALIDATOR, isSigner: false, isWritable: false },
      ]).rpc();
      console.log("Delegated to TEE:", tx);
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.log("Delegate:", e.message?.slice(0, 150));
    }
  } else {
    console.log("Already delegated");
  }

  // Also delegate player
  const playerInfo = await baseConnection.getAccountInfo(playerPDA);
  const playerDelegated = playerInfo && !playerInfo.owner.equals(PROGRAM_ID);
  if (!playerDelegated) {
    try {
      await (program.methods as any).delegatePlayer().accounts({
        payer: player.publicKey,
        pda: playerPDA,
      }).remainingAccounts([
        { pubkey: TEE_VALIDATOR, isSigner: false, isWritable: false },
      ]).rpc();
      console.log("Player delegated to TEE");
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      console.log("Player delegate:", e.message?.slice(0, 150));
    }
  }

  // --- Step 6: Verify delegation ---
  console.log("\n--- 6. Verify Delegation ---");
  const postDelegate = await baseConnection.getAccountInfo(coinTossPDA);
  if (postDelegate) {
    console.log("CoinToss owner after delegation:", postDelegate.owner.toBase58());
    console.log("Is program-owned:", postDelegate.owner.equals(PROGRAM_ID));
    console.log("→ If NOT program-owned, it's delegated to ER");
  }

  // --- Step 7: Try reading from base chain while delegated ---
  console.log("\n--- 7. Read CoinToss from Base Chain (while delegated) ---");
  try {
    const tossBase = await (program.account as any).coinToss.fetch(coinTossPDA);
    console.log("Base chain read while delegated:");
    console.log("  Status:", Object.keys(tossBase.status)[0]);
    console.log("  → Data may be stale/frozen from before delegation");
  } catch (e: any) {
    console.log("Base chain read FAILED (expected):", e.message?.slice(0, 100));
    console.log("  → Account data not readable on base chain while in TEE ER");
  }

  // --- Step 8: Flip on TEE ER ---
  console.log("\n--- 8. Flip Coin on TEE ER ---");
  const oracleQueue = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
  try {
    // Build and send tx to TEE ER
    const teeProvider = new anchor.AnchorProvider(
      teeAuthedConnection, wallet, {
        commitment: "processed",
        preflightCommitment: "processed",
        skipPreflight: true,
      }
    );
    const teeProgram = new Program(idl, teeProvider);

    const tx = await (teeProgram.methods as any)
      .flipCoin(0, new anchor.BN(100))
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        coinToss: coinTossPDA,
        oracleQueue,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    const { blockhash, lastValidBlockHeight } = await teeAuthedConnection.getLatestBlockhash("processed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = player.publicKey;
    tx.sign(player);
    const sig = await teeAuthedConnection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    console.log("Flip tx (TEE ER):", sig);

    // Wait for VRF callback
    process.stdout.write("Waiting for VRF on TEE");
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const toss = await (teeProgram.account as any).coinToss.fetch(coinTossPDA);
        const status = Object.keys(toss.status)[0];
        if (status === "settled") {
          console.log(`\n  Result: ${toss.result === 0 ? "Heads" : "Tails"} | Won: ${toss.won}`);
          break;
        }
      } catch { /* still processing */ }
      process.stdout.write(".");
    }
  } catch (e: any) {
    console.log("TEE flip failed:", e.message?.slice(0, 200));
    console.log("  → This is expected if TEE requires auth token for writes");
  }

  // --- Step 9: Undelegate back ---
  console.log("\n--- 9. Undelegate (commit back to base chain) ---");
  try {
    const teeProvider = new anchor.AnchorProvider(
      teeAuthedConnection, wallet, { commitment: "processed", skipPreflight: true }
    );
    const teeProgram = new Program(idl, teeProvider);

    // Commit player
    const tx1 = await (teeProgram.methods as any).commitPlayer().accounts({
      payer: player.publicKey,
      pda: playerPDA,
    }).transaction();
    const { blockhash: bh1 } = await teeAuthedConnection.getLatestBlockhash("processed");
    tx1.recentBlockhash = bh1;
    tx1.feePayer = player.publicKey;
    tx1.sign(player);
    await teeAuthedConnection.sendRawTransaction(tx1.serialize(), { skipPreflight: true });

    // Commit coin toss
    const tx2 = await (teeProgram.methods as any).commitCoinToss().accounts({
      payer: player.publicKey,
      pda: coinTossPDA,
    }).transaction();
    tx2.recentBlockhash = bh1;
    tx2.feePayer = player.publicKey;
    tx2.sign(player);
    await teeAuthedConnection.sendRawTransaction(tx2.serialize(), { skipPreflight: true });

    console.log("Undelegation submitted");
    await new Promise(r => setTimeout(r, 3000));
  } catch (e: any) {
    console.log("Undelegate:", e.message?.slice(0, 150));
  }

  // --- Step 10: Final state on base chain ---
  console.log("\n--- 10. Final State (Base Chain) ---");
  try {
    const playerState = await (program.account as any).player.fetch(playerPDA);
    console.log("Balance:", playerState.balance.toString(), "chips");
    console.log("Total bets:", playerState.totalBets.toString());
    console.log("Wins:", playerState.totalWins.toString(), "| Losses:", playerState.totalLosses.toString());
  } catch (e: any) {
    console.log("Read failed (may still be delegated):", e.message?.slice(0, 100));
  }

  console.log("\n=== TEST COMPLETE ===");
}

main().catch(console.error);
