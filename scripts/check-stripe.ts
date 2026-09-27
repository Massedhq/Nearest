// Checks the Stripe secret key in .env.local. Shows only the first characters of the key.
import { config } from "dotenv";
config({ path: ".env.local" });
import Stripe from "stripe";

async function run() {
  const raw = process.env.STRIPE_SECRET_KEY ?? "";
  const key = raw.trim().replace(/^["']|["']$/g, "");
  const shown = key ? `${key.slice(0, 8)}… (${key.length} characters)` : "(missing)";
  console.log(`\nSTRIPE_SECRET_KEY: ${shown}`);
  if (raw !== key) console.log("⚠ The key has spaces or quote marks around it — remove them.");
  if (!key) { console.log("⚠ There's no STRIPE_SECRET_KEY line in .env.local."); return; }
  if (key.startsWith("pk_")) { console.log("⚠ This is the PUBLISHABLE key (pk_…). Use the SECRET key (sk_test_… or sk_live_…)."); return; }
  if (key.startsWith("rk_")) console.log("Note: this is a restricted key (rk_…). A standard secret key (sk_…) is simplest.");
  try {
    const s = new Stripe(key);
    await s.balance.retrieve();
    console.log(`✓ Key works (${key.includes("_live_") ? "LIVE" : "TEST"} mode).`);
    try {
      await s.accounts.list({ limit: 1 });
      console.log("✓ Connect is available on this account.");
    } catch (e) {
      console.log(`⚠ Connect: ${(e as Error).message}`);
    }
    if (key.includes("_test_")) {
      // Practice run: create a payout account the same way Nearest does, then delete it.
      const base = { country: "US", business_type: "individual" as const, capabilities: { transfers: { requested: true } }, metadata: { kind: "nearest_check" } };
      for (const [label, extra] of [
        ["current method", { controller: { stripe_dashboard: { type: "express" as const }, fees: { payer: "application" as const }, losses: { payments: "application" as const }, requirement_collection: "stripe" as const } }],
        ["older method", { type: "express" as const }],
      ] as const) {
        try {
          const a = await s.accounts.create({ ...base, ...extra });
          console.log(`✓ Payout accounts can be created (${label}).`);
          await s.accounts.del(a.id).catch(() => {});
          break;
        } catch (e) {
          console.log(`✗ Creating a payout account (${label}) — Stripe said: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    console.log(`✗ Stripe said: ${(e as Error).message}`);
  }
}
run().then(() => { process.exitCode = 0; });
