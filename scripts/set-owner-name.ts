// Sets an account's name in both the Nearest database and Clerk.
// Run: npx tsx scripts/set-owner-name.ts avy@usenearest.com Avy Evans
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function run() {
  const [email, first, ...rest] = process.argv.slice(2);
  const last = rest.join(" ");
  if (!email || !first || !last) { console.log('Usage: npx tsx scripts/set-owner-name.ts you@usenearest.com First Last'); process.exit(1); }
  const sql = neon(process.env.DATABASE_URL!);
  const rows = (await sql`select id, clerk_user_id, first_name, last_name from users where lower(email) = ${email.toLowerCase()}`) as { id: string; clerk_user_id: string; first_name: string | null; last_name: string | null }[];
  if (!rows.length) { console.log(`No account with ${email}. Nothing changed.`); process.exit(1); }
  const u = rows[0];
  await sql`update users set first_name = ${first}, last_name = ${last}, updated_at = now() where id = ${u.id}`;
  console.log(`Nearest: "${u.first_name} ${u.last_name}" → "${first} ${last}"`);
  const r = await fetch(`https://api.clerk.com/v1/users/${u.clerk_user_id}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ first_name: first, last_name: last }),
  });
  console.log(r.ok ? `Clerk login: name set to "${first} ${last}"` : `Clerk login: couldn't update (${r.status}). Change it in the Clerk dashboard → Users.`);
  console.log("Done. Refresh usenearest.com/admin.");
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
