// One-time cleanup before launch: removes test accounts and all their activity.
// KEEPS: owner/admin accounts, settings, counties, cities, schools, categories and suggested services.
// Run: npm run db:cleanup   (asks you to type DELETE TEST DATA first)
import { config } from "dotenv";
config({ path: ".env.local" });

import { createInterface } from "node:readline/promises";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Children first so nothing is left pointing at a deleted row.
const ACTIVITY = [
  "notifications", "favorites", "search_log", "messages", "reviews", "fines", "incidents", "appeals", "credits",
  "membership_payments", "partner_payouts", "bookings", "model_calls", "pro_openings", "pro_blocks", "portfolio_items",
  "pro_services", "pro_hours", "pro_credentials", "student_id_docs", "school_requests", "student_profiles",
  "professional_profiles", "invitations", "activity_log",
];

async function main() {
  const host = new URL(process.env.DATABASE_URL!).host;
  const admins = (await sql`select u.email from admin_members a join users u on u.id = a.user_id where a.active`) as { email: string }[];
  const others = (await sql`select count(*)::int as n from users where id not in (select user_id from admin_members)`) as { n: number }[];
  console.log(`\nDatabase: ${host}`);
  console.log(`Keeping owner/admin logins: ${admins.map((a) => a.email).join(", ") || "(none)"}`);
  console.log(`Keeping: settings, counties, cities, schools, categories, suggested services.`);
  console.log(`Removing: ${others[0].n} other user accounts, plus every booking, message, review, credit, fine, invitation,`);
  console.log(`          professional profile (owners' too), student profile, payment record and the activity log.\n`);
  console.log("Owners who also want a professional profile can register again afterwards through a new invitation.");
  console.log("Test logins also stay in Clerk's test instance — that's fine; production users are separate.\n");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question('Type DELETE TEST DATA to continue (anything else cancels): ')).trim();
  rl.close();
  if (answer !== "DELETE TEST DATA") { console.log("Cancelled. Nothing was changed."); process.exit(0); }
  for (const t of ACTIVITY) {
    const r = (await sql.query(`with d as (delete from ${t} returning 1) select count(*)::int as n from d`)) as { n: number }[];
    console.log(`  ${t}: ${r[0].n} removed`);
  }
  const u = (await sql`with d as (delete from users where id not in (select user_id from admin_members) returning 1) select count(*)::int as n from d`) as { n: number }[];
  await sql`update users set account_type = 'staff' where id in (select user_id from admin_members)`;
  console.log(`  users: ${u[0].n} removed (owners kept)`);
  console.log("\nDone. Nearest is clean for launch.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
