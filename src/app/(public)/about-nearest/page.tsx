import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { pageMeta } from "@/lib/public/meta";
import { INSTAGRAM_URL, ROUTES, SUPPORT_EMAIL } from "@/lib/public/site";

export const metadata = pageMeta(
  "About Nearest — Student Beauty, Wellness & Self-Care Booking Platform",
  "Nearest (usenearest.com) is a booking platform connecting verified students with independent beauty, wellness and self-care professionals in live cities.",
  "/about-nearest",
);

export default function About() {
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "About Nearest", href: "/about-nearest" }]} />
      <p className="pub-eyebrow">About</p>
      <h1>Nearest — Student Beauty, Wellness &amp; Self-Care Booking Platform</h1>
      <p className="pub-lede">Nearest is an online booking platform at <strong>usenearest.com</strong> that connects verified students with independent beauty, grooming, wellness and self-care professionals near them — at student-friendly prices.</p>

      <h2>Why Nearest exists</h2>
      <p>Students get discounts on food, clothing, technology and entertainment. Haircuts, braids, nails, lashes, skincare and other self-care add up just as fast — and they matter for confidence, school photos, interviews, events and everyday life. Nearest&apos;s mission is to make professional beauty, grooming, wellness and self-care accessible at student prices, while giving independent professionals a free way to reach student clients.</p>

      <h2>What Nearest is</h2>
      <p>Nearest is a marketplace, not a salon. Independent professionals — hairstylists, braiders, barbers, nail techs, lash and brow artists, makeup artists and other self-care professionals — list their own services, prices and hours. Verified students find them, request appointments, pay through the app and complete the appointment with check-in and finish steps. Nearest provides the platform, payment processing and booking rules; the services are provided by the professionals, who are independent businesses.</p>

      <h2>Who it serves</h2>
      <ul>
        <li><strong>Students</strong> — high school, college, trade school and online students — who verify their student status. Students 13–17 need a parent or guardian&apos;s approval.</li>
        <li><strong>Independent professionals</strong> who want to reach those students. New professionals list free, without a monthly membership fee.</li>
      </ul>

      <h2>Where it&apos;s available</h2>
      <p>Nearest is built for students and professionals nationwide and opens city by city. Students can book in cities where professionals are live; professionals can enroll wherever their city is open, and anyone can leave their details for a city that isn&apos;t open yet. <Link href="/locations">Locations</Link> shows real-time status for each city.</p>

      <h2>What Nearest isn&apos;t</h2>
      <ul>
        <li>It isn&apos;t affiliated with, endorsed by or partnered with any school or school district.</li>
        <li>It doesn&apos;t guarantee bookings or income for professionals.</li>
        <li>It doesn&apos;t have bookable appointments in every city — only where professionals are live.</li>
        <li>&ldquo;Nearest&rdquo; here is the name of this platform — searching &ldquo;Nearest beauty booking&rdquo; or &ldquo;usenearest&rdquo; finds it more reliably than the word alone.</li>
      </ul>

      <h2>Official details</h2>
      <ul>
        <li>Website and app: <a href="https://www.usenearest.com">www.usenearest.com</a></li>
        <li>Professionals: <Link href={ROUTES.proLanding}>usenearest.com/pro</Link></li>
        <li>Instagram: <a href={INSTAGRAM_URL} rel="noopener noreferrer" target="_blank">@usenearest</a></li>
        <li>Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></li>
        <li><Link href={ROUTES.terms}>Terms of Service</Link> · <Link href={ROUTES.privacy}>Privacy Policy</Link></li>
      </ul>

      <h2>Learn more</h2>
      <div className="pub-grid">
        <Link className="pub-card" href="/for-professionals"><strong>For professionals</strong><span>How listing works, fees and capacity.</span></Link>
        <Link className="pub-card" href="/student-beauty-services"><strong>For students</strong><span>Prices, booking and safety basics.</span></Link>
        <Link className="pub-card" href="/resources"><strong>Resources</strong><span>Free guides for beauty businesses.</span></Link>
        <Link className="pub-card" href="/faq"><strong>FAQ</strong><span>120 answered questions.</span></Link>
      </div>
    </div>
  );
}
