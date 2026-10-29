import Image from "next/image";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, portfolioItems, cities } from "@/db";
import { getViewer } from "@/lib/viewer";
import { isManagedClerkId } from "@/lib/build-mode";
import { ActionForm } from "@/components/ActionForm";
import { ProCard } from "@/components/ProCard";
import { ProTermsAgreement } from "@/components/ProTermsAgreement";
import { ProProtectionFields } from "@/components/ProProtectionFields";
import { proTermsSections, PRO_TERMS_VERSION } from "@/lib/pro-terms";
import { builtEnrollmentQuote } from "@/lib/enroll";
import { acceptBuiltProfile } from "@/app/pro/claim-actions";

export const metadata = { title: "Welcome to Nearest" };
export const dynamic = "force-dynamic";

/**
 * First sign-in to a profile Nearest built for them: they see their profile and accept the Professional Terms before
 * anything else. Accepting puts the profile live.
 */
export default async function WelcomeBuilt() {
  const viewer = await getViewer();
  if (!viewer?.user) redirect("/pro/sign-in");
  const user = viewer.user;
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, user.id) });
  if (!p?.builtBy || p.entryPaidAt || isManagedClerkId(user.clerkUserId)) redirect("/pro/home");
  const { addedPartner } = await import("@/lib/partner-handoff");
  const partner = await addedPartner(user.id);
  if (partner && (partner.handoff === "setup" || partner.handoff === "finish")) {
    const { setupSteps } = await import("@/lib/pro");
    const next = (await setupSteps(user.id)).find((x) => !x.done && !x.optional && x.key !== "identity")?.key ?? "review";
    redirect(`/pro/setup/${next}`);
  }
  const [services, photos, city, builder, quote] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, user.id), eq(proServices.active, true))).orderBy(asc(proServices.sort)),
    db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.kind, "image"))).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(3),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
    db.query.users.findFirst({ where: eq(users.id, p.builtBy!), columns: { firstName: true } }),
    builtEnrollmentQuote(p),
  ]);
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t xs muted">Welcome</div><span className="sp" /></div>
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={72} height={72} />
        <h1 className="disp h2">You&apos;re in, {user.firstName ?? "welcome"}.</h1>
        <p className="small p">{partner ? "Your Nearest Partner page is ready. Here's how students will see your profile — review it, then approve it below. You can change anything after you approve." : `${builder?.firstName ?? "The Nearest team"} set up your profile. Here's how students will see you — you can change anything after you accept.`}</p>
        {partner && <a className="link small" href="/pro/partner-preview" target="_blank" rel="noreferrer">Preview my partner page</a>}
        <ProCard p={{ ...p, favCount: 0 }} services={services} photos={photos.map((x) => x.url)} city={city?.name ?? null} first={user.firstName} last={user.lastName} />
        {!quote.ok ? (
          <div className="card warn small"><span>{quote.reason}</span><span className="muted">Message Nearest support and we&apos;ll sort it out with you.</span></div>
        ) : (
          <ActionForm action={acceptBuiltProfile} submitLabel={partner ? "Approve my page and go live" : "Accept and go live"}>
            {p.serviceMode !== "travel" && !p.addressLine && (
              <div className="card" style={{ gap: 10 }}>
                <span className="b">Your address</span>
                <span className="xs muted">Where clients come to you. It stays private — students only see how far away you are, and a booked client gets it on the day of the appointment.</span>
                <div className="field"><label htmlFor="w-addr">Street address</label><input id="w-addr" name="address" required maxLength={160} autoComplete="address-line1" placeholder="123 Main St" /></div>
                <div className="field"><label htmlFor="w-unit">Apt, suite, unit (optional)</label><input id="w-unit" name="unit" maxLength={40} autoComplete="address-line2" /></div>
                <div className="field"><label htmlFor="w-zip">ZIP</label><input id="w-zip" name="zip" required inputMode="numeric" maxLength={5} defaultValue={p.zip ?? ""} /></div>
                {city && <span className="xs muted">City: {city.name}, {city.state}</span>}
              </div>
            )}
            <span className="eyebrow">Before you start</span>
            <ProTermsAgreement sections={proTermsSections({ cents: quote.cents, label: quote.label })} version={PRO_TERMS_VERSION} />
            <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label>
            {!p.insuranceChoiceAt && <div className="card" style={{ gap: 8 }}><ProProtectionFields /></div>}
            <span className="xs muted">{partner ? "Approving puts your profile and partner page live, and shows your link to share. You can go offline any time from Today." : "Accepting puts your profile live. You can go offline any time from Today, and turn it back on whenever you like."}</span>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
