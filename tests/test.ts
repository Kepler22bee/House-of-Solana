import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
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

  // 3. Flip Coin (bet 100 chips on heads)
  console.log("\n--- Flip Coin (100 chips on Heads) ---");
  try {
    const tx = await (program.methods as any)
      .flipCoin(0, new anchor.BN(100))
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        coinToss: coinTossPDA,
        oracleQueue: new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh"),
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Flip tx:", tx);

    // Wait for VRF callback
    console.log("Waiting for VRF callback...");
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const toss = await (program.account as any).coinToss.fetch(coinTossPDA);
      const status = Object.keys(toss.status)[0];
      if (status === "settled") {
        console.log("Result:", toss.result === 0 ? "Heads" : "Tails");
        console.log("Won:", toss.won);
        playerState = await (program.account as any).player.fetch(playerPDA);
        console.log("Balance after flip:", playerState.balance.toString(), "chips");
        break;
      }
      process.stdout.write(".");
    }
  } catch (e: any) {
    console.error("Flip failed:", e.message?.slice(0, 200));
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
