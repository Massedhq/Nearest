import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, credits, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { fmtDate, money } from "@/lib/time";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "My credits" };

export default async function Credits() {
  const { user } = await requireVerifiedStudent();
  const rows = await db
    .select({ c: credits, pro: professionalProfiles.businessName })
    .from(credits)
    .leftJoin(professionalProfiles, eq(professionalProfiles.userId, credits.proId))
    .where(eq(credits.studentId, user.id))
    .orderBy(desc(credits.createdAt));
  const buckets = new Map<string, { pro: string | null; proId: string | null; total: number }>();
  for (const { c, pro } of rows) {
    const k = c.proId ?? "general";
    const cur = buckets.get(k) ?? { pro, proId: c.proId, total: 0 };
    cur.total += c.amountCents;
    buckets.set(k, cur);
  }
  const live = [...buckets.values()].filter((x) => x.total > 0);
  const sum = live.reduce((a, x) => a + x.total, 0);
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My Credits</div><span className="sp" /></div>
      <div className="body">
        <div className="card pearl" style={{ padding: 22 }}><span className="eyebrow" style={{ color: "#55514B" }}>Total available</span><span className="stat" style={{ fontSize: 48 }}>{money(sum)}</span><span className="small muted">Applied automatically at checkout</span></div>
        {live.map((x) => (
          <div key={x.proId ?? "g"} className="card">
            <div className="row between"><span className="tag">{x.proId ? `${x.pro} only` : "Any professional"}</span><span className="xs muted">Never expires</span></div>
            <span className="disp h2">{money(x.total)}</span>
            <Link className="btn sm" href={x.proId ? `/p/${x.proId}` : "/home"} style={{ width: "100%" }}>{x.proId ? "Book again" : "Book anyone"}</Link>
          </div>
        ))}
        {rows.length > 0 && <h3 className="eyebrow p">History</h3>}
        <div className="col" style={{ gap: 0 }}>
          {rows.map(({ c }) => (
            <div key={c.id} className="item"><div className="grow small"><div>{c.reason}</div><div className="xs muted">{fmtDate(c.createdAt)}</div></div><span className="num">{c.amountCents > 0 ? "+" : "−"}{money(Math.abs(c.amountCents))}</span></div>
          ))}
        </div>
        <p className="xs muted p">Credits can&apos;t be transferred or withdrawn as cash.</p>
      </div>
      <Tabs kind="student" active="Credits" />
    </div>
  );
}
