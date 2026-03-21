import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");

function cardName(card: number): string {
  if (card === 0) return "?";
  const rank = ((card - 1) % 13) + 1;
  const suits = ["♠", "♥", "♦", "♣"];
  const suit = suits[Math.floor((card - 1) / 13)];
  const names: Record<number, string> = { 1: "A", 11: "J", 12: "Q", 13: "K" };
  return `${names[rank] || rank}${suit}`;
}

function handValue(cards: number[]): number {
  let total = 0, aces = 0;
  for (const card of cards) {
    if (card === 0) continue;
    const rank = ((card - 1) % 13) + 1;
    if (rank === 1) { aces++; total += 11; }
    else if (rank >= 10) { total += 10; }
    else { total += rank; }
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

async function waitForStatus(program: Program, pda: PublicKey, notStatus: string, maxWait = 20): Promise<any> {
  for (let i = 0; i < maxWait; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const bj = await (program.account as any).blackjackState.fetch(pda);
    const status = Object.keys(bj.status)[0];
    if (status !== notStatus) return bj;
    process.stdout.write(".");
  }
  throw new Error(`Timeout waiting for status change from ${notStatus}`);
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found");
  const program = new Program(idl, provider);
  const wallet = provider.wallet as anchor.Wallet;
  const player = wallet.payer;

  const [playerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("player"), player.publicKey.toBuffer()], PROGRAM_ID
  );
  const [bjPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("blackjack"), player.publicKey.toBuffer()], PROGRAM_ID
  );

  const accounts = {
    authority: player.publicKey,
    player: playerPDA,
    blackjack: bjPDA,
    oracleQueue: ORACLE_QUEUE,
    systemProgram: SystemProgram.programId,
  };

  let ps = await (program.account as any).player.fetch(playerPDA);
  console.log("=== BLACKJACK FULL TEST ===");
  console.log(`Starting balance: ${ps.balance.toString()} chips\n`);

  const results: { round: number; action: string; playerHand: string; dealerHand: string; pVal: number; dVal: number; result: string; balChange: number }[] = [];

  for (let round = 1; round <= 10; round++) {
    const balBefore = Number((await (program.account as any).player.fetch(playerPDA)).balance);

    console.log(`━━━ Round ${round} ━━━`);

    // Start hand
    try {
      await (program.methods as any).startHand(new anchor.BN(200)).accounts(accounts).rpc();
    } catch (e: any) {
      console.log(`  Start failed: ${e.message?.slice(0, 100)}`);
      continue;
    }

    // Wait for deal
    process.stdout.write("  Dealing");
    let bj: any;
    try {
      bj = await waitForStatus(program, bjPDA, "dealing");
    } catch {
      console.log("\n  Deal timeout");
      continue;
    }

    let status = Object.keys(bj.status)[0];
    const pCards = () => bj.playerCards.map((c: number) => cardName(c)).join(" ");
    const dCards = () => bj.dealerCards.map((c: number) => cardName(c)).join(" ");
    const pVal = () => handValue(bj.playerCards);
    const dVal = () => handValue(bj.dealerCards);

    console.log(`\n  Player: ${pCards()} (${pVal()}) | Dealer: ${cardName(bj.dealerCards[0])} [?]`);

    if (status === "settled") {
      const res = Object.keys(bj.result)[0];
      console.log(`  → Immediate: ${res}`);
      const balAfter = Number((await (program.account as any).player.fetch(playerPDA)).balance);
      results.push({ round, action: "natural", playerHand: pCards(), dealerHand: dCards(), pVal: pVal(), dVal: dVal(), result: res, balChange: balAfter - balBefore });
      console.log(`  Dealer: ${dCards()} (${dVal()}) | Balance: ${balAfter} (${balAfter - balBefore >= 0 ? "+" : ""}${balAfter - balBefore})`);
      continue;
    }

    // Hit loop: hit while < 15
    let action = "stand";
    while (status === "playerTurn" && pVal() < 15 && bj.playerCards.length < 8) {
      action = "hit";
      console.log(`  HIT (${pVal()} < 15)`);
      try {
        await (program.methods as any).hit().accounts(accounts).rpc();
      } catch (e: any) {
        console.log(`  Hit failed: ${e.message?.slice(0, 100)}`);
        break;
      }

      process.stdout.write("  Drawing");
      try {
        bj = await waitForStatus(program, bjPDA, "playerTurn", 15);
        // If still playerTurn, card was added but not bust — re-fetch
      } catch {
        // Timeout means still playerTurn (card added, not bust)
        bj = await (program.account as any).blackjackState.fetch(bjPDA);
      }

      // Re-check: the status might still be playerTurn if we didn't bust
      status = Object.keys(bj.status)[0];
      console.log(`\n  Player: ${pCards()} (${pVal()}) | Status: ${status}`);

      if (status === "settled") {
        break;
      }

      // If status is still not playerTurn, we transitioned
      if (status !== "playerTurn") break;
    }

    // If busted during hit
    if (status === "settled") {
      const res = Object.keys(bj.result)[0];
      console.log(`  Dealer: ${dCards()} (${dVal()}) | Result: ${res}`);
      const balAfter = Number((await (program.account as any).player.fetch(playerPDA)).balance);
      results.push({ round, action, playerHand: pCards(), dealerHand: dCards(), pVal: pVal(), dVal: dVal(), result: res, balChange: balAfter - balBefore });
      console.log(`  Balance: ${balAfter} (${balAfter - balBefore >= 0 ? "+" : ""}${balAfter - balBefore})`);
      continue;
    }

    // Stand
    if (status === "playerTurn") {
      action = pVal() >= 15 ? "stand" : action + "+stand";
      console.log(`  STAND (${pVal()})`);
      try {
        await (program.methods as any).stand().accounts(accounts).rpc();
      } catch (e: any) {
        console.log(`  Stand failed: ${e.message?.slice(0, 100)}`);
        continue;
      }

      process.stdout.write("  Dealer drawing");
      try {
        bj = await waitForStatus(program, bjPDA, "dealerTurn");
      } catch {
        console.log("\n  Dealer timeout");
        continue;
      }
    }

    status = Object.keys(bj.status)[0];
    const res = Object.keys(bj.result)[0];
    console.log(`\n  Player: ${pCards()} (${pVal()}) | Dealer: ${dCards()} (${dVal()})`);
    console.log(`  Result: ${res}`);
    const balAfter = Number((await (program.account as any).player.fetch(playerPDA)).balance);
    results.push({ round, action, playerHand: pCards(), dealerHand: dCards(), pVal: pVal(), dVal: dVal(), result: res, balChange: balAfter - balBefore });
    console.log(`  Balance: ${balAfter} (${balAfter - balBefore >= 0 ? "+" : ""}${balAfter - balBefore})\n`);
  }

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║                         RESULTS SUMMARY                            ║");
  console.log("╠═══╦════════╦═══════════════════╦═══════════════════╦════════╦═══════╣");
  console.log("║ # ║ Action ║ Player            ║ Dealer            ║ Result ║ +/-   ║");
  console.log("╠═══╬════════╬═══════════════════╬═══════════════════╬════════╬═══════╣");
  for (const r of results) {
    const act = r.action.padEnd(6).slice(0, 6);
    const ph = `${r.playerHand} (${r.pVal})`.padEnd(17).slice(0, 17);
    const dh = `${r.dealerHand} (${r.dVal})`.padEnd(17).slice(0, 17);
    const res = r.result.padEnd(6).slice(0, 6);
    const chg = `${r.balChange >= 0 ? "+" : ""}${r.balChange}`.padStart(5);
    console.log(`║ ${String(r.round).padStart(1)} ║ ${act} ║ ${ph} ║ ${dh} ║ ${res} ║ ${chg} ║`);
  }
  console.log("╚═══╩════════╩═══════════════════╩═══════════════════╩════════╩═══════╝");

  const wins = results.filter(r => ["playerWin", "blackjack", "dealerBust"].includes(r.result)).length;
  const losses = results.filter(r => ["dealerWin", "playerBust"].includes(r.result)).length;
  const pushes = results.filter(r => r.result === "push").length;
  const totalChange = results.reduce((sum, r) => sum + r.balChange, 0);

  ps = await (program.account as any).player.fetch(playerPDA);
  console.log(`\nWins: ${wins} | Losses: ${losses} | Pushes: ${pushes}`);
  console.log(`Net: ${totalChange >= 0 ? "+" : ""}${totalChange} chips`);
  console.log(`Final balance: ${ps.balance.toString()} chips`);
  console.log(`Lifetime — Bets: ${ps.totalBets} | Wins: ${ps.totalWins} | Losses: ${ps.totalLosses}`);
}

main().catch(console.error);
