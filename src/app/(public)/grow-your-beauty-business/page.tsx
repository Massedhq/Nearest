import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";

export const metadata = pageMeta(
  "How to Grow Your Beauty Business — A Sustainable Plan",
  "A practical framework for independent beauty professionals: visibility, booking conversion, retention, pricing, referrals and local discovery — without burning out.",
  "/grow-your-beauty-business",
);

const G = (slug: string, t: string) => <Link href={`/resources/${slug}`}>{t}</Link>;

export default function Grow() {
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Grow your beauty business", href: "/grow-your-beauty-business" }]} />
      <p className="pub-eyebrow">Guide</p>
      <h1>How to grow your beauty business sustainably</h1>
      <p className="pub-lede">Sustainable growth for an independent professional isn&apos;t about being everywhere. It&apos;s a loop: get seen by the right people, make booking easy, deliver work they come back for, and turn happy clients into referrals. Strengthen the weakest link first.</p>

      <h2>1. Visibility: be findable where clients look</h2>
      <p>Most local clients find a professional through search, social media or a friend. Complete a Google Business Profile, keep one active social account, and list on platforms that reach your audience. See {G("get-beauty-business-found-on-google", "getting found on Google")} and {G("where-to-list-beauty-business-free", "where to list for free")}.</p>

      <h2>2. Conversion: turn interest into appointments</h2>
      <p>If people look but don&apos;t book, something is missing — prices, durations, availability or an easy link. Use the {G("improve-beauty-profile-booking-conversion", "profile checklist")} and the {G("why-beauty-business-not-getting-bookings", "booking diagnostic")}.</p>

      <h2>3. Retention: make the next visit automatic</h2>
      <ul>
        <li>Rebook before the client leaves, with a date that fits the service cycle.</li>
        <li>Send a reminder when they&apos;re due.</li>
        <li>Remember preferences — length, products, the playlist — and write them down.</li>
      </ul>
      <p>A returning client costs nothing to win again. See {G("repeat-clients-braiding-locs", "building repeat clients")}.</p>

      <h2>4. Pricing: profit per hour, not price per service</h2>
      <p>Know what each service earns you per hour after products, fees and setup time. Promote the most profitable services you enjoy, add optional add-ons, and raise prices when you&apos;re booked weeks out. See {G("price-student-friendly-beauty-services", "pricing student-friendly services profitably")}.</p>

      <h2>5. Referrals: let happy clients do the introducing</h2>
      <p>Ask at the moment of delight, make it easy to share, and thank people. Copyable scripts are on <Link href="/beauty-marketing-resources#referral-scripts">marketing resources</Link>.</p>

      <h2>6. Capacity: grow without burning out</h2>
      <ul>
        <li>Set a maximum number of appointments per day and protect breaks.</li>
        <li>Block one admin hour a week for posting, messages and bookkeeping.</li>
        <li>Raise prices before adding hours.</li>
        <li>Part-time is a valid model — fixed days, two or three signature services, online booking.</li>
      </ul>

      <h2>A one-page monthly plan</h2>
      <pre className="pub-copy">{`Ideal client: ______________________
Services to promote this month: 1) ________ 2) ________
Channels: Google profile · [one social platform] · referrals · [one listing]
Posting rhythm: ___ posts per week (batch film on ________)
One offer (with end date): ______________________
Number to track: new bookings per week = ___
Review date: ____________`}</pre>

      <h2>Where Nearest fits</h2>
      <p>If students are part of your market and Nearest is live in your city, it&apos;s a free additional channel to reach verified students — one part of the visibility step, alongside the tools you already use. See <Link href="/for-professionals">Nearest for professionals</Link>.</p>
      <ProCta />
    </div>
  );
}
