import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { publicFacts, usd } from "@/lib/public/facts";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 3600;
export const metadata = pageMeta(
  "Free Business Listing for Beauty Professionals — What's Really Free",
  "An honest look at free ways to list a beauty or wellness business, what 'free' usually leaves out, and when a niche platform like Nearest fits.",
  "/free-business-listing",
);

export default async function FreeListing() {
  const f = await publicFacts();
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Free business listing", href: "/free-business-listing" }]} />
      <p className="pub-eyebrow">Listings</p>
      <h1>Free business listings for beauty professionals</h1>
      <p className="pub-lede">If you want student clients, the free listing that matters most is one students actually use to book. On Nearest, new professionals list free — no sign-up fee, no monthly membership fee — and verified students in your city can find you, request a time and pay in the app.</p>
      <p className="pub-box note"><Link href="/pro/sign-up">Create your free profile</Link> or <Link href="/locations#check">check whether your city is open</Link> first.</p>

      <h2>Listing, booking platform or advertisement?</h2>
      <ul>
        <li><strong>A listing</strong> makes you findable — a profile people browse or search.</li>
        <li><strong>A booking platform</strong> runs the appointment: calendar, deposits, reminders, payments.</li>
        <li><strong>An advertisement</strong> buys extra placement for as long as you pay.</li>
      </ul>
      <p>Nearest combines the first two for student clients: students discover you, then book and pay through the platform. Nothing to advertise, and it works alongside the booking tool you already use for everyone else.</p>

      <h2>What to check before you call any listing &ldquo;free&rdquo;</h2>
      <ul>
        <li><strong>Per-booking costs.</strong> On Nearest, a flat {usd(f.feeDollars)} booking fee is added to the student&apos;s total by default, so you receive your full price.</li>
        <li><strong>Card processing.</strong> On Nearest, card-processing fees are deducted from each payout — there&apos;s no separate processing bill.</li>
        <li><strong>Paid upgrades.</strong> Deposits, reminders and request alerts are part of every Nearest profile, not add-ons.</li>
        <li><strong>Your time.</strong> Every profile needs current hours, photos and prices. A Nearest profile is one place to keep them for student clients.</li>
      </ul>

      <h2>A simple free setup that works</h2>
      <ol>
        <li><strong>A Nearest profile</strong> so verified students in your city can find and book you — <Link href="/pro/sign-up">join free</Link>.</li>
        <li><strong>A Google Business Profile</strong> so nearby searches find you — <Link href="/resources/get-beauty-business-found-on-google">set it up properly</Link>.</li>
        <li><strong>One social profile</strong> you post on weekly, with your Nearest link (usenearest.com/pro-yourname) in the bio.</li>
        <li><strong>Your existing booking tool</strong> for non-student clients, if you have one. Block time when a booking comes in from either side.</li>
      </ol>

      <h2>What a Nearest listing includes</h2>
      <div className="pub-table-wrap"><table>
        <thead><tr><th scope="col">Question</th><th scope="col">Nearest</th></tr></thead>
        <tbody>
          <tr><th scope="row">Who sees it?</th><td>Verified high school, college, trade school and online students in cities where Nearest is live.</td></tr>
          <tr><th scope="row">Cost to list</th><td>Free for new professionals; no monthly membership fee.</td></tr>
          <tr><th scope="row">Per booking</th><td>A flat {usd(f.feeDollars)} booking fee, added to the student&apos;s total by default; card processing is deducted from your payout.</td></tr>
          <tr><th scope="row">Replace my booking tool?</th><td>No — use it alongside what you have.</td></tr>
          <tr><th scope="row">Competition</th><td>{f.firstInPerCategory} spots per service category per city to start, never more than {f.capPerCategory}.</td></tr>
          <tr><th scope="row">Pricing rules</th><td>Up to {usd(f.capDollars)} per service including add-ons; you set your prices within that.</td></tr>
          <tr><th scope="row">Guaranteed bookings?</th><td>No. Nearest is a discovery and booking channel; results depend on demand, your profile, prices and availability.</td></tr>
        </tbody>
      </table></div>
      <p>Not sure your city is open? The <Link href="/locations#check">city checker</Link> shows whether enrollment is open in your category, closed because spots are taken, or not open yet — and lets you leave your details. More detail in <Link href="/resources/where-to-list-beauty-business-free">where to list your beauty business for free</Link> and <Link href="/for-professionals">Nearest for professionals</Link>.</p>
      <ProCta />
    </div>
  );
}
