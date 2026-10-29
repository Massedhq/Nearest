import Link from "next/link";
import { asc, desc, eq, isNotNull, and, inArray, sql } from "drizzle-orm";
import { db, users, professionalProfiles, prospects, prospectDrafts, categories, cities } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";
import { buildStatus } from "@/lib/build-status";
import { BuildProfileForm } from "@/components/BuildProfileForm";
import { BuildScreenshots } from "@/components/BuildScreenshots";

export const metadata = { title: "Build a profile" };
export const dynamic = "force-dynamic";

/**
 * Build a professional's profile for them (with their permission), then email them a link to claim it: they only
 * create a password, accept the Terms, and go live.
 */
export default async function BuildProfiles({ searchParams }: { searchParams: Promise<{ prospect?: string }> }) {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") return <><AdminHead eyebrow="Professional Outreach" title="Build a profile" /><div className="card small"><span>Only owners can build profiles.</span></div></>;
  const { isMain } = await outreachScope(user.id);
  const pid = (await searchParams).prospect ?? "";
  const pr = /^[0-9a-f-]{36}$/.test(pid) ? await db.query.prospects.findFirst({ where: eq(prospects.id, pid) }) : null;
  const [first, ...rest] = (pr?.name ?? "").trim().split(/\s+/);
  const [cats, cityList] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.state), asc(cities.name)),
  ]);
  const draft = pr ? await db.query.prospectDrafts.findFirst({ where: and(eq(prospectDrafts.prospectId, pr.id), eq(prospectDrafts.status, "approved")) }) : null;
  const rows = await db.select({ p: professionalProfiles, u: users }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(
      isMain ? isNotNull(professionalProfiles.builtBy) : and(isNotNull(professionalProfiles.builtBy), eq(professionalProfiles.builtBy, user.id)),
      sql`not exists (select 1 from partner_pages pp where pp.user_id = ${professionalProfiles.userId} and pp.added_by is not null)`, // partners live on Admin → Partner pages
    ))
    .orderBy(desc(professionalProfiles.builtAt)).limit(200);
  const ids = [...new Set(rows.map((r) => r.p.builtBy!).filter(Boolean))];
  const builders = new Map(ids.length ? (await db.select({ id: users.id, first: users.firstName }).from(users).where(inArray(users.id, ids))).map((b) => [b.id, b.first]) : []);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Build a profile" />
      <OutreachNav at="build" />
      <div className="card small" style={{ maxWidth: 720, gap: 6 }}>
        <span className="b">For professionals who said yes to you setting them up.</span>
        <span>Fill in what you have — screenshots, their photo and logo are optional. Category and city come from the screenshots when you add them. Then finish their profile on the same setup pages they&apos;d use. When it&apos;s ready, send their claim link: they create a password (8+ characters), accept the Professional Terms, and their profile goes live. They verify their own ID and set up their own payouts.</span>
      </div>
      {draft && <BuildScreenshots draft={draft} />}
      <div className="card" style={{ maxWidth: 720 }}>
        <span className="eyebrow">New profile{pr ? ` — from prospect ${pr.name}` : ""}</span>
        <BuildProfileForm categories={cats} cities={cityList} initial={{
          firstName: first ?? "", lastName: rest.join(" "), email: pr?.email ?? "", phone: pr?.phone ?? "", businessName: pr?.business ?? "",
          categoryId: pr?.categoryId ?? null, cityId: pr?.cityId ?? null, prospectId: pr?.id ?? null,
        }} />
      </div>
      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">{isMain ? "Built profiles (everyone)" : "Profiles I built"}</span>
        {rows.length === 0 && <span className="small muted">None yet.</span>}
        {rows.map(({ p, u }) => {
          const s = buildStatus(p);
          return (
            <Link key={u.id} href={`/admin/outreach/build/${u.id}`} className="row between small" style={{ textDecoration: "none", color: "inherit", gap: 8, flexWrap: "wrap" }}>
              <span><span className="b">{[u.firstName, u.lastName].filter(Boolean).join(" ")}</span>{p.businessName ? ` • ${p.businessName}` : ""} <span className="xs muted">{u.email}{isMain ? ` • built by ${builders.get(p.builtBy!) ?? "—"}` : ""}</span></span>
              <span className="row" style={{ gap: 6 }}>{p.entryPaidAt && p.entryType === "FIRST_IN" && <span className="tag ok">First In</span>}<span className={`tag ${s.tone}`}>{s.label}</span></span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
