import Image from "next/image";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, users, professionalProfiles, proServices, portfolioItems, cities } from "@/db";
import { getViewer } from "@/lib/viewer";
import { isManagedClerkId } from "@/lib/build-mode";
import { ActionForm } from "@/components/ActionForm";
import { ProCard } from "@/components/ProCard";
import { ProTermsAgreement } from "@/components/ProTermsAgreement";
import { ProCampaignFields } from "@/components/ProCampaignFields";
import { ProProtectionFields } from "@/components/ProProtectionFields";
import { proTermsSections, PRO_TERMS_VERSION } from "@/lib/pro-terms";
import { builtEnrollmentQuote } from "@/lib/enroll";
import { rewardEligibleServices } from "@/lib/campaign-pro";
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
  const [services, photos, city, builder, quote, rewardServices] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, user.id), eq(proServices.active, true))).orderBy(asc(proServices.sort)),
    db.select({ url: portfolioItems.url }).from(portfolioItems).where(and(eq(portfolioItems.userId, user.id), eq(portfolioItems.kind, "image"))).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(3),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
    db.query.users.findFirst({ where: eq(users.id, p.builtBy!), columns: { firstName: true } }),
    builtEnrollmentQuote(p),
    rewardEligibleServices(user.id),
  ]);
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t xs muted">Welcome</div><span className="sp" /></div>
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={72} height={72} />
        <h1 className="disp h2">You&apos;re in, {user.firstName ?? "welcome"}.</h1>
        <p className="small p">{builder?.firstName ?? "The Nearest team"} set up your profile. Here&apos;s how students will see you — you can change anything after you accept.</p>
        <ProCard p={{ ...p, favCount: 0 }} services={services} photos={photos.map((x) => x.url)} city={city?.name ?? null} first={user.firstName} last={user.lastName} />
        {!quote.ok ? (
          <div className="card warn small"><span>{quote.reason}</span><span className="muted">Message Nearest support and we&apos;ll sort it out with you.</span></div>
        ) : (
          <ActionForm action={acceptBuiltProfile} submitLabel="Accept and go live">
            <span className="eyebrow">Before you start</span>
            <ProTermsAgreement sections={proTermsSections({ cents: quote.cents, label: quote.label })} version={PRO_TERMS_VERSION} />
            <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="inviteReward" required /><span>I agree to honor Nearest&apos;s $5 student invite reward: a student who earned it by inviting a friend gets $5 off their first booking with me, taken from that booking&apos;s payout.</span></label>
            <div className="card" style={{ gap: 8 }}>
              <span className="eyebrow">Nearest launch campaign</span>
              <ProCampaignFields services={rewardServices} />
            </div>
            {!p.insuranceChoiceAt && <div className="card" style={{ gap: 8 }}><ProProtectionFields /></div>}
            <span className="xs muted">Accepting puts your profile live. You can go offline any time from Today, and turn it back on whenever you like.</span>
          </ActionForm>
        )}
      </div>
    </div>
  );
}
