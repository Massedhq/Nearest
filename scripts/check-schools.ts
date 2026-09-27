// Read-only check of the schools in Nearest. Run: npm run schools:check
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

async function run() {
  const sql = neon(process.env.DATABASE_URL!);
  const [t] = (await sql`select count(*)::int as total,
      count(*) filter (where type = 'high_school')::int as high_schools,
      count(*) filter (where type = 'college')::int as colleges,
      count(*) filter (where type = 'trade')::int as trade,
      count(*) filter (where not active)::int as turned_off
    from schools`) as Record<string, number>[];
  console.log("\nSchools in Nearest:", t);
  const byState = (await sql`select c.state, count(*)::int as n from schools s join cities c on c.id = s.city_id group by c.state order by n desc limit 10`) as { state: string; n: number }[];
  console.log("Top states:", byState.map((r) => `${r.state} ${r.n}`).join(", ") || "(none)");
  const [noCounty] = (await sql`select count(*)::int as n from schools s where not exists (select 1 from city_counties cc where cc.city_id = s.city_id)`) as { n: number }[];
  console.log(`Schools whose city has NO county linked (can't be picked by students): ${noCounty.n}`);
  const [offCities] = (await sql`select count(*)::int as n from schools s join cities c on c.id = s.city_id where not c.active`) as { n: number }[];
  console.log(`Schools in cities that are turned off: ${offCities.n}`);
  const [counties] = (await sql`select count(*)::int as n, count(distinct state)::int as states from counties`) as { n: number; states: number }[];
  console.log(`Counties: ${counties.n} across ${counties.states} state(s)`);
  const sample = (await sql`select s.name, c.name as city, c.state, k.name as county from schools s join cities c on c.id = s.city_id left join city_counties cc on cc.city_id = c.id left join counties k on k.id = cc.county_id where c.name ilike 'austin' or s.name ilike '%university of texas%' limit 5`) as Record<string, string>[];
  console.log("Austin / UT sample:", sample.length ? "" : "(none found)");
  for (const r of sample) console.log(`  ${r.name} — ${r.city}, ${r.state} (county: ${r.county ?? "NONE"})`);
  console.log("");
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
