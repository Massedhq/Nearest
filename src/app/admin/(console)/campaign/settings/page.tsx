import Link from "next/link";
import { asc, eq, isNotNull, sql } from "drizzle-orm";
import { db, campaignOffers, professionalProfiles, proServices, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { requireAdmin } from "@/lib/admin";
import { CAMPAIGN_KEY, DISCLOSURE_LINE, REWARD_DEFAULT_INCLUDES, getCampaign, readinessProblems, fmtWhen } from "@/lib/campaign";
import { personName } from "@/lib/pro-name";
import {
  saveCampaignSettings, publishCampaignTerms, saveCampaignGraphic, applySuppliedGraphic, updateRewardOffer,
} from "@/app/admin/campaign-actions";

export const metadata = { title: "Campaign settings" };
export const dynamic = "force-dynamic";

const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "8px 10px", font: "inherit", lineHeight: 1.5 } as const;
const ct = (d: Date, part: "date" | "time") => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return part === "date" ? `${p.year}-${p.month}-${p.day}` : `${p.hour}:${p.minute}`;
};

/** Owners: capacity, booking-opening date/time, instructions, terms, graphic, optional reward description, and the professionals who chose to give a free service. */
export default async function CampaignSettings() {
  const { user } = await requireAdmin({ owner: true });
  const c = await getCampaign();
  const problems = await readinessProblems(c);
  const offers = await db.select({ o: campaignOffers, service: proServices.name, first: users.firstName, last: users.lastName, display: professionalProfiles.displayName, biz: professionalProfiles.businessName })
    .from(campaignOffers).innerJoin(proServices, eq(proServices.id, campaignOffers.serviceId)).innerJoin(users, eq(users.id, campaignOffers.proId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, campaignOffers.proId)).where(eq(campaignOffers.campaignKey, CAMPAIGN_KEY)).orderBy(asc(campaignOffers.createdAt));
  const choices = await db.select({ choice: professionalProfiles.campaignChoice, n: sql<number>`count(*)::int` }).from(professionalProfiles)
    .where(isNotNull(professionalProfiles.entryPaidAt)).groupBy(professionalProfiles.campaignChoice);
  const choiceCounts = { agreed: 0, declined: 0, waiting: 0 };
  for (const r of choices) { if (r.choice === "agreed") choiceCounts.agreed += r.n; else if (r.choice === "declined") choiceCounts.declined += r.n; else choiceCounts.waiting += r.n; }

  return (
    <>
      <AdminHead eyebrow="Launch campaign" title="Settings & rewards" />
      <Link className="link small" href="/admin/campaign">← Campaign dashboard</Link>
      <div className={`card ${problems.length ? "warn" : "ok"}`} style={{ gap: 4 }}>
        <span className="small b">{problems.length ? "The campaign stays in draft until these are done:" : "Ready — you can open the campaign from the dashboard."}</span>
        {problems.map((p) => <span key={p} className="xs">• {p}</span>)}
      </div>

      <ActionForm action={saveCampaignSettings} submitLabel="Save settings">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Capacity, market &amp; booking opening</span>
          <label className="xs muted">Places (total, all cities) — {c.occupied} taken<input name="capacity" type="number" min={Math.max(1, c.occupied)} defaultValue={c.capacity} style={field} /></label>
          <label className="xs muted">Market (students&apos; school market)<input name="market" defaultValue={c.market} style={field} /></label>
          <div className="grid2" style={{ gap: 8 }}>
            <label className="xs muted">Booking opens (date, Central)<input name="opensDay" type="date" defaultValue={c.bookingOpensAt ? ct(c.bookingOpensAt, "date") : "2026-11-19"} style={field} /></label>
            <label className="xs muted">Time (Central)<input name="opensTime" type="time" defaultValue={c.bookingOpensAt ? ct(c.bookingOpensAt, "time") : "00:00"} style={field} /></label>
          </div>
          <span className="xs muted">Currently {c.bookingOpensAt ? fmtWhen(c.bookingOpensAt) : "not set"}. Rewards can only be booked after this time.</span>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">How to participate (student steps)</span>
          <textarea name="instructions" rows={10} defaultValue={c.instructions ?? ""} style={field} />
          <span className="xs muted">One step per line — shown in the invitation after registration and on the student&apos;s campaign page throughout. Keep the incentive disclosure in the steps: &ldquo;{DISCLOSURE_LINE}&rdquo;</span>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">What the free service includes (optional — shown before students join)</span>
          <input name="rewardTitle" defaultValue={c.rewardTitle ?? ""} placeholder="One free service from a participating professional" maxLength={120} style={field} />
          <textarea name="rewardIncludes" rows={4} defaultValue={c.rewardIncludes ?? ""} placeholder={REWARD_DEFAULT_INCLUDES} style={field} />
          <span className="xs muted">Leave blank to use the standard wording shown in grey.</span>
        </div>
      </ActionForm>

      <div className="card" style={{ gap: 8 }}>
        <span className="eyebrow">Profile picture graphic</span>
        {c.graphicUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.graphicUrl} alt="Current campaign graphic" width={140} height={140} style={{ borderRadius: 70, objectFit: "cover", border: "1px solid #2A2A2D" }} />
        )}
        <span className="xs muted">Shown in a circle preview — the logo and usenearest.com must stay readable inside the circle.</span>
        <form action={applySuppliedGraphic}><button className="btn ghost sm" type="submit">Use the supplied Nearest graphic</button></form>
        <Uploader userId={user.id} folder="campaign-graphic" root="students" save={saveCampaignGraphic} multiple={false} label="Upload a different graphic (PNG/JPG)" />
      </div>

      <ActionForm action={publishCampaignTerms} submitLabel="Publish terms">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Campaign terms {c.termsPublishedAt ? `— version ${c.termsVersion}, published ${fmtWhen(c.termsPublishedAt)}` : "— not published"}</span>
          <textarea name="terms" rows={14} defaultValue={c.terms ?? ""} style={field} />
          <label className="check xs"><input type="checkbox" name="reviewed" /><span>I&apos;ve reviewed these terms (and had them checked as needed) and want to publish them.</span></label>
          <span className="xs muted">Publishing creates a new version. Each participant&apos;s accepted version is stored.</span>
        </div>
      </ActionForm>

      <div className="card" id="pros" style={{ gap: 10 }}>
        <span className="eyebrow">Participating professionals — {offers.filter((x) => x.o.active).length} offering a free service</span>
        <span className="xs muted">Professionals sign up for this themselves: new pros agree on the last setup page, and pros who joined earlier opt in or decline from the card on their home screen. Each one chooses a service listed at $25 or more and how many free appointments they give. Nearest pays nothing — the payout is $0.</span>
        <span className="xs">Agreed: {choiceCounts.agreed} • Declined: {choiceCounts.declined} • Haven&apos;t answered yet: {choiceCounts.waiting}</span>
        {offers.length === 0 && <span className="small">No professional has chosen a free service yet.</span>}
        {offers.map(({ o, service, first, last, display, biz }) => (
          <div key={o.id} className="row small" style={{ gap: 8, flexWrap: "wrap", borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
            <span className="grow"><span className="b">{service}</span> — {personName(display, first, last)}{biz ? ` (${biz})` : ""} • {o.slotsUsed} of {o.slotsTotal} free appointments used • {o.active ? "Active" : "Paused"}<br /><span className="xs muted">{o.confirmedAt ? `Agreed ${fmtWhen(o.confirmedAt)}` : ""}</span></span>
            <form action={updateRewardOffer}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="toggle" value="1" /><button className="link xs" type="submit">{o.active ? "Pause" : "Resume"}</button></form>
          </div>
        ))}
      </div>
    </>
  );
}
