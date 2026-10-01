import { redirect } from "next/navigation";
import { asc, and, eq, ne } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { requirePro } from "@/lib/pro";
import { stripeEnabled } from "@/lib/stripe";
import { finalizeEntry, getEntryState, hasPaidEntry, allowedEntries, nextEntryStats } from "@/lib/entry";
import { slotStatus, onWaitlist, isCapExempt } from "@/lib/slots";
import { db, categories } from "@/db";
import { payEntry, saveSlot, clearSlot, joinSlotWaitlist } from "./actions";

export const metadata = { title: "Join Nearest" };
export const dynamic = "force-dynamic";

/**
 * Right after a professional creates their account: choose city + main category (spots are limited per city,
 * per category), pay the entry rate their spot qualifies for, then straight into onboarding.
 */
export default async function Join({ searchParams }: { searchParams: Promise<{ session?: string; waitlist?: string }> }) {
  const { session } = await searchParams;
  if (session && stripeEnabled()) {
    try { await finalizeEntry(session); } catch (e) { console.error("finalizeEntry", e); }
  }
  const { profile, viewer } = await requirePro({ allowUnpaid: true });
  if (viewer.admin?.role === "OWNER") redirect("/pro/home"); // owners never pay
  if (hasPaidEntry(profile)) redirect("/pro/home");

  const state = await getEntryState();
  const [{ allowed, reason, bypass }, slot, exempt, next750] = await Promise.all([allowedEntries(profile), slotStatus(profile), isCapExempt(profile), nextEntryStats()]);
  const waiting = slot ? await onWaitlist(profile.userId, slot.cityId, slot.categoryId) : false;
  const cats = reason === "slot"
    ? await db.select({ id: categories.id, name: categories.name }).from(categories).where(and(eq(categories.active, true), ne(categories.name, "Other"))).orderBy(asc(categories.sort), asc(categories.name))
    : [];

  return (
    <div className="scr">
      <TopBar title="Join Nearest" />
      <div className="body">
        {!stripeEnabled() && <div className="card warn small"><span>Payments aren&apos;t set up yet.</span></div>}

        {state === "FIRST_IN_CLOSED" && (
          <>
            <h1 className="disp h1">Enrollment is paused.</h1>
            <div className="card small"><span>First In is full. New professional enrollment opens again soon — we&apos;ll be ready for you.</span></div>
          </>
        )}

        {/* Step 1 — where they work and what they do */}
        {reason === "slot" && (
          <>
            <h1 className="disp h1">Where do you work?</h1>
            <p className="small muted p">Nearest limits how many professionals offer the same service in each city, so you&apos;re never one of fifty. Tell us your ZIP code and main service to see if there&apos;s a spot for you.</p>
            <ActionForm action={saveSlot} submitLabel="Check my spot">
              <div className="field"><label htmlFor="slot-zip">ZIP code where you work</label><input id="slot-zip" name="zip" inputMode="numeric" maxLength={5} pattern="\d{5}" required placeholder="e.g. 75034" /></div>
              <div className="field"><label htmlFor="slot-cat">Your main category</label>
                <select id="slot-cat" name="categoryId" required defaultValue="">
                  <option value="" disabled>Choose a category</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </ActionForm>
          </>
        )}

        {/* Their spot */}
        {slot && !exempt && state !== "FIRST_IN_CLOSED" && (
          <div className={`card ${slot.tier === "full" ? "warn" : "ok"}`} style={{ gap: 6 }}>
            <span className="eyebrow">{slot.category} in {slot.city}</span>
            {slot.tier === "first_in" && allowed.includes("FIRST_IN") && <span className="small"><span className="b">First In spot #{slot.spotNumber} of {slot.firstIn}</span> is open for you.</span>}
            {slot.tier === "first_in" && !allowed.includes("FIRST_IN") && <span className="small">First In is closed. <span className="b">Spot #{slot.spotNumber} of {slot.cap}</span> is open for you.</span>}
            {slot.tier === "next" && <span className="small">The {slot.firstIn} First In spots here are taken. <span className="b">Spot #{slot.spotNumber} of {slot.cap}</span> is open for you.</span>}
            {slot.tier === "full" && <span className="small"><span className="b">All {slot.cap} spots are taken right now.</span></span>}
            {slot.tier === "full"
              ? <span className="xs muted">Entered the wrong ZIP code or category? Email support@usenearest.com and we&apos;ll fix it.</span>
              : <form action={clearSlot}><button className="link xs" type="submit">Change city or category</button></form>}
          </div>
        )}

        {/* Full: waitlist (and, while the next 750 has room, the option to skip it below) */}
        {(reason === "full" || reason === "next_full") && slot && (
          waiting ? (
            <div className="card small" style={{ gap: 6 }}>
              <span className="b">You&apos;re on the waitlist.</span>
              <span className="muted">We&apos;ll email you as soon as a {slot.category.toLowerCase()} spot opens in {slot.city}. Nothing is charged until you join.</span>
            </div>
          ) : (
            <form action={joinSlotWaitlist} className="col" style={{ gap: 8 }}>
              <button className={bypass ? "btn ghost" : "btn"} type="submit">Join the waitlist — free</button>
              <span className="xs muted p">No charge. We&apos;ll invite you when a spot opens.</span>
            </form>
          )
        )}
        {reason === "next_full" && <div className="card small"><span>The next {next750.capacity} spots are taken right now, so new spots open from the waitlist.</span></div>}

        {allowed.includes("FIRST_IN") && (
          <>
            <span className="tag warn" style={{ alignSelf: "flex-start" }}>First In</span>
            <h1 className="disp h1">Join Nearest First In.</h1>
            <div className="card pearl">
              <span className="disp h2">$11/month</span>
              <span className="small">For your first 12 months.</span>
              <span className="xs muted">Your First In rate is locked to your account.</span>
            </div>
            <ActionForm action={payEntry} submitLabel="Pay $11 and continue"><input type="hidden" name="type" value="FIRST_IN" /><label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label></ActionForm>
            <p className="xs muted p">$11 is charged today, then $11 each month for your first 12 months. No commission on bookings.</p>
          </>
        )}

        {allowed.includes("GENERAL") && (
          <>
            {bypass
              ? <>
                  <span className="tag warn" style={{ alignSelf: "flex-start" }}>Or skip the waitlist</span>
                  <h1 className="disp h1">Join the next {next750.capacity} now.</h1>
                  <p className="small muted p">Pay today, finish setting up your profile, and go live in {slot?.city} right away.</p>
                </>
              : <h1 className="disp h1">Choose your entry.</h1>}
            <div className="card" style={{ gap: 6 }}>
              <div className="row between"><span className="small b">The next {next750.capacity}</span><span className="small b">{next750.left.toLocaleString()} of {next750.capacity.toLocaleString()} left</span></div>
              <div className="bar"><i style={{ width: `${next750.capacity ? Math.round((next750.registered / next750.capacity) * 100) : 0}%` }} /></div>
            </div>
            <div className="acols even">
              <div className="card" style={{ gap: 12 }}>
                <span className="eyebrow">Professional + Student</span>
                <span className="disp h2">$16/month</span>
                <span className="small">For your first 12 months. Register one student to join with you.</span>
                <ActionForm action={payEntry} submitLabel="Pay $16 and continue">
                  <input type="hidden" name="type" value="PRO_STUDENT" /><label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label>
                  <div className="grid2">
                    <div className="field"><label htmlFor="sf">Student first name</label><input id="sf" name="studentFirst" required /></div>
                    <div className="field"><label htmlFor="sl">Student last name</label><input id="sl" name="studentLast" required /></div>
                  </div>
                  <div className="field"><label htmlFor="se">Student email</label><input id="se" name="studentEmail" type="email" required /></div>
                  <div className="field"><label htmlFor="ss">Student&apos;s school (optional)</label><input id="ss" name="studentSchool" /></div>
                </ActionForm>
              </div>
              <div className="card" style={{ gap: 12 }}>
                <span className="eyebrow">General Entry</span>
                <span className="disp h2">$21/month</span>
                <span className="small">For your first 12 months. No student registration required.</span>
                <ActionForm action={payEntry} submitLabel="Pay $21 and continue"><input type="hidden" name="type" value="GENERAL" /><label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label></ActionForm>
              </div>
            </div>
            <p className="xs muted p">The first month is charged today. Your rate is locked to your account for your first 12 months. No commission on bookings.</p>
          </>
        )}
      </div>
    </div>
  );
}
