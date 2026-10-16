import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

/**
 * One quick update the installer runs: renames "Skincare" to "Esthetician/Skincare". The category keeps its id, so
 * every professional, service, spot count and prospect stays attached. Safe to run again (does nothing once renamed).
 * Times out after 60 seconds instead of waiting on Neon forever.
 */
setTimeout(() => { console.error("  Neon didn't answer within 70 seconds - skipped for now."); process.exit(1); }, 70000).unref();
const run = neon(process.env.DATABASE_URL!, { fetchOptions: { signal: AbortSignal.timeout(60000) } });
run`update categories set name = 'Esthetician/Skincare' where name = 'Skincare' and not exists (select 1 from categories where name = 'Esthetician/Skincare') returning id`
  .then((rows) => { console.log(rows.length ? '  Renamed "Skincare" to "Esthetician/Skincare".' : '  "Esthetician/Skincare" is already in place.'); process.exit(0); })
  .catch((e) => { console.error(`  Couldn't rename the category right now (${(e as Error).message}). Run the installer again later.`); process.exit(1); });
