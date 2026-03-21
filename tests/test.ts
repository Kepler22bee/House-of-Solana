import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const PERMISSION_PROGRAM_ID = new PublicKey("BTWAqWNBmF2TboMh3fxMJfgR16xGHYD7Kgr2dPwbRPBi");
const PLAYER_SEED = "player";
const COIN_TOSS_SEED = "coin_toss";
const VAULT_SEED = "vault";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Fetch IDL from chain
  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found on-chain");
  const program = new Program(idl, provider);

  const wallet = provider.wallet as anchor.Wallet;
  const player = wallet.payer;

  const [playerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), player.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [coinTossPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(COIN_TOSS_SEED), player.publicKey.toBuffer()],
    PROGRAM_ID
  );
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)],
    PROGRAM_ID
  );

  console.log("Player:", player.publicKey.toBase58());
  console.log("Player PDA:", playerPDA.toBase58());
  console.log("Vault PDA:", vaultPDA.toBase58());

  // 0. Initialize Vault (one-time)
  console.log("\n--- Initialize Vault ---");
  try {
    const tx = await (program.methods as any)
      .initializeVault()
      .accounts({
        authority: player.publicKey,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Vault init tx:", tx);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("Vault already initialized");
    } else {
      console.error("Vault init failed:", e.message?.slice(0, 200));
    }
  }

  // 1. Initialize Player
  console.log("\n--- Initialize Player ---");
  try {
    const tx = await (program.methods as any)
      .initializePlayer()
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        coinToss: coinTossPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Init tx:", tx);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("Player already initialized");
    } else {
      console.error("Init failed:", e.message?.slice(0, 200));
    }
  }

  // 1.5. Setup Permissions (Private ER)
  console.log("\n--- Setup Permissions ---");
  const [groupPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("group:"), player.publicKey.toBuffer()],
    PERMISSION_PROGRAM_ID
  );
  const [permissionCoinTossPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("permission:"), coinTossPDA.toBuffer()],
    PERMISSION_PROGRAM_ID
  );
  try {
    const tx = await (program.methods as any)
      .setupPermissions()
      .accounts({
        authority: player.publicKey,
        coinToss: coinTossPDA,
        group: groupPDA,
        permissionCoinToss: permissionCoinTossPDA,
        permissionProgram: PERMISSION_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Setup permissions tx:", tx);
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("Permissions already set up");
    } else {
      console.error("Setup permissions failed:", e.message?.slice(0, 200));
    }
  }

  // Fetch player state
  let playerState = await (program.account as any).player.fetch(playerPDA);
  console.log("Balance:", playerState.balance.toString(), "chips");
  console.log("Initialized:", playerState.initialized);

  // 2. Buy Chips (0.1 SOL = 1000 chips)
  console.log("\n--- Buy Chips (0.1 SOL) ---");
  try {
    const lamports = 0.1 * LAMPORTS_PER_SOL;
    const tx = await (program.methods as any)
      .buyChips(new anchor.BN(lamports))
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Buy tx:", tx);

    playerState = await (program.account as any).player.fetch(playerPDA);
    console.log("Balance after buy:", playerState.balance.toString(), "chips");
    console.log("Total deposited:", playerState.totalDeposited.toString(), "lamports");
  } catch (e: any) {
    console.error("Buy chips failed:", e.message?.slice(0, 200));
  }

  // 3. Flip Coins — run multiple to see both wins and losses
  const oracleQueue = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
  const NUM_FLIPS = 5;

  for (let flip = 1; flip <= NUM_FLIPS; flip++) {
    const choice = flip % 2; // alternate heads/tails
    const side = choice === 0 ? "Heads" : "Tails";
    console.log(`\n--- Flip #${flip}: 100 chips on ${side} ---`);

    // Get balance before
    playerState = await (program.account as any).player.fetch(playerPDA);
    const balBefore = Number(playerState.balance);

    try {
      const tx = await (program.methods as any)
        .flipCoin(choice, new anchor.BN(100))
        .accounts({
          authority: player.publicKey,
          player: playerPDA,
          coinToss: coinTossPDA,
          oracleQueue,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      console.log("Flip tx:", tx);

      // Wait for VRF callback
      process.stdout.write("Waiting for VRF");
      let settled = false;
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const toss = await (program.account as any).coinToss.fetch(coinTossPDA);
        const status = Object.keys(toss.status)[0];
        if (status === "settled") {
          settled = true;
          const resultSide = toss.result === 0 ? "Heads" : "Tails";
          playerState = await (program.account as any).player.fetch(playerPDA);
          const balAfter = Number(playerState.balance);
          const diff = balAfter - balBefore;
          console.log(`\n  Chose: ${side} | Result: ${resultSide} | Won: ${toss.won}`);
          console.log(`  Balance: ${balBefore} → ${balAfter} (${diff >= 0 ? "+" : ""}${diff})`);
          break;
        }
        process.stdout.write(".");
      }
      if (!settled) console.log("\n  VRF callback timeout!");
    } catch (e: any) {
      console.error("Flip failed:", e.message?.slice(0, 200));
    }
  }

  // 4. Cash Out (500 chips)
  console.log("\n--- Cash Out (500 chips) ---");
  try {
    const tx = await (program.methods as any)
      .cashOut(new anchor.BN(500))
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        vault: vaultPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Cash out tx:", tx);

    playerState = await (program.account as any).player.fetch(playerPDA);
    console.log("Balance after cash out:", playerState.balance.toString(), "chips");
    console.log("Total withdrawn:", playerState.totalWithdrawn.toString(), "lamports");
  } catch (e: any) {
    console.error("Cash out failed:", e.message?.slice(0, 200));
  }

  console.log("\n--- Final State ---");
  playerState = await (program.account as any).player.fetch(playerPDA);
  console.log("Balance:", playerState.balance.toString());
  console.log("Total bets:", playerState.totalBets.toString());
  console.log("Total wins:", playerState.totalWins.toString());
  console.log("Total losses:", playerState.totalLosses.toString());
}

main().catch(console.error);
