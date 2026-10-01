import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db, bundles, bundleItems, categories } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { expireBundles } from "@/lib/bundles";
import { fmtDate, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "Bundle my booking" };

const shortDay = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export default async function MyBundles() {
  const { user } = await requireVerifiedStudent();
  await expireBundles();
  const list = await db.select().from(bundles).where(and(eq(bundles.studentId, user.id), inArray(bundles.status, ["building", "ready", "booked"]))).orderBy(desc(bundles.createdAt)).limit(20);
  const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
  const counts = list.length ? await db.select({ bundleId: bundleItems.bundleId }).from(bundleItems).where(inArray(bundleItems.bundleId, list.map((b) => b.id))) : [];
  return (
    <div className="scr">
      <TopBar title="Bundle my booking" back="/home" />
      <div className="body">
        <h1 className="disp h1">Bundle my booking</h1>
        <p className="small muted p">Need hair, lashes, nails and makeup for the same week? Tell us what you need, your budget and the week — we&apos;ll find professionals near you with openings that fit.</p>
        <Link className="btn" href="/bundle/new">Start a new bundle</Link>
        {list.map((b) => {
          const saved = counts.filter((c) => c.bundleId === b.id).length;
          return (
            <Link key={b.id} className="card" href={b.status === "booked" ? `/bundle/${b.id}/book` : `/bundle/${b.id}`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
              <div className="row between"><span className="b">Week of {shortDay(b.startDate)}</span><span className={`tag ${b.status === "booked" ? "ok" : b.status === "ready" ? "warn" : ""}`}>{b.status === "booked" ? "Booked" : b.status === "ready" ? "Ready to book" : `${saved} of ${b.categoryIds.length} saved`}</span></div>
              <span className="small">{b.categoryIds.map((id) => cats.find((c) => c.id === id)?.name).filter(Boolean).join(" • ")}</span>
              <span className="xs muted">Budget {money(b.budgetCents)}{b.status !== "booked" ? ` • Saved until ${fmtDate(b.expiresAt, { month: "short", day: "numeric" })}` : ""}</span>
            </Link>
          );
        })}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
