import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const PLAYER_SEED = "player";
const BLACKJACK_SEED = "blackjack";
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
  let total = 0;
  let aces = 0;
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

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const idl = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!idl) throw new Error("IDL not found");
  const program = new Program(idl, provider);

  const wallet = provider.wallet as anchor.Wallet;
  const player = wallet.payer;

  const [playerPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLAYER_SEED), player.publicKey.toBuffer()], PROGRAM_ID
  );
  const [blackjackPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(BLACKJACK_SEED), player.publicKey.toBuffer()], PROGRAM_ID
  );

  console.log("=== BLACKJACK TEST ===");
  console.log("Player:", player.publicKey.toBase58());

  // Check balance
  let playerState = await (program.account as any).player.fetch(playerPDA);
  console.log("Balance:", playerState.balance.toString(), "chips");

  // --- Init Blackjack account if needed ---
  try {
    await (program.account as any).blackjackState.fetch(blackjackPDA);
    console.log("Blackjack account exists");
  } catch {
    console.log("Creating blackjack account...");
    await (program.methods as any).initializeBlackjack().accounts({
      authority: player.publicKey,
      blackjack: blackjackPDA,
      systemProgram: SystemProgram.programId,
    }).rpc();
    console.log("Blackjack account created");
  }

  // --- Start Hand ---
  console.log("\n--- Start Hand (200 chips) ---");
  try {
    const tx = await (program.methods as any)
      .startHand(new anchor.BN(200))
      .accounts({
        authority: player.publicKey,
        player: playerPDA,
        blackjack: blackjackPDA,
        oracleQueue: ORACLE_QUEUE,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Start tx:", tx);

    // Wait for deal callback
    process.stdout.write("Waiting for deal");
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const bj = await (program.account as any).blackjackState.fetch(blackjackPDA);
      const status = Object.keys(bj.status)[0];
      if (status !== "dealing") {
        const pCards = bj.playerCards.map((c: number) => cardName(c));
        const dCards = bj.dealerCards.map((c: number) => cardName(c));
        console.log(`\n  Player: ${pCards.join(" ")} (${handValue(bj.playerCards)})`);
        console.log(`  Dealer: ${dCards[0]} [hidden] (showing ${handValue([bj.dealerCards[0]])})`);
        console.log(`  Status: ${status} | Result: ${Object.keys(bj.result)[0]}`);

        if (status === "settled") {
          console.log("  Hand settled immediately (blackjack or dealer blackjack)");
          break;
        }

        // --- Hit if < 15 ---
        if (status === "playerTurn" && handValue(bj.playerCards) < 15) {
          console.log("\n--- Hit (hand < 15) ---");
          const hitTx = await (program.methods as any)
            .hit()
            .accounts({
              authority: player.publicKey,
              player: playerPDA,
              blackjack: blackjackPDA,
              oracleQueue: ORACLE_QUEUE,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          console.log("Hit tx:", hitTx);

          process.stdout.write("Waiting for card");
          for (let j = 0; j < 20; j++) {
            await new Promise(r => setTimeout(r, 1000));
            const bj2 = await (program.account as any).blackjackState.fetch(blackjackPDA);
            if (bj2.playerCards.length > bj.playerCards.length || Object.keys(bj2.status)[0] === "settled") {
              const pCards2 = bj2.playerCards.map((c: number) => cardName(c));
              console.log(`\n  Player: ${pCards2.join(" ")} (${handValue(bj2.playerCards)})`);
              console.log(`  Status: ${Object.keys(bj2.status)[0]}`);
              if (Object.keys(bj2.status)[0] === "settled") {
                console.log("  BUST! Player loses.");
              }
              break;
            }
            process.stdout.write(".");
          }
        }

        // --- Stand ---
        const bjNow = await (program.account as any).blackjackState.fetch(blackjackPDA);
        if (Object.keys(bjNow.status)[0] === "playerTurn") {
          console.log("\n--- Stand ---");
          const standTx = await (program.methods as any)
            .stand()
            .accounts({
              authority: player.publicKey,
              player: playerPDA,
              blackjack: blackjackPDA,
              oracleQueue: ORACLE_QUEUE,
              systemProgram: SystemProgram.programId,
            })
            .rpc();
          console.log("Stand tx:", standTx);

          process.stdout.write("Waiting for dealer");
          for (let j = 0; j < 20; j++) {
            await new Promise(r => setTimeout(r, 1000));
            const bj3 = await (program.account as any).blackjackState.fetch(blackjackPDA);
            if (Object.keys(bj3.status)[0] === "settled") {
              const pCards3 = bj3.playerCards.map((c: number) => cardName(c));
              const dCards3 = bj3.dealerCards.map((c: number) => cardName(c));
              console.log(`\n  Player: ${pCards3.join(" ")} (${handValue(bj3.playerCards)})`);
              console.log(`  Dealer: ${dCards3.join(" ")} (${handValue(bj3.dealerCards)})`);
              console.log(`  Result: ${Object.keys(bj3.result)[0]}`);
              break;
            }
            process.stdout.write(".");
          }
        }
        break;
      }
      process.stdout.write(".");
    }
  } catch (e: any) {
    console.error("Failed:", e.message?.slice(0, 200));
  }

  // Final state
  console.log("\n--- Final State ---");
  playerState = await (program.account as any).player.fetch(playerPDA);
  console.log("Balance:", playerState.balance.toString(), "chips");
  console.log("Total bets:", playerState.totalBets.toString());
  console.log("Wins:", playerState.totalWins.toString(), "| Losses:", playerState.totalLosses.toString());
}

main().catch(console.error);
