import Link from "next/link";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { db, campaignOffers, professionalProfiles, proServices, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { requireAdmin } from "@/lib/admin";
import { CAMPAIGN_KEY, DISCLOSURE_LINE, getCampaign, readinessProblems, fmtWhen } from "@/lib/campaign";
import { personName } from "@/lib/pro-name";
import { money } from "@/lib/time";
import {
  saveCampaignSettings, publishCampaignTerms, saveCampaignGraphic, applySuppliedGraphic, addRewardOffer, updateRewardOffer, confirmRewardFunding,
} from "@/app/admin/campaign-actions";

export const metadata = { title: "Campaign settings" };
export const dynamic = "force-dynamic";

const field = { width: "100%", borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "8px 10px", font: "inherit", lineHeight: 1.5 } as const;
const ct = (d: Date, part: "date" | "time") => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return part === "date" ? `${p.year}-${p.month}-${p.day}` : `${p.hour}:${p.minute}`;
};

/** Owners: capacity, booking-opening date/time, instructions, terms, graphic, reward description and reward arrangements. */
export default async function CampaignSettings({ searchParams }: { searchParams: Promise<{ pro?: string }> }) {
  const { user } = await requireAdmin({ owner: true });
  const c = await getCampaign();
  const problems = await readinessProblems(c);
  const sp = await searchParams;
  const offers = await db.select({ o: campaignOffers, service: proServices.name, first: users.firstName, last: users.lastName, display: professionalProfiles.displayName, biz: professionalProfiles.businessName })
    .from(campaignOffers).innerJoin(proServices, eq(proServices.id, campaignOffers.serviceId)).innerJoin(users, eq(users.id, campaignOffers.proId))
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, campaignOffers.proId)).where(eq(campaignOffers.campaignKey, CAMPAIGN_KEY)).orderBy(asc(campaignOffers.createdAt));
  const pros = await db.select({ id: users.id, first: users.firstName, last: users.lastName, display: professionalProfiles.displayName, biz: professionalProfiles.businessName })
    .from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
    .where(and(eq(professionalProfiles.reviewStatus, "approved"), isNotNull(professionalProfiles.addressLine))).orderBy(asc(professionalProfiles.businessName)).limit(500);
  const chosen = pros.find((p) => p.id === sp.pro) ?? null;
  const services = chosen ? await db.select().from(proServices).where(and(eq(proServices.userId, chosen.id), eq(proServices.active, true))).orderBy(asc(proServices.sort)) : [];

  return (
    <>
      <AdminHead eyebrow="Launch campaign" title="Settings & rewards" />
      <Link className="link small" href="/admin/campaign">← Campaign dashboard</Link>
      <div className={`card ${problems.length ? "warn" : "ok"}`} style={{ gap: 4 }}>
        <span className="small b">{problems.length ? "The campaign stays in draft until these are done:" : "Ready — you can open the campaign from the dashboard."}</span>
        {problems.map((p) => <span key={p} className="xs">• {p}</span>)}
        <span className="xs muted">Nothing here implies funding or professional commitments exist until you record and confirm them below.</span>
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
          <span className="eyebrow">Student instructions</span>
          <textarea name="instructions" rows={10} defaultValue={c.instructions ?? ""} style={field} />
          <span className="xs muted">Keep the incentive disclosure in the instructions: &ldquo;{DISCLOSURE_LINE}&rdquo;</span>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">What the free service includes (shown before students join)</span>
          <input name="rewardTitle" defaultValue={c.rewardTitle ?? ""} placeholder="e.g. One free service from a participating professional" maxLength={120} style={field} />
          <textarea name="rewardIncludes" rows={4} defaultValue={c.rewardIncludes ?? ""} placeholder="Exactly what's covered — which services, from which professionals, any limits. Don't promise any service or professional that isn't arranged below." style={field} />
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

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Reward arrangements</span>
        <span className="xs muted">Add a professional only after they&apos;ve agreed to provide the service for the campaign. Students pay $0 (no deposit, service fee or travel fee; at the professional&apos;s location). Nearest pays the payout below when the appointment is completed.</span>
        {offers.map(({ o, service, first, last, display, biz }) => (
          <div key={o.id} className="row small" style={{ gap: 8, flexWrap: "wrap", borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
            <span className="grow"><span className="b">{service}</span> — {personName(display, first, last)}{biz ? ` (${biz})` : ""} • pays {money(o.payoutCents)} • {o.slotsUsed}/{o.slotsTotal} used • {o.active ? "Active" : "Off"}<br /><span className="xs muted">Agreement: {o.agreementNote}{o.confirmedAt ? ` • recorded ${fmtWhen(o.confirmedAt)}` : ""}</span></span>
            <form action={updateRewardOffer} className="row" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={o.id} />
              <input name="slots" type="number" min={o.slotsUsed} defaultValue={o.slotsTotal} style={{ ...field, width: 80 }} aria-label="Appointments" />
              <button className="btn ghost sm" type="submit">Save</button>
            </form>
            <form action={updateRewardOffer}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="toggle" value="1" /><button className="link xs" type="submit">{o.active ? "Turn off" : "Turn on"}</button></form>
          </div>
        ))}
        <form className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <select name="pro" defaultValue={chosen?.id ?? ""} style={{ ...field, width: "auto", flex: "1 1 220px" }} aria-label="Professional">
            <option value="">Choose a professional…</option>
            {pros.map((p) => <option key={p.id} value={p.id}>{personName(p.display, p.first, p.last)}{p.biz ? ` — ${p.biz}` : ""}</option>)}
          </select>
          <button className="btn ghost sm" type="submit">Show services</button>
        </form>
        {chosen && (
          <ActionForm action={addRewardOffer} submitLabel="Add arrangement" buttonClass="btn sm" className="col g8">
            <input type="hidden" name="proId" value={chosen.id} />
            <select name="serviceId" required style={field} aria-label="Service">{services.map((s2) => <option key={s2.id} value={s2.id}>{s2.name} — {s2.durationMin} min (normally {money(s2.priceCents)})</option>)}</select>
            <div className="grid2" style={{ gap: 8 }}>
              <label className="xs muted">Nearest pays the pro per appointment ($)<input name="payout" inputMode="decimal" required style={field} /></label>
              <label className="xs muted">Reward appointments agreed<input name="slots" type="number" min={1} required style={field} /></label>
            </div>
            <input name="note" placeholder="How/when they agreed (e.g. signed agreement Oct 12)" required maxLength={1000} style={field} aria-label="Agreement note" />
            <label className="check xs"><input type="checkbox" name="agreed" /><span>This professional has agreed to provide this service to approved campaign participants for the payout above.</span></label>
          </ActionForm>
        )}
      </div>

      <ActionForm action={confirmRewardFunding} submitLabel="Confirm reward arrangements">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Confirm funding {c.rewardConfirmedAt ? `— confirmed ${fmtWhen(c.rewardConfirmedAt)}` : ""}</span>
          <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="confirm" /><span>I confirm Nearest has arranged the reward appointments listed above and will fund the payouts. The campaign can&apos;t open without this.</span></label>
        </div>
      </ActionForm>
    </>
  );
}
