import Link from "next/link";
import { desc, eq, isNotNull, and, inArray } from "drizzle-orm";
import { db, users, professionalProfiles, prospects, prospectDrafts } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";
import { buildStatus } from "@/lib/build-status";
import { createBuiltProfile } from "@/app/admin/build-actions";
import { ScreenshotLeadUpload } from "@/components/ScreenshotLeadUpload";
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
  const draft = pr ? await db.query.prospectDrafts.findFirst({ where: and(eq(prospectDrafts.prospectId, pr.id), eq(prospectDrafts.status, "approved")) }) : null;
  const rows = await db.select({ p: professionalProfiles, u: users }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(isMain ? isNotNull(professionalProfiles.builtBy) : and(isNotNull(professionalProfiles.builtBy), eq(professionalProfiles.builtBy, user.id)))
    .orderBy(desc(professionalProfiles.builtAt)).limit(200);
  const ids = [...new Set(rows.map((r) => r.p.builtBy!).filter(Boolean))];
  const builders = new Map(ids.length ? (await db.select({ id: users.id, first: users.firstName }).from(users).where(inArray(users.id, ids))).map((b) => [b.id, b.first]) : []);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Build a profile" />
      <OutreachNav at="build" />
      <div className="card small" style={{ maxWidth: 720, gap: 6 }}>
        <span className="b">For professionals who said yes to you setting them up.</span>
        <span>Create their account, then fill in their profile on the same setup pages they&apos;d use — services, prices, location, hours, photos. When it&apos;s ready, send their claim link: they create a password (8+ characters), accept the Professional Terms, and their profile goes live. They verify their own ID and set up their own payouts.</span>
      </div>
      {!pr && (
        <div className="card" style={{ maxWidth: 720, gap: 8 }}>
          <span className="eyebrow">Start from screenshots</span>
          <span className="small">Same as Add from screenshots: upload 1–5 screenshots of their profile, link-in-bio, booking page or flyer. The details are read on this device, you check them against the screenshots and approve, and this form opens with their name, email, phone and business filled in. The screenshots stay with their record so you can copy services, prices and hours into their profile.</span>
          <ScreenshotLeadUpload build />
        </div>
      )}
      {draft && <BuildScreenshots draft={draft} />}
      <div className="card" style={{ maxWidth: 720 }}>
        <span className="eyebrow">{pr ? "" : "Or type it in — "}New profile{pr ? ` — from prospect ${pr.name}` : ""}</span>
        <ActionForm action={createBuiltProfile} submitLabel="Create and start building">
          {pr && <input type="hidden" name="prospectId" value={pr.id} />}
          <div className="grid2">
            <div className="field"><label htmlFor="bp-first">Legal first name</label><input id="bp-first" name="firstName" required maxLength={60} defaultValue={first ?? ""} /></div>
            <div className="field"><label htmlFor="bp-last">Legal last name</label><input id="bp-last" name="lastName" required maxLength={60} defaultValue={rest.join(" ")} /></div>
            <div className="field"><label htmlFor="bp-email">Their email (their sign-in)</label><input id="bp-email" name="email" type="email" required maxLength={160} defaultValue={pr?.email ?? ""} /></div>
            <div className="field"><label htmlFor="bp-phone">Their phone (optional)</label><input id="bp-phone" name="phone" maxLength={30} defaultValue={pr?.phone ?? ""} /></div>
            <div className="field"><label htmlFor="bp-bus">Business name (optional)</label><input id="bp-bus" name="businessName" maxLength={80} defaultValue={pr?.business ?? ""} /></div>
          </div>
          <label className="check small" style={{ alignItems: "flex-start" }}><input type="checkbox" name="permission" required /><span>They gave me permission to create their Nearest account and set up their profile for them.</span></label>
        </ActionForm>
      </div>
      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">{isMain ? "Built profiles (everyone)" : "Profiles I built"}</span>
        {rows.length === 0 && <span className="small muted">None yet.</span>}
        {rows.map(({ p, u }) => {
          const s = buildStatus(p);
          return (
            <Link key={u.id} href={`/admin/outreach/build/${u.id}`} className="row between small" style={{ textDecoration: "none", color: "inherit", gap: 8, flexWrap: "wrap" }}>
              <span><span className="b">{[u.firstName, u.lastName].filter(Boolean).join(" ")}</span>{p.businessName ? ` • ${p.businessName}` : ""} <span className="xs muted">{u.email}{isMain ? ` • built by ${builders.get(p.builtBy!) ?? "—"}` : ""}</span></span>
              <span className={`tag ${s.tone}`}>{s.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
