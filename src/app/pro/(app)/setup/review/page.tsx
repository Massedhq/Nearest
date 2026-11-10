import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, proServices, portfolioItems, cities, favorites } from "@/db";
import { requirePro, setupSteps, setupComplete } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { ProCard } from "@/components/ProCard";
import { Icon } from "@/components/Icon";
import { submitForReview } from "@/app/pro/actions";
import { ProTermsAgreement } from "@/components/ProTermsAgreement";
import { proTermsSections, PRO_TERMS_VERSION } from "@/lib/pro-terms";
import { enrollmentQuote } from "@/lib/enroll";
import { ProProtectionFields } from "@/components/ProProtectionFields";
import { ProCampaignFields } from "@/components/ProCampaignFields";
import { rewardEligibleServices } from "@/lib/campaign-pro";

export const metadata = { title: "Review & submit" };

export default async function ReviewStep() {
  const { user, profile: p, viewer, building } = await requirePro();
  const [steps, services, photos, city] = await Promise.all([
    setupSteps(user.id),
    db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
    db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.kind, "image"))).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(3),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
  ]);
  const ready = setupComplete(steps);
  // First submit: the Professional Terms (membership at the end) are accepted here. Owners never enroll.
  const needsTerms = !p.entryPaidAt && viewer.admin?.role !== "OWNER";
  const quote = needsTerms && ready ? await enrollmentQuote(p) : null;
  const [{ n: favCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(favorites).where(eq(favorites.proId, p.userId));
  // Previews (2026-11-09): how they look while people browse, and what opens once someone taps them — per side for partners.
  const { partnerSides } = await import("@/lib/partner-booking");
  const { ensureProSlug } = await import("@/lib/connections");
  const { MAX_PRICE_CENTS } = await import("@/lib/pricing");
  const sides = await partnerSides(user.id);
  const slug = await ensureProSlug(user.id);
  const studentServices = services.filter((s) => s.active && s.showOn !== "partner" && s.priceCents <= MAX_PRICE_CENTS);
  return (
    <div className="scr">
      <TopBar title="Review & submit" back="/pro/home" />
      <div className="body">
        <h1 className="disp h2">This is how customers see you.</h1>
        {!sides.partnerOnly && (
          <>
            <span className="eyebrow">1 · While students browse Nearest</span>
            <span className="xs muted">Your card in Explore and search. Students tap it to open your profile.</span>
            <ProCard p={{ ...p, favCount }} services={studentServices} photos={photos.map((x) => x.url)} city={city?.name ?? null} first={user.firstName} last={user.lastName} />
            <span className="eyebrow">2 · Once they tap your card</span>
            <div className="card" style={{ gap: 8 }}>
              <span className="small">Your full profile: photo, reviews, portfolio (tap a photo to book that look), services with Book buttons, hours and about.</span>
              {slug ? <Link className="btn ghost sm" href={`/pro-${slug}`} target="_blank">Open my full profile</Link> : <span className="xs muted">Save your business name to get your profile link.</span>}
            </div>
          </>
        )}
        {sides.partner && slug && (
          <>
            <span className="eyebrow">{sides.partnerOnly ? "1" : "3"} · Your partner page (anyone can book)</span>
            <div className="card" style={{ gap: 8 }}>
              <span className="small">What people see from your link in bio, then the booking profile that opens when they tap Book an appointment.</span>
              <div className="grid2" style={{ gap: 8 }}>
                <Link className="btn ghost sm" href={`/link/${slug}`} target="_blank">Open my link page</Link>
                <Link className="btn ghost sm" href={`/link/${slug}/book`} target="_blank">Open my booking profile</Link>
              </div>
            </div>
          </>
        )}
        <div className="card">
          <span className="eyebrow">Ready to go live</span>
          {steps.map((s) => (
            <Link key={s.key} href={s.href} className="row small" style={{ textDecoration: "none" }}>
              <Icon name={s.done ? "check" : "clock"} size="s" />
              <span className="grow">{s.label}</span>
              <span className={`tag ${s.done ? "ok" : s.optional ? "" : "warn"}`}>{s.done ? "Done" : s.optional ? "Optional" : "To do"}</span>
            </Link>
          ))}
          <Link href="/pro/payments" className="row small" style={{ textDecoration: "none" }}><Icon name="shield" size="s" /><span className="grow">Identity verification</span><span className={`tag ${p.identityStatus === "verified" ? "ok" : "warn"}`}>{p.identityStatus === "verified" ? "Done" : p.identityStatus === "pending" ? "Checking" : "To do"}</span></Link>
          <Link href="/pro/payments" className="row small" style={{ textDecoration: "none" }}><Icon name="card" size="s" /><span className="grow">Payouts</span><span className={`tag ${p.payoutsEnabled ? "ok" : "warn"}`}>{p.payoutsEnabled ? "Done" : "To do"}</span></Link>
        </div>
        {p.reviewStatus === "submitted" && <div className="card ok small"><span className="b">Submitted — Nearest is reviewing your profile.</span><span className="muted">We&apos;ll let you know when you&apos;re approved.</span></div>}
        {p.reviewStatus === "approved" && <div className="card ok small"><span className="b">You&apos;re approved.</span></div>}
        {p.reviewStatus === "rejected" && <div className="card bad small"><span className="b">Changes needed</span><span>{p.reviewNote}</span></div>}
        {building && (
          <div className="card warn small" style={{ gap: 6 }}>
            <span className="b">You&apos;re building this profile for them.</span>
            <span>They accept the Professional Terms, verify their ID and set up payouts themselves after they open their claim link. When the steps above are done (ID is theirs), go back to admin and send the link.</span>
          </div>
        )}
        {!building && (p.reviewStatus === "draft" || p.reviewStatus === "rejected") && (
          !ready ? (
            <div className="card warn small"><span>Finish the steps marked &ldquo;To do&rdquo; above, then come back here to submit your profile.</span></div>
          ) : needsTerms && quote && !quote.ok ? (
            <div className="card warn small" style={{ gap: 6 }}><span>{quote.reason}</span><Link className="btn sm" href="/pro/join" style={{ alignSelf: "flex-start" }}>Join the waitlist</Link></div>
          ) : (
            <ActionForm action={submitForReview} submitLabel="Submit profile">
              {needsTerms && quote?.ok ? (
                <>
                  <ProTermsAgreement sections={proTermsSections({ cents: quote.cents, label: quote.label })} version={PRO_TERMS_VERSION} />
                  <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label>
                  <div className="card" style={{ gap: 8 }}><span className="b small">Your one free service</span><ProCampaignFields services={await rewardEligibleServices(p.userId)} /></div>
                </>
              ) : null}
              {/* Optional: answering never blocks submitting (unanswered pros are asked again on their home screen). */}
              {!p.insuranceChoiceAt && <div className="card" style={{ gap: 8 }}><ProProtectionFields /></div>}
            </ActionForm>
          )
        )}
      </div>
    </div>
  );
}
