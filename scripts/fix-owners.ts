// One-time repair for owner accounts. Run: npx tsx scripts/fix-owners.ts
// 1) Any owner login that had a professional sign-up written onto it is restored:
//    real name from Clerk, professional business removed, the invitation reopened.
// 2) Any admin row whose email is NOT in OWNER_EMAILS loses admin access (nothing is deleted).
import { config } from "dotenv";
config({ path: ".env.local" });
import { createInterface } from "node:readline/promises";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);
const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
const main = (process.env.MAIN_OWNER_EMAIL ?? "").trim().toLowerCase();

type Row = { user_id: string; clerk_user_id: string; email: string | null; first_name: string | null; last_name: string | null; account_type: string; active: boolean };

async function clerkName(clerkUserId: string) {
  try {
    const r = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, { headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` } });
    if (!r.ok) return null;
    const u = (await r.json()) as { first_name: string | null; last_name: string | null; email_addresses: { email_address: string }[] };
    return { first: u.first_name, last: u.last_name, email: u.email_addresses?.[0]?.email_address ?? null };
  } catch { return null; }
}

async function run() {
  console.log(`\nOWNER_EMAILS: ${owners.join(", ") || "(empty!)"}`);
  if (!owners.length) { console.log("OWNER_EMAILS is empty in .env.local — nothing changed."); process.exit(1); }
  const rows = (await sql`select a.user_id, u.clerk_user_id, u.email, u.first_name, u.last_name, u.account_type, a.active
                          from admin_members a join users u on u.id = a.user_id order by a.created_at`) as Row[];
  const restore = rows.filter((r) => r.account_type !== "staff" && owners.includes((r.email ?? "").toLowerCase()));
  const revoke = rows.filter((r) => r.active && !owners.includes((r.email ?? "").toLowerCase()));

  console.log("\nAdmin accounts right now:");
  for (const r of rows) console.log(`  ${r.first_name ?? ""} ${r.last_name ?? ""}  <${r.email}>  type=${r.account_type}  active=${r.active}`);
  if (!restore.length && !revoke.length) { console.log("\nEverything already looks correct. Nothing to change."); process.exit(0); }

  const plans: { r: Row; name: { first: string | null; last: string | null } | null }[] = [];
  for (const r of restore) plans.push({ r, name: await clerkName(r.clerk_user_id) });
  console.log("\nThis will:");
  for (const { r, name } of plans) console.log(`  RESTORE  "${r.first_name} ${r.last_name}" <${r.email}>  →  "${name?.first ?? ""} ${name?.last ?? ""}" (owner account), remove the professional business attached to it`);
  for (const r of revoke) console.log(`  REMOVE ADMIN ACCESS  "${r.first_name} ${r.last_name}" <${r.email}>  (not in OWNER_EMAILS)`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question("\nType yes to apply: ")).trim().toLowerCase();
  rl.close();
  if (ans !== "yes") { console.log("Cancelled. Nothing changed."); process.exit(0); }

  for (const { r, name } of plans) {
    const id = r.user_id;
    const live = (await sql`select count(*)::int as n from bookings where pro_id = ${id} and status = 'confirmed'`) as { n: number }[];
    if (live[0].n) { console.log(`  SKIPPED ${r.email}: ${live[0].n} paid booking(s) on the attached pro business — cancel them first.`); continue; }
    await sql`update invitations set status = case when expires_at > now() then 'invited'::invite_status else 'expired'::invite_status end, registered_user_id = null where registered_user_id = ${id}`;
    await sql`delete from messages where booking_id in (select id from bookings where pro_id = ${id})`;
    await sql`delete from reviews where pro_id = ${id} or booking_id in (select id from bookings where pro_id = ${id})`;
    await sql`delete from fines where pro_id = ${id}`;
    await sql`delete from incidents where booking_id in (select id from bookings where pro_id = ${id})`;
    await sql`update credits set pro_id = null where pro_id = ${id}`;
    await sql`update credits set booking_id = null where booking_id in (select id from bookings where pro_id = ${id})`;
    await sql`delete from bookings where pro_id = ${id}`;
    for (const t of ["model_calls", "pro_openings", "pro_blocks", "portfolio_items", "pro_services", "pro_hours", "pro_credentials"]) await sql.query(`delete from ${t} where user_id = $1`, [id]);
    await sql`delete from membership_payments where pro_id = ${id}`;
    await sql`delete from favorites where pro_id = ${id}`;
    await sql`delete from professional_profiles where user_id = ${id}`;
    await sql`update users set account_type = 'staff', first_name = ${name?.first ?? r.first_name}, last_name = ${name?.last ?? r.last_name}, date_of_birth = null, updated_at = now() where id = ${id}`;
    await sql`update admin_members set active = true where user_id = ${id}`;
    console.log(`  RESTORED ${r.email} → ${name?.first ?? ""} ${name?.last ?? ""}`);
  }
  for (const r of revoke) {
    if ((r.email ?? "").toLowerCase() === main) continue; // never lock out the main owner
    await sql`update admin_members set active = false where user_id = ${r.user_id}`;
    console.log(`  ADMIN ACCESS REMOVED ${r.email}`);
  }
  console.log("\nDone. Refresh usenearest.com/admin — the change is immediate (same database).");
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
