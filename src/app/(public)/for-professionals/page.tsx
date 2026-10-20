import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { FaqList } from "@/components/public/FaqList";
import { faqCategories } from "@/content/faq";
import { publicFacts, usd } from "@/lib/public/facts";
import { pageMeta } from "@/lib/public/meta";
import { ROUTES } from "@/lib/public/site";

export const revalidate = 3600;
export const metadata = pageMeta(
  "Nearest for Beauty Professionals — List Free, Reach Students",
  "Independent beauty and wellness professionals can list free on Nearest with no monthly fee, keep their current booking tools, and reach verified students in live cities.",
  "/for-professionals",
);

export default async function ForProfessionals() {
  const f = await publicFacts();
  const pick = new Set(["free-to-list", "replace-platform", "city-capacity", "guarantee", "payments-pros", "credentials"]);
  const faqs = faqCategories(f).flatMap((c) => c.items).filter((x) => pick.has(x.id));
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "For professionals", href: "/for-professionals" }]} />
      <p className="pub-eyebrow">Nearest for beauty professionals</p>
      <h1>Reach verified students in your city — free to list</h1>
      <p className="pub-lede">Nearest is a student beauty, grooming, wellness and self-care booking platform. Independent professionals list their services, verified high school, college, trade school and online students in their city find them and request appointments, and the booking, payment and appointment-day steps happen in one app.</p>
      <div className="pub-cta-row"><Link className="pub-btn" href={ROUTES.proSignUp}>Join as a professional</Link><Link className="pub-btn ghost" href="/locations">Where Nearest is live</Link></div>

      <h2 id="fees">What it costs</h2>
      <ul>
        <li><strong>No sign-up fee and no monthly membership fee</strong> for new professionals, and no card needed to join.</li>
        <li>Nearest earns a flat <strong>service fee (currently {usd(f.feeDollars)})</strong> on each service and Model Call booked. By default it&apos;s added on top of your price, so students see one total and you receive your full price. You can choose to include it in your price instead.</li>
        <li><strong>Card-processing fees</strong> charged by the payment processor are deducted from each payout. Add-ons carry no service fee.</li>
        <li>Payouts go through <strong>Stripe Connect</strong> to the account you connect. You can go live before connecting; earnings are held until you do.</li>
      </ul>
      <p className="pub-muted">Listing is a discovery opportunity, not a promise of bookings or income. Other costs of running your business — supplies, licensing, insurance — are your own.</p>

      <h2 id="eligibility">Who can join</h2>
      <ul>
        <li>Independent professionals who are at least 18 and legally able to work in the U.S.</li>
        <li>You hold every license, permit and registration your services require, and follow health and sanitation rules. The professional status you choose (licensed, license pending, currently enrolled or self-taught) is self-reported; Nearest doesn&apos;t verify licenses.</li>
        <li>You verify your identity with a driver&apos;s license or state ID and a live selfie, reviewed by Nearest staff. It isn&apos;t a background check.</li>
        <li>The Terms require professional liability and general liability insurance appropriate to your services.</li>
      </ul>

      <h2 id="services">What you can list</h2>
      <p>Categories currently include {f.categories.join(", ")}. You add your own services, prices, durations, photos and optional add-ons. Services that legally require an adult client can be marked 18+ only, and students under 18 can&apos;t book them.</p>
      <p>Because Nearest serves students, no service can cost a student more than <strong>{usd(f.capDollars)}</strong>, including add-ons. If you travel to clients, you can add a flat travel fee to those appointments.</p>

      <h2 id="how-booking-works">How a booking works</h2>
      <ol>
        <li>A verified student requests a time. You get a notification and an email, plus phone alerts if you turn them on.</li>
        <li>You accept or decline within {f.requestHours} hours (or by 2 hours before the start). Nobody is charged before you accept.</li>
        <li>The student pays in full to confirm. The payment is held by the payment processor.</li>
        <li>On the day, the address unlocks for the booked student, they check in when they arrive, and after the service they finish the appointment and the payment is released to you.</li>
        <li>Late cancellations and no-shows pay you the protected deposit ({usd(f.depositDollars)}); the rest becomes the student&apos;s credit with you.</li>
      </ol>

      <h2>Works alongside your current booking tools</h2>
      <p>You don&apos;t have to leave the platform you use today. Students who find you on Nearest book through Nearest; everyone else keeps booking the way they do now. Block time across calendars as bookings come in so you never double-book.</p>

      <h2 id="capacity">Limited spots in each city</h2>
      <p>Nearest is open to professionals nationwide, and every city works the same way: each service category opens with <strong>{f.firstInPerCategory} professional spots</strong> (First In). When those are taken, enrollment closes for that category in that city. Nearest may authorize one additional opening of {f.capPerCategory - f.firstInPerCategory} later — never more than <strong>{f.capPerCategory} professionals per category per city</strong>, and it never reopens automatically. You can join the waitlist for a closed category.</p>
      <p>Spots are for professionals who take bookings: if your profile isn&apos;t live within 30 days of joining for reasons on your side, your spot may be released after a reminder.</p>
      <p>Your city isn&apos;t open yet? <Link href="/locations#check">Check your city</Link> and leave your details — interest from professionals and students is how Nearest decides where to open next.</p>

      <h2 id="profile-help">Want help setting up?</h2>
      <p>With your permission, the Nearest team can build your profile from the details you share. You get an email link, create your own password (8 or more characters), review everything and accept the Professional Terms — then it&apos;s yours to edit. You verify your own ID and connect your own payouts.</p>

      <h2>How to join</h2>
      <ol>
        <li>Create a professional account.</li>
        <li>Build your profile: photos, services and prices, professional status, location and travel, hours, languages, portfolio and ID verification. You can save and finish later.</li>
        <li>Read and accept the Professional Terms, then submit. Once you&apos;re approved and your ID is verified, go live from Today.</li>
      </ol>

      <h2>Common questions</h2>
      <FaqList items={faqs} />
      <p className="pub-more"><Link href="/faq#for-professionals">All professional questions</Link> · <Link href={ROUTES.terms}>Terms of Service</Link></p>
      <ProCta title="Ready to list your services?" />
    </div>
  );
}
