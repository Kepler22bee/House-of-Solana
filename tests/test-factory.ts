import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("8NjeMQCn3oVC3t9MBbvq3ypLxbU8jhxmmiZHtPGJeVBg");
const ORACLE_QUEUE = new PublicKey("Cuj97ggrhhidhbu39TijNVqE74xvKJ69gDervRUXAxGh");
const VAULT_SEED = "vault";
const TEMPLATE_SEED = "template";
const SESSION_SEED = "session";
const PLAYER_SEED = "player";

function padBytes(str: string, len: number): number[] {
  const buf = Buffer.alloc(len);
  buf.write(str);
  return Array.from(buf);
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
  const [vaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_SEED)], PROGRAM_ID
  );

  let ps = await (program.account as any).player.fetch(playerPDA);
  console.log("=== GAME FACTORY TEST ===");
  console.log(`Balance: ${ps.balance.toString()} chips\n`);

  // --- 1. Create "Triple Dice" template ---
  // Rules: Roll 3d6. Sum > 16 → 5x. Sum > 12 → 2x. Else lose.
  const templateId = Date.now(); // unique id
  const idBytes = Buffer.alloc(8);
  idBytes.writeBigUInt64LE(BigInt(templateId));
  const [templatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(TEMPLATE_SEED), idBytes], PROGRAM_ID
  );

  console.log("--- 1. Create Template: Triple Dice ---");
  const steps = [
    // Step 0: Roll 3 six-sided dice → player values
    { rollDice: { sides: 6, count: 3, to: { player: {} } } },
    // Step 1: Check if sum > 16
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 16 } },
    // Step 2: If yes → 5x payout
    { payout: { multiplierBps: 50000 } },
    // Step 3: Check if sum > 12
    { checkThreshold: { target: { player: {} }, op: { gt: {} }, value: 12 } },
    // Step 4: If yes → 2x payout
    { payout: { multiplierBps: 20000 } },
    // Step 5: Else lose
    { lose: {} },
  ];

  try {
    const tx = await (program.methods as any)
      .createTemplate(
        new anchor.BN(templateId),
        padBytes("Triple Dice", 32),
        padBytes("Roll 3 dice. Sum>16=5x, Sum>12=2x, else lose.", 128),
        steps,
        new anchor.BN(100),  // min bet
        new anchor.BN(2000), // max bet
        200, // 2% creator fee
      )
      .accounts({
        creator: player.publicKey,
        vault: vaultPDA,
        template: templatePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Template created:", tx);
  } catch (e: any) {
    console.error("Create failed:", e.message?.slice(0, 200));
    return;
  }

  // Verify template
  const tmpl = await (program.account as any).gameTemplate.fetch(templatePDA);
  const tmplName = Buffer.from(tmpl.name).toString("utf8").replace(/\0/g, "");
  console.log(`  Name: ${tmplName}`);
  console.log(`  Steps: ${tmpl.steps.length}`);
  console.log(`  Min/Max bet: ${tmpl.minBet}/${tmpl.maxBet}`);
  console.log(`  Creator fee: ${tmpl.creatorFeeBps} bps`);

  // --- 2. Play the game (5 rounds) ---
  const [sessionPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from(SESSION_SEED), player.publicKey.toBuffer()], PROGRAM_ID
  );

  for (let round = 1; round <= 5; round++) {
    ps = await (program.account as any).player.fetch(playerPDA);
    const balBefore = Number(ps.balance);

    console.log(`\n--- Round ${round} (bet 200) ---`);

    try {
      await (program.methods as any)
        .startGame(new anchor.BN(200))
        .accounts({
          authority: player.publicKey,
          player: playerPDA,
          template: templatePDA,
          session: sessionPDA,
          oracleQueue: ORACLE_QUEUE,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      // Wait for VRF callback
      process.stdout.write("  Rolling");
      for (let i = 0; i < 20; i++) {
        await new Promise(r => setTimeout(r, 1000));
        const sess = await (program.account as any).gameSession.fetch(sessionPDA);
        const status = Object.keys(sess.status)[0];
        if (status === "settled") {
          const dice = sess.playerValues;
          const sum = dice.reduce((a: number, b: number) => a + b, 0);
          const multiplier = sess.resultMultiplierBps;

          ps = await (program.account as any).player.fetch(playerPDA);
          const balAfter = Number(ps.balance);
          const diff = balAfter - balBefore;

          let result = "LOSE";
          if (multiplier === 50000) result = "5x WIN!";
          else if (multiplier === 20000) result = "2x WIN!";
          else if (multiplier > 0) result = `${multiplier/10000}x`;

          console.log(`\n  Dice: [${dice.join(", ")}] Sum: ${sum}`);
          console.log(`  Result: ${result} | Balance: ${balAfter} (${diff >= 0 ? "+" : ""}${diff})`);
          break;
        }
        process.stdout.write(".");
      }
    } catch (e: any) {
      console.error("  Failed:", e.message?.slice(0, 200));
    }
  }

  // --- 3. Final stats ---
  console.log("\n--- Template Stats ---");
  const tmplFinal = await (program.account as any).gameTemplate.fetch(templatePDA);
  console.log(`  Total plays: ${tmplFinal.totalPlays}`);
  console.log(`  Total volume: ${tmplFinal.totalVolume} chips`);

  ps = await (program.account as any).player.fetch(playerPDA);
  console.log(`\n--- Player Stats ---`);
  console.log(`  Balance: ${ps.balance}`);
  console.log(`  Total bets: ${ps.totalBets}`);
  console.log(`  Wins: ${ps.totalWins} | Losses: ${ps.totalLosses}`);

  console.log("\n=== FACTORY TEST COMPLETE ===");
}

main().catch(console.error);
