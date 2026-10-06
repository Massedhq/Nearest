import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, cities, bookings, reviews, favorites, appeals } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { PRO_STATUS_LABEL } from "@/components/CredentialCard";
import { ActionForm } from "@/components/ActionForm";
import { remindProSetup } from "@/app/admin/reminder-actions";
import { requireAdmin } from "@/lib/admin";
import { setupSteps } from "@/lib/pro";
import { isOwnerBusiness, ENTRY, type EntryType } from "@/lib/entry";
import { proStanding } from "@/lib/enforcement";
import { fmtDate, money } from "@/lib/time";
import { instagramHandle, tiktokHandle, instagramUrl, tiktokUrl } from "@/lib/social";
import { proLink } from "@/lib/connections";
import { proBlockers } from "@/lib/live-check";

export const metadata = { title: "Review account" };
export const dynamic = "force-dynamic";

const age = (dob: string | null) => {
  if (!dob) return null;
  const d = new Date(`${dob}T12:00:00Z`), n = new Date();
  let a = n.getUTCFullYear() - d.getUTCFullYear();
  if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--;
  return a;
};
const Row = ({ k, v }: { k: string; v: React.ReactNode }) => <div className="row between small" style={{ gap: 12 }}><span className="muted">{k}</span><span style={{ textAlign: "right" }}>{v}</span></div>;
const Tag = ({ ok, children }: { ok: boolean | null; children: React.ReactNode }) => <span className={`tag ${ok === true ? "ok" : ok === false ? "warn" : ""}`}>{children}</span>;

/** Everything about one professional, in one place — opened from Professionals → Review account. */
export default async function ReviewPro({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ u: users, p: professionalProfiles, city: cities.name }).from(professionalProfiles)
    .innerJoin(users, eq(users.id, professionalProfiles.userId)).leftJoin(cities, eq(cities.id, professionalProfiles.cityId))
    .where(eq(professionalProfiles.userId, id)).limit(1);
  if (!row) notFound();
  const { u, p } = row;
  const [steps, services, recent, [stats], [rating], [favs], standing, openAppeals] = await Promise.all([
    setupSteps(id),
    db.select().from(proServices).where(eq(proServices.userId, id)),
    db.select().from(bookings).where(eq(bookings.proId, id)).orderBy(desc(bookings.startsAt)).limit(8),
    db.select({ total: sql<number>`count(*)::int`, done: sql<number>`count(*) filter (where ${bookings.status} = 'completed')::int`, proCancel: sql<number>`count(*) filter (where ${bookings.status} = 'cancelled_pro')::int` }).from(bookings).where(eq(bookings.proId, id)),
    db.select({ avg: sql<number | null>`avg(${reviews.rating})::float`, n: sql<number>`count(*)::int` }).from(reviews).where(eq(reviews.proId, id)),
    db.select({ n: sql<number>`count(*)::int` }).from(favorites).where(eq(favorites.proId, id)),
    proStanding(id),
    db.select().from(appeals).where(and(eq(appeals.userId, id), eq(appeals.status, "under_review"))),
  ]);
  const owner = await isOwnerBusiness(id);
  const subActive = ["active", "trialing"].includes(p.subscriptionStatus ?? "");
  // What's stopping them from being bookable right now — same checks as student search
  const blockers = await proBlockers(p);
  const ig = instagramHandle(p.instagram), tt = tiktokHandle(p.tiktok);

  const { membershipState, MEMBERSHIP_LABEL, profileState } = await import("@/lib/membership");
  const { isOwnerBusiness: ownerBiz } = await import("@/lib/entry");
  const mstate = membershipState(p, await ownerBiz(p.userId));
  const { bookings: bk } = await import("@/db");
  const { and: both, eq: is, sql: q } = await import("drizzle-orm");
  const [{ n: pendingRequests }] = await db.select({ n: q<number>`count(*)::int` }).from(bk).where(both(is(bk.proId, p.userId), is(bk.status, "requested")));
  return (
    <>
      <AdminHead eyebrow="Professionals • Review account" title={p.businessName ?? `${u.firstName ?? ""} ${u.lastName ?? ""}`} />
      <Link className="link small" href={`/admin/professionals?sel=${id}`}>← Back to Professionals</Link>

      <div className="card" style={{ gap: 6 }}>
        <span className="eyebrow">Membership &amp; terms</span>
        <div className="row between small"><span className="muted">Profile</span><span>{profileState(p)}</span></div>
        <div className="row between small"><span className="muted">Membership</span><span className={`tag ${mstate === "active" ? "ok" : mstate === "payment_issue" ? "bad" : ""}`}>{MEMBERSHIP_LABEL[mstate]}</span></div>
        <div className="row between small"><span className="muted">Rate</span><span>{p.entryType ?? "—"}{p.monthlyRateCents ? ` • $${(p.monthlyRateCents / 100).toFixed(0)}/mo` : ""}{p.cohort === "FOUNDING" ? " • First In pricing" : ""}</span></div>
        <div className="row between small"><span className="muted">Membership activated</span><span>{p.membershipActivatedAt ? p.membershipActivatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "—"}</span></div>
        <div className="row between small"><span className="muted">Professional Terms</span><span>{p.proTermsAcceptedAt ? `Accepted • v${p.proTermsVersion} • ${p.proTermsAcceptedAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}` : "Not accepted yet"}</span></div>
        <div className="row between small"><span className="muted">Pending booking requests</span><span className="b">{pendingRequests}</span></div>
        <div className="row between small"><span className="muted">First booking request</span><span>{p.firstRequestAt ? p.firstRequestAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "—"}</span></div>
      </div>

      <div className={`card ${blockers.length ? "warn" : "ok"}`} style={{ gap: 8 }}>
        <span className="eyebrow">{blockers.length ? "Not live for students yet" : "Live — students can find and book them"}</span>
        {blockers.length ? blockers.map((b) => <span key={b} className="small">• {b}</span>) : <span className="small">Everything is complete.</span>}
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {(p.reviewStatus === "submitted" || p.identityStatus === "pending") && <Link className="btn sm" href="/admin/verification">Open Verification Queue</Link>}
          {(standing.fines.length > 0 || standing.incidents > 0 || standing.suspendedUntil) && <Link className="btn ghost sm" href="/admin/enforcement">Open Enforcement</Link>}
          {openAppeals.length > 0 && <Link className="btn ghost sm" href="/admin/appeals">Open Appeals ({openAppeals.length})</Link>}
          {p.reviewStatus === "approved" && <Link className="btn ghost sm" href={proLink(p.slug ?? id)} target="_blank">View public profile ↗</Link>}
        </div>
        {p.entryPaidAt && (p.reviewStatus === "draft" || p.reviewStatus === "rejected") && (
          <ActionForm action={remindProSetup} submitLabel="Send setup reminder" buttonClass="btn ghost sm" className="col g4">
            <input type="hidden" name="userId" value={id} />
            <span className="xs muted">{p.setupRemindedAt ? `Last reminded ${p.setupRemindedAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}.` : "Not reminded yet."} Sends an email and a notification with how many steps they have left.</span>
          </ActionForm>
        )}
      </div>

      <div className="acols even">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Account</span>
          <div className="row" style={{ gap: 12 }}>
            {p.photoUrl ? <Image src={p.photoUrl} alt="" width={56} height={56} style={{ borderRadius: 28, objectFit: "cover" }} /> : <div className="avatar">{(p.businessName ?? "N").slice(0, 2).toUpperCase()}</div>}
            <div className="col g4"><span className="b">{u.firstName} {u.lastName}</span><span className="xs muted">{u.email ?? "no email"}{u.phone ? ` • ${u.phone}` : ""}</span></div>
          </div>
          <Row k="Age" v={age(u.dateOfBirth) ?? "—"} />
          <Row k="City" v={row.city ?? "—"} />
          <Row k="Joined Nearest" v={fmtDate(u.createdAt)} />
          <Row k="Account status" v={u.status} />
          <Row k="Booking link" v={p.slug ? `usenearest.com/pro-${p.slug}` : "—"} />
          <Row k="Instagram" v={ig ? <a className="link small" href={instagramUrl(ig)} target="_blank" rel="noopener noreferrer">@{ig} ↗</a> : "—"} />
          <Row k="TikTok" v={tt ? <a className="link small" href={tiktokUrl(tt)} target="_blank" rel="noopener noreferrer">@{tt} ↗</a> : "—"} />
        </div>

        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Money & checks</span>
          <Row k="Entry" v={owner ? "Owner business — free" : p.entryType && p.entryType in ENTRY ? `${ENTRY[p.entryType as EntryType].label} • ${money(p.monthlyRateCents ?? 0)}/mo` : "Not paid"} />
          <Row k="Paid entry on" v={p.entryPaidAt ? fmtDate(p.entryPaidAt) : "—"} />
          <Row k="Membership" v={<Tag ok={subActive && !p.membershipPausedAt}>{p.membershipPausedAt ? "Paused" : p.membershipEndsAt ? `Ends ${fmtDate(p.membershipEndsAt, { month: "short", day: "numeric" })}` : p.subscriptionStatus ?? "Not started"}</Tag>} />
          {p.currentPeriodEnd && <Row k="Paid through" v={fmtDate(p.currentPeriodEnd)} />}
          <Row k="ID check" v={<Tag ok={p.identityStatus === "verified"}>{p.identityStatus}</Tag>} />
          <Row k="Payouts" v={<Tag ok={p.payoutsEnabled}>{p.payoutsEnabled ? "Ready" : "Not set up"}</Tag>} />
          <Row k="Profile review" v={<Tag ok={p.reviewStatus === "approved"}>{p.reviewStatus}</Tag>} />
          <Row k="Outstanding fines" v={standing.fines.length ? `${standing.fines.length} (${money(standing.fines.reduce((a, f) => a + f.amountCents, 0))})` : "None"} />
          <Row k="Confirmed incidents" v={`${standing.incidents} of ${standing.limit}`} />
        </div>
      </div>

      <div className="acols even">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Setup</span>
          {steps.map((s) => <Row key={s.key} k={s.label} v={<Tag ok={s.done ? true : s.optional ? null : false}>{s.done ? "Done" : s.optional ? "Optional" : "To do"}</Tag>} />)}
          <span className="eyebrow" style={{ marginTop: 8 }}>Services ({services.length})</span>
          {services.length === 0 && <span className="small muted">No services yet.</span>}
          {services.map((s) => <Row key={s.id} k={s.name} v={`${money(s.priceCents)} • ${s.durationMin} min${s.active ? "" : " • hidden"}`} />)}
          <Row k="Professional status (self-reported)" v={p.professionalStatus ? PRO_STATUS_LABEL[p.professionalStatus] ?? p.professionalStatus : "Not chosen yet"} />
        </div>

        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Activity</span>
          <Row k="Bookings" v={`${stats.total} total • ${stats.done} completed`} />
          <Row k="Pro cancellations" v={stats.proCancel} />
          <Row k="Rating" v={rating.n ? `★ ${Number(rating.avg).toFixed(1)} (${rating.n})` : "No reviews yet"} />
          <Row k="Saved by students" v={favs.n} />
          <span className="eyebrow" style={{ marginTop: 8 }}>Recent bookings</span>
          {recent.length === 0 && <span className="small muted">No bookings yet.</span>}
          {recent.map((b) => <Row key={b.id} k={`${b.serviceName} • ${fmtDate(b.startsAt, { month: "short", day: "numeric" })}`} v={`${money(b.priceCents)} • ${b.status.replace(/_/g, " ")}`} />)}
        </div>
      </div>
    </>
  );
}
