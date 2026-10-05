import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, and, eq, ne } from "drizzle-orm";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { requirePro } from "@/lib/pro";
import { stripeEnabled } from "@/lib/stripe";
import { finalizeEntry, getEntryState, hasPaidEntry, allowedEntries, nextEntryStats } from "@/lib/entry";
import { slotStatus, onWaitlist, isCapExempt } from "@/lib/slots";
import { db, categories } from "@/db";
import { saveSlot, clearSlot, joinSlotWaitlist } from "./actions";

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
  if (hasPaidEntry(profile)) redirect("/pro/home"); // already joined

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
            {slot.tier === "first_in" && allowed.includes("MARKET") && <span className="small"><span className="b">Spot #{slot.spotNumber} of {slot.cap}</span> is open for you.</span>}
            {slot.tier === "first_in" && allowed.includes("DFW_NEXT") && <span className="small">First In is closed. <span className="b">Spot #{slot.spotNumber} of {slot.cap}</span> is open for you.</span>}
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

        {allowed.length > 0 && (
          <div className="card ok" style={{ gap: 8 }}>
            <span className="b">There&apos;s room for you.</span>
            <span className="small">Keep building your profile — services, hours, photos. You&apos;ll review the Professional Terms and submit on the last step. Nothing is charged to join.</span>
            <Link className="btn sm" href="/pro/home" style={{ alignSelf: "flex-start" }}>Continue setting up</Link>
          </div>
        )}
      </div>
    </div>
  );
}
