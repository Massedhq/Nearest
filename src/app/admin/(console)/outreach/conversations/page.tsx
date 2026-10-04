import Link from "next/link";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db, prospects, prospectMessages, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { outreachScope, PROSPECT_STATUSES } from "@/lib/outreach";

export const metadata = { title: "Conversations" };

/** Every prospect who replied, newest first. */
export default async function Conversations({ searchParams }: { searchParams: Promise<{ who?: string }> }) {
  const { user } = await requireAdmin();
  const { isMain } = await outreachScope(user.id);
  const everyone = isMain && (await searchParams).who === "all";
  const rows = await db.select({ p: prospects, who: users.firstName }).from(prospects).leftJoin(users, eq(users.id, prospects.recruiterId))
    .where(and(isNotNull(prospects.lastMessageAt), ...(everyone ? [] : [eq(prospects.recruiterId, user.id)]))).orderBy(desc(prospects.lastMessageAt)).limit(150);
  const ids = rows.map((r) => r.p.id);
  const msgs = ids.length ? await db.select().from(prospectMessages).where(inArray(prospectMessages.prospectId, ids)).orderBy(desc(prospectMessages.createdAt)) : [];
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Conversations" />
      <OutreachNav at="conversations" />
      {isMain && <div className="chips"><Link className={`chip${!everyone ? " on" : ""}`} href="/admin/outreach/conversations">Mine</Link><Link className={`chip${everyone ? " on" : ""}`} href="/admin/outreach/conversations?who=all">Everyone</Link></div>}
      {rows.length === 0 && <div className="card small"><span>No replies yet. When prospects answer your emails, the conversation shows here.</span></div>}
      {rows.map(({ p, who }) => {
        const last = msgs.find((m) => m.prospectId === p.id);
        return (
          <Link key={p.id} className="card" href={`/admin/outreach/prospects/${p.id}`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
            <div className="row between" style={{ gap: 6, flexWrap: "wrap" }}>
              <span className="b">{p.name}</span>
              <span className="row" style={{ gap: 6 }}>
                {p.aiMode === "human" && <span className="tag">You&apos;re handling it</span>}
                <span className={`tag ${p.status === "needs_review" ? "warn" : ["registered", "profile_complete"].includes(p.status) ? "ok" : ""}`}>{PROSPECT_STATUSES[p.status] ?? p.status}</span>
              </span>
            </div>
            {last && <span className="small muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{last.direction === "in" ? `${p.name.split(" ")[0]}: ` : last.author === "ai" ? "AI: " : "You: "}{last.body.replace(/\s+/g, " ").slice(0, 140)}</span>}
            <span className="xs muted">{[p.category, p.city].filter(Boolean).join(" • ")}{everyone && who ? ` • ${who}` : ""} • {p.lastMessageAt?.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</span>
          </Link>
        );
      })}
    </>
  );
}
