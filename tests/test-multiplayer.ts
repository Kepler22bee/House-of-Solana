import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

function padBytes(str: string, len: number): number[] {
  const buf = Buffer.alloc(len);
  buf.write(str);
  return Array.from(buf);
}

function cardName(card: number): string {
  if (card === 0) return "?";
  const rank = ((card - 1) % 13) + 1;
  const suits = ["♠", "♥", "♦", "♣"];
  const suit = suits[Math.floor((card - 1) / 13)];
  const names: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return `${names[rank] || rank}${suit}`;
}

function handSum(cards: number[]): number {
  return cards.reduce((a, b) => a + b, 0);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found");
  const program = new Program(idl, provider);

  const wallet = provider.wallet as anchor.Wallet;
  const playerA = wallet.payer; // Player's AI (uses deployer wallet)

  // Clanker AI — generate a second keypair
  const clanker = Keypair.generate();
  console.log("=== MULTIPLAYER TABLE TEST ===");
  console.log(`Player AI:  ${playerA.publicKey.toBase58()}`);
  console.log(`Clanker AI: ${clanker.publicKey.toBase58()}`);

  // Fund Clanker
  console.log("\n--- Fund Clanker ---");
  try {
    const sig = await provider.connection.requestAirdrop(clanker.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(sig);
    console.log("Clanker funded with 2 SOL");
  } catch {
    console.log("Airdrop failed — trying transfer from deployer");
    const tx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: playerA.publicKey,
        toPubkey: clanker.publicKey,
        lamports: 0.5 * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx);
    console.log("Transferred 0.5 SOL to Clanker");
  }

  // PDAs
  const [playerAPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), playerA.publicKey.toBuffer()], PROGRAM_ID
  );
  const [clankerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), clanker.publicKey.toBuffer()], PROGRAM_ID
  );
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault")], PROGRAM_ID
  );

  // Initialize Clanker player account
  console.log("\n--- Initialize Clanker ---");
  const [clankerCoinToss] = PublicKey.findProgramAddressSync(
    [Buffer.from("coin_toss"), clanker.publicKey.toBuffer()], PROGRAM_ID
  );
  const [clankerBlackjack] = PublicKey.findProgramAddressSync(
    [Buffer.from("blackjack"), clanker.publicKey.toBuffer()], PROGRAM_ID
  );
  try {
    const clankerProvider = new anchor.AnchorProvider(
      provider.connection,
      new anchor.Wallet(clanker),
      { commitment: "confirmed" }
    );
    const clankerProgram = new Program(idl, clankerProvider);
    await (clankerProgram.methods as any).initializePlayer().accounts({
      authority: clanker.publicKey,
      player: clankerPDA,
      coinToss: clankerCoinToss,
      blackjack: clankerBlackjack,
      systemProgram: SystemProgram.programId,
    }).rpc();
    console.log("Clanker initialized with 10,000 chips");
  } catch (e: any) {
    if (e.message?.includes("already in use")) {
      console.log("Clanker already initialized");
    } else {
      console.log("Init error:", e.message?.slice(0, 150));
    }
  }

  // Check balances
  let pA = await (program.account as any).player.fetch(playerAPDA);
  let pC = await (program.account as any).player.fetch(clankerPDA);
  console.log(`\nPlayer AI balance: ${pA.balance} chips`);
  console.log(`Clanker balance:   ${pC.balance} chips`);

  // --- Create "War" game template ---
  // War: each player gets 1 card, higher value wins
  console.log("\n--- Create Template: War (highest card wins) ---");
  const templateId = Date.now();
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(BigInt(templateId));
  const [templatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("template"), idBytes], PROGRAM_ID
  );

  const steps = [
    // Deal 1 card to each seat
    { dealToSeat: { seat: 1, count: 1, visibility: { hidden: {} } } },
    { dealToSeat: { seat: 2, count: 1, visibility: { hidden: {} } } },
    // Each player decides: check or fold
    { awaitTurn: { seat: 1 } },
    { awaitTurn: { seat: 2 } },
    // Reveal and compare
    { revealHidden: { target: { player: {} } } },
    { revealHidden: { target: { dealer: {} } } },
    { compareSeats: {} },
    // Winner gets pot (seat 0 = auto-detect winner)
    { payoutSeat: { seat: 0, multiplierBps: 20000 } },
  ];

  try {
    await (program.methods as any).createTemplate(
      new anchor.BN(templateId),
      padBytes("War", 32),
      padBytes("Each player gets 1 card. Highest wins the pot.", 128),
      steps,
      new anchor.BN(100),
      new anchor.BN(2000),
      100, // 1% creator fee
    ).accounts({
      creator: playerA.publicKey,
      vault: vaultPDA,
      template: templatePDA,
      systemProgram: SystemProgram.programId,
    }).rpc();
    console.log("Template created: War");
  } catch (e: any) {
    console.log("Template error:", e.message?.slice(0, 150));
  }

  // --- Player AI creates table ---
  console.log("\n--- Player AI creates table (bet 300 chips) ---");
  const tableId = Date.now() + 1;
  const tableIdBytes = Buffer.alloc(8);
  tableIdBytes.writeBigUInt64LE(BigInt(tableId));
  const [tablePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("table"), tableIdBytes], PROGRAM_ID
  );

  try {
    await (program.methods as any).createTable(
      new anchor.BN(tableId),
      new anchor.BN(300),
    ).accounts({
      authority: playerA.publicKey,
      player: playerAPDA,
      template: templatePDA,
      table: tablePDA,
      systemProgram: SystemProgram.programId,
    }).rpc();
    console.log("Table created. Waiting for Clanker to join...");
  } catch (e: any) {
    console.log("Create table error:", e.message?.slice(0, 200));
    return;
  }

  let tbl = await (program.account as any).table.fetch(tablePDA);
  console.log(`  Pot: ${tbl.pot} | Status: ${Object.keys(tbl.status)[0]}`);

  // --- Clanker joins table ---
  console.log("\n--- Clanker AI joins table ---");
  const clankerProvider = new anchor.AnchorProvider(
    provider.connection,
    new anchor.Wallet(clanker),
    { commitment: "confirmed" }
  );
  const clankerProgram = new Program(idl, clankerProvider);

  try {
    await (clankerProgram.methods as any).joinTable().accounts({
      authority: clanker.publicKey,
      player: clankerPDA,
      seat1Player: playerAPDA,
      template: templatePDA,
      table: tablePDA,
      oracleQueue: ORACLE_QUEUE,
      systemProgram: SystemProgram.programId,
    }).rpc();
    console.log("Clanker joined! VRF dealing cards...");
  } catch (e: any) {
    console.log("Join error:", e.message?.slice(0, 200));
    return;
  }

  // Wait for VRF deal callback
  process.stdout.write("Waiting for deal");
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    tbl = await (program.account as any).table.fetch(tablePDA);
    const status = Object.keys(tbl.status)[0];
    if (status !== "waitingVrf" && status !== "active") {
      console.log(`\n  Cards dealt!`);
      console.log(`  Player AI card: ${tbl.seat1Values.map((c: number) => cardName(c)).join(" ")} (val: ${handSum(tbl.seat1Values)})`);
      console.log(`  Clanker card:   ${tbl.seat2Values.map((c: number) => cardName(c)).join(" ")} (val: ${handSum(tbl.seat2Values)})`);
      console.log(`  Pot: ${tbl.pot} | Turn: seat ${tbl.currentTurn} | Status: ${status}`);
      break;
    }
    process.stdout.write(".");
  }

  // --- Player AI acts (check = 4) ---
  if (Object.keys(tbl.status)[0] === "waitingTurn" && tbl.currentTurn === 1) {
    console.log("\n--- Player AI: CHECK ---");
    try {
      await (program.methods as any).tableAction(4).accounts({
        authority: playerA.publicKey,
        seat1Player: playerAPDA,
        seat2Player: clankerPDA,
        template: templatePDA,
        table: tablePDA,
        oracleQueue: ORACLE_QUEUE,
        systemProgram: SystemProgram.programId,
      }).rpc();
      console.log("Player AI checked.");
    } catch (e: any) {
      console.log("Action error:", e.message?.slice(0, 200));
    }
  }

  // Refresh table
  await new Promise(r => setTimeout(r, 1000));
  tbl = await (program.account as any).table.fetch(tablePDA);
  console.log(`  Status: ${Object.keys(tbl.status)[0]} | Turn: seat ${tbl.currentTurn}`);

  // --- Clanker acts (check = 4) ---
  if (Object.keys(tbl.status)[0] === "waitingTurn" && tbl.currentTurn === 2) {
    console.log("\n--- Clanker AI: CHECK ---");
    try {
      await (clankerProgram.methods as any).tableAction(4).accounts({
        authority: clanker.publicKey,
        seat1Player: playerAPDA,
        seat2Player: clankerPDA,
        template: templatePDA,
        table: tablePDA,
        oracleQueue: ORACLE_QUEUE,
        systemProgram: SystemProgram.programId,
      }).rpc();
      console.log("Clanker checked.");
    } catch (e: any) {
      console.log("Clanker action error:", e.message?.slice(0, 200));
    }
  }

  // Wait for settlement (VRF callback for reveal + compare + payout)
  process.stdout.write("Waiting for settlement");
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    tbl = await (program.account as any).table.fetch(tablePDA);
    if (Object.keys(tbl.status)[0] === "settled") {
      console.log("\n");
      break;
    }
    process.stdout.write(".");
  }

  // --- Results ---
  console.log("╔══════════════════════════════════════╗");
  console.log("║          GAME RESULTS                ║");
  console.log("╠══════════════════════════════════════╣");
  console.log(`║ Player AI: ${tbl.seat1Values.map((c: number) => cardName(c)).join(" ").padEnd(25)}║`);
  console.log(`║ Clanker:   ${tbl.seat2Values.map((c: number) => cardName(c)).join(" ").padEnd(25)}║`);
  const winnerName = tbl.winner === 1 ? "Player AI" : tbl.winner === 2 ? "Clanker" : "Draw";
  console.log(`║ Winner:    ${winnerName.padEnd(25)}║`);
  console.log("╚══════════════════════════════════════╝");

  pA = await (program.account as any).player.fetch(playerAPDA);
  pC = await (program.account as any).player.fetch(clankerPDA);
  console.log(`\nPlayer AI balance: ${pA.balance} chips (wins: ${pA.totalWins}, losses: ${pA.totalLosses})`);
  console.log(`Clanker balance:   ${pC.balance} chips (wins: ${pC.totalWins}, losses: ${pC.totalLosses})`);
}

main().catch(console.error);
