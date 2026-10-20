import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { StudentCta } from "@/components/public/Cta";
import { FaqList } from "@/components/public/FaqList";
import { faqCategories } from "@/content/faq";
import { publicFacts, usd } from "@/lib/public/facts";
import { pageMeta } from "@/lib/public/meta";
import { ROUTES } from "@/lib/public/site";

export const revalidate = 3600;
export const metadata = pageMeta(
  "Student Beauty Services — Book Affordable Hair, Nails, Lashes & More",
  "How students find and book affordable beauty and self-care appointments on Nearest: student-friendly prices, safe booking, and event planning tips.",
  "/student-beauty-services",
);

export default async function StudentServices() {
  const f = await publicFacts();
  const pick = new Set(["booking-fee", "when-pay", "declined", "cancellations-refunds", "parents-help", "school-affiliation"]);
  const faqs = faqCategories(f).flatMap((c) => c.items).filter((x) => pick.has(x.id));
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Student beauty services", href: "/student-beauty-services" }]} />
      <p className="pub-eyebrow">Nearest for students</p>
      <h1>Student beauty, wellness and self-care services</h1>
      <p className="pub-lede">Nearest helps verified students find independent professionals near them — hair, braids, barbers, nails, lashes, brows, makeup and more — at student-friendly prices, with booking, payment and appointment day handled in one app.</p>
      <p className="pub-box note">Nearest is live in select cities. Check <Link href="/locations">Locations</Link> to see where students can book today.</p>

      <h2>Student-friendly prices</h2>
      <ul>
        <li>No service on Nearest costs more than <strong>{usd(f.capDollars)}</strong>, add-ons included. Professionals set their own prices within that limit.</li>
        <li>The price you see is the total for the service — Nearest&apos;s service fee is already included, and there&apos;s no separate booking fee at checkout. A travel fee is added only if the professional comes to you.</li>
        <li>Some professionals post <strong>Model Calls</strong>: discounted appointments where they practice a technique or build a portfolio. Results can differ from a standard service, and some list requirements.</li>
      </ul>

      <h2 id="how-booking-works">How booking works</h2>
      <ol>
        <li><strong>Create an account and verify you&apos;re a student</strong> — a school ID photo and selfie, proof of enrollment if your school doesn&apos;t issue IDs, or a code sent to your school email. Students 13–17 also need a parent or guardian to approve from an email Nearest sends them.</li>
        <li><strong>Find a professional</strong> by service, price and area, and look at their work, hours and reviews.</li>
        <li><strong>Request a time.</strong> Standard bookings are at least {f.advanceHours} hours ahead; same-day bookings are possible only for openings a professional posts, until {f.sameDayCutoff} Central, at least {f.sameDayNoticeHours} hours out. You aren&apos;t charged yet.</li>
        <li><strong>The professional accepts</strong> (or declines — then you&apos;re not charged).</li>
        <li><strong>Pay to confirm</strong> within {f.payHours} hours of acceptance. Available credits apply first.</li>
        <li><strong>On the day</strong>, the address appears from 12:00 AM Central. Check in when you arrive (within {f.checkinFeet} feet), then finish the appointment in the app so the payment is released.</li>
      </ol>

      <h2>Cancellations and credits</h2>
      <p>Nearest uses credits instead of cash refunds. Cancel {f.cancelHours} hours or more ahead and the full amount becomes credit with that professional. Cancel later or miss the appointment and the {usd(f.depositDollars)} protected deposit goes to the professional; the rest becomes credit with them. If a professional cancels, you get the full amount as credit you can use with anyone. Details are in the <Link href={ROUTES.terms}>Terms</Link>.</p>

      <h2>Safety basics</h2>
      <ul>
        <li>Professionals verify their identity with Nearest. Verification confirms a real person — it isn&apos;t a background check or an endorsement of skills.</li>
        <li>Phone numbers and emails aren&apos;t shared; keep messages in the app.</li>
        <li>Services marked 18+ only can&apos;t be booked by students under 18.</li>
        <li>Tell your professional about allergies or sensitivities, and ask for a patch test if you&apos;re unsure.</li>
        <li>You can end or decline an appointment if you feel unsafe, and report it in the app.</li>
      </ul>

      <h2 id="events">Planning for prom, homecoming and graduation</h2>
      <ul>
        <li>Book four to six weeks ahead for prom and graduation; event weeks fill fast.</li>
        <li>Ask about a trial for makeup or hair, and how long the appointment takes on the day.</li>
        <li>Getting ready with friends? Ask about back-to-back times.</li>
        <li>Bring photos of the look you want and what you&apos;re wearing.</li>
      </ul>

      <h2>Not affiliated with schools</h2>
      <p>Nearest checks that you&apos;re a student, but it&apos;s an independent company — not affiliated with, endorsed by or partnered with any school or school district. Appointments happen at the professional&apos;s location or at an address you provide; Nearest doesn&apos;t arrange appointments at schools.</p>

      <h2>Common questions</h2>
      <FaqList items={faqs} />
      <p className="pub-more"><Link href="/faq#students-parents">All student and parent questions</Link></p>
      <StudentCta />
    </div>
  );
}
