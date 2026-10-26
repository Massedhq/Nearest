import { desc, sql } from "drizzle-orm";
import { db, lookSearches, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/time";
import { lookStats } from "@/lib/look-match";
import { indexLooksNow } from "@/app/admin/photo-match-actions";

export const metadata = { title: "Find by photo" };
export const dynamic = "force-dynamic";

/** Find by photo: how many portfolio photos are ready for matching, and what students searched for (their photos are never stored). */
export default async function PhotoMatch() {
  const { role } = await requireAdmin();
  const owner = role === "OWNER";
  const [stats, recent, cats] = await Promise.all([
    lookStats(),
    db.select().from(lookSearches).orderBy(desc(lookSearches.createdAt)).limit(40),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);
  const ai = Boolean(process.env.ANTHROPIC_API_KEY);
  const [errs] = await db.select({ n: sql<number>`count(*) filter (where ${lookSearches.error} is not null)::int` }).from(lookSearches).where(sql`${lookSearches.createdAt} > now() - interval '7 days'`);
  return (
    <>
      <AdminHead eyebrow="Operations" title="Find by photo" />
      <span className="small muted">
        Students upload an inspo photo and see only professionals whose own portfolio photos closely match that look. Every portfolio photo is
        fingerprinted on Nearest&apos;s server (new photos within about 15 minutes); the closest ones are then checked by the AI, which scores how close
        each is to the exact look. Students&apos; photos are never stored. Rules (lowest score shown, searches per day) are in Rules &amp; Settings → Find by photo.
      </span>
      <div className="grid2">
        <div className="card"><span className="xs muted">Portfolio photos ready</span><span className="disp h2">{stats.ready} / {stats.photos}</span><span className="xs muted">{stats.waiting} waiting{stats.failed ? ` • ${stats.failed} couldn't be read` : ""}</span></div>
        <div className="card"><span className="xs muted">Searches (7 days)</span><span className="disp h2">{stats.week}</span><span className="xs muted">{stats.withResults} found a match{errs.n ? ` • ${errs.n} without the AI` : ""}</span></div>
      </div>
      <div className="card"><span className="xs">{ai ? "✓" : "✗"} AI look check (ANTHROPIC_API_KEY in Vercel — the same key as the AI recruiter). {ai ? "" : "Without it, only near-identical photos are shown."}</span></div>
      {owner && stats.waiting > 0 && (
        <ActionForm action={indexLooksNow} submitLabel="Add waiting photos now" buttonClass="btn ghost sm" className="col g4">
          <span className="xs muted">Runs automatically every 15 minutes too.</span>
        </ActionForm>
      )}
      <h2 className="disp h3">Recent searches</h2>
      {recent.length === 0 && <div className="card"><span className="small muted">No searches yet.</span></div>}
      {recent.map((r) => (
        <div key={r.id} className="card" style={{ gap: 2 }}>
          <div className="row between"><span className="small b">{r.detected || "—"}</span><span className={`tag ${r.results ? "ok" : ""}`}>{r.results} match{r.results === 1 ? "" : "es"}</span></div>
          <span className="xs muted">{fmtDate(r.createdAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} • {r.categoryId ? cats.find((c) => c.id === r.categoryId)?.name : "Any service"} • {r.compared} photos compared{r.aiUsed ? "" : " • without the AI"}{r.error ? ` (${r.error.slice(0, 80)})` : ""}</span>
        </div>
      ))}
    </>
  );
}
