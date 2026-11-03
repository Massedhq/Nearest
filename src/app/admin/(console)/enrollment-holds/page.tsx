import Link from "next/link";
import { desc, inArray, sql } from "drizzle-orm";
import { db, enrollmentHolds, enrollmentHoldAttempts } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/time";
import { ACTION_LABEL, CLOSED_MESSAGE, KIND_LABEL, holdDays, unfinishedAccounts } from "@/lib/enrollment-holds";
import { releaseEnrollmentHold, reholdEnrollment, runEnrollmentHoldsNow, holdAccountNowAction } from "@/app/admin/enrollment-hold-actions";

export const metadata = { title: "Enrollment holds" };
export const dynamic = "force-dynamic";

const when = (d: Date | null) => (d ? fmtDate(d, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

/**
 * Professionals who never finished registering (or never used their invitation / link) within the limit. Nothing is
 * deleted — they see the enrollment-closed message until an owner releases them here. Every attempt to come back is listed.
 */
export default async function EnrollmentHolds({ searchParams }: { searchParams: Promise<{ show?: string; kind?: string; q?: string }> }) {
  const { role } = await requireAdmin();
  const owner = role === "OWNER";
  const sp = await searchParams;
  const show = sp.show === "released" ? "released" : sp.show === "trying" ? "trying" : sp.show === "unfinished" ? "unfinished" : "held";
  const days = await holdDays();
  const q = (sp.q ?? "").trim().toLowerCase();
  const unfinished = show === "unfinished" ? await unfinishedAccounts(q || undefined) : [];
  const rows = show === "unfinished" ? [] : await db.select().from(enrollmentHolds)
    .where(sql`${enrollmentHolds.status} = ${show === "released" ? "released" : "held"}
      ${show === "trying" ? sql`and ${enrollmentHolds.attempts} > 0` : sql``}
      ${sp.kind && KIND_LABEL[sp.kind] ? sql`and ${enrollmentHolds.kind} = ${sp.kind}` : sql``}
      ${q ? sql`and (lower(coalesce(${enrollmentHolds.name}, '')) like ${"%" + q + "%"} or coalesce(${enrollmentHolds.email}, '') like ${"%" + q + "%"})` : sql``}`)
    .orderBy(desc(sql`coalesce(${enrollmentHolds.lastAttemptAt}, ${enrollmentHolds.heldAt})`)).limit(300);
  const attempts = rows.length ? await db.select().from(enrollmentHoldAttempts).where(inArray(enrollmentHoldAttempts.holdId, rows.map((r) => r.id))).orderBy(desc(enrollmentHoldAttempts.at)) : [];
  const [counts] = await db.select({
    held: sql<number>`count(*) filter (where status = 'held')::int`,
    trying: sql<number>`count(*) filter (where status = 'held' and attempts > 0)::int`,
    released: sql<number>`count(*) filter (where status = 'released')::int`,
  }).from(enrollmentHolds);
  const tab = (k: string, label: string) => <Link className={`chip${show === k ? " on" : ""}`} href={`/admin/enrollment-holds?show=${k}${sp.kind ? `&kind=${sp.kind}` : ""}`}>{label}</Link>;

  return (
    <>
      <AdminHead eyebrow="People" title="Enrollment holds" />
      <span className="small muted">
        Professionals who didn&apos;t accept the Professional Terms, send their ID or submit their profile within {days} days — plus invitations and
        registration links never used in {days} days. Nothing is deleted. They see: &ldquo;{CLOSED_MESSAGE}&rdquo; Anyone who accepted the Terms or sent
        their ID is never put on hold. Release someone to let them finish; they get another {days} days.
      </span>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {tab("held", `On hold (${counts.held})`)}
        {tab("trying", `Trying to get back in (${counts.trying})`)}
        {tab("released", `Released (${counts.released})`)}
        {tab("unfinished", "Never finished — not on hold yet")}
      </div>
      <form className="row" method="get" style={{ gap: 8, flexWrap: "wrap" }}>
        <input type="hidden" name="show" value={show} />
        <select name="kind" defaultValue={sp.kind ?? ""} className="ainput"><option value="">All types</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Name or email" className="ainput" />
        <button className="btn ghost sm" type="submit" style={{ width: "auto" }}>Filter</button>
      </form>
      {owner && (
        <ActionForm action={runEnrollmentHoldsNow} submitLabel="Run the check now" buttonClass="btn ghost sm" className="col g4">
          <span className="xs muted">The check also runs automatically every night.</span>
        </ActionForm>
      )}
      {show === "unfinished" && (
        <>
          <span className="small muted">Every professional account that never accepted the Professional Terms, never sent an ID and never submitted — at any age, including ones newer than {days} days that the nightly check hasn&apos;t reached yet. Tap Move to hold to close registration for them now.</span>
          {unfinished.length === 0 && <div className="card"><span className="small muted">Everyone who hasn&apos;t finished is already on hold.</span></div>}
          {unfinished.map((a) => (
            <div key={a.id} className="card" style={{ gap: 6 }}>
              <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="b">{[a.first, a.last].filter(Boolean).join(" ") || "No name"}{a.email ? <span className="muted small"> • {a.email}</span> : null}</span>
                <span className="tag">{Math.max(0, Math.floor((Date.now() - new Date(a.created).getTime()) / 86400000))} days since sign-up</span>
              </div>
              <span className="xs muted">{a.business ? `${a.business} • ` : ""}{a.built ? `Profile built by Nearest${a.sent ? ` • link sent ${fmtDate(new Date(a.sent), { month: "short", day: "numeric", year: "numeric" })}` : " • link never sent"}` : `Signed up ${fmtDate(new Date(a.created), { month: "short", day: "numeric", year: "numeric" })}`}</span>
              <Link className="link xs" href={`/admin/professionals/${a.id}`}>Open their account</Link>
              {owner && (
                <ActionForm action={holdAccountNowAction} submitLabel="Move to hold" buttonClass="btn sm" className="col g4">
                  <input type="hidden" name="userId" value={a.id} />
                </ActionForm>
              )}
            </div>
          ))}
        </>
      )}
      {show !== "unfinished" && rows.length === 0 && <div className="card"><span className="small muted">{show === "released" ? "No one has been released yet." : "No one is on hold."}</span></div>}
      {rows.map((h) => {
        const mine = attempts.filter((a) => a.holdId === h.id);
        return (
          <div key={h.id} id={`h-${h.id}`} className="card" style={{ gap: 8 }}>
            <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="b">{h.name || "No name"}{h.email ? <span className="muted small"> • {h.email}</span> : null}</span>
              <span className={`tag ${h.attempts ? "warn" : ""}`}>{h.attempts ? `${h.attempts} attempt${h.attempts === 1 ? "" : "s"} to get back in` : "No attempts yet"}</span>
            </div>
            <span className="small"><span className="muted">{KIND_LABEL[h.kind] ?? h.kind}:</span> {h.reason}</span>
            <span className="xs muted">On hold since {when(h.heldAt)}{h.lastAttemptAt ? ` • last attempt ${when(h.lastAttemptAt)}` : ""}{h.status === "released" ? ` • released ${when(h.releasedAt)}${h.releaseNote ? ` — “${h.releaseNote}”` : ""}` : ""}</span>
            {h.userId && <Link className="link xs" href={`/admin/professionals/${h.userId}`}>Open their account (all their information is still there)</Link>}
            {mine.length > 0 && (
              <details>
                <summary className="link xs">Attempts ({mine.length})</summary>
                <div className="col" style={{ gap: 4, marginTop: 6 }}>
                  {mine.map((a) => <span key={a.id} className="xs">{when(a.at)} — {ACTION_LABEL[a.action] ?? a.action}{a.detail ? ` (${a.detail})` : ""}</span>)}
                </div>
              </details>
            )}
            {owner && h.status === "held" && (
              <ActionForm action={releaseEnrollmentHold} submitLabel="Allow them to finish registering" buttonClass="btn sm" className="col g4">
                <input type="hidden" name="id" value={h.id} />
                <input name="note" className="ainput" placeholder="Note (optional — for your records)" maxLength={500} />
                <span className="xs muted">They&apos;ll get an email{h.userId ? " and a notification" : ""} saying enrollment is open for them{h.kind === "invitation" ? ", and their invitation link works again" : ""}.</span>
              </ActionForm>
            )}
            {owner && h.status === "released" && (
              <ActionForm action={reholdEnrollment} submitLabel="Put back on hold" buttonClass="btn ghost sm" className="col g4">
                <input type="hidden" name="id" value={h.id} />
              </ActionForm>
            )}
          </div>
        );
      })}
    </>
  );
}

