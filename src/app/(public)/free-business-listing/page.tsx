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
      <p className="pub-lede">Plenty of places let you list a beauty business for free. The useful question is what each one does for you, who sees it, and what it costs once clients start booking.</p>

      <h2>Listing, booking platform or advertisement?</h2>
      <ul>
        <li><strong>A listing</strong> makes you findable — a profile in maps, search or a directory.</li>
        <li><strong>A booking platform</strong> runs the appointment: calendar, deposits, reminders, payments.</li>
        <li><strong>An advertisement</strong> buys extra placement for as long as you pay.</li>
      </ul>
      <p>Many tools mix these. You can keep one booking platform and use several listings to point people to it.</p>

      <h2>What &ldquo;free&rdquo; often leaves out</h2>
      <ul>
        <li>Card-processing fees on payments taken through the platform.</li>
        <li>Per-booking or marketplace fees on new clients the platform brings.</li>
        <li>Paid upgrades for features like deposits, reminders or extra visibility.</li>
        <li>Your time — every listing needs current hours, photos and prices.</li>
      </ul>
      <p>Before signing up, read the provider&apos;s current pricing page and ask: who owns the client list, how refunds work, and how quickly payouts arrive.</p>

      <h2>A sensible free stack</h2>
      <ol>
        <li>Google Business Profile — {" "}<Link href="/resources/get-beauty-business-found-on-google">set it up properly</Link>.</li>
        <li>Apple Business Connect and Bing Places, kept consistent.</li>
        <li>One social profile you post on weekly, with your booking link.</li>
        <li>One booking tool for your calendar and deposits.</li>
        <li>A niche marketplace only if it reaches clients you can&apos;t reach otherwise.</li>
      </ol>

      <h2>How Nearest compares</h2>
      <div className="pub-table-wrap"><table>
        <thead><tr><th scope="col">Question</th><th scope="col">Nearest</th></tr></thead>
        <tbody>
          <tr><th scope="row">Who sees it?</th><td>Verified students in cities where Nearest is live.</td></tr>
          <tr><th scope="row">Cost to list</th><td>Free for new professionals; no monthly membership fee.</td></tr>
          <tr><th scope="row">Per booking</th><td>A flat service fee (currently {usd(f.feeDollars)}) in each booking — added on top of your price by default — plus card processing deducted from payouts.</td></tr>
          <tr><th scope="row">Replace my booking tool?</th><td>No — use it alongside what you have.</td></tr>
          <tr><th scope="row">Limits</th><td>Spots per city and category; student prices up to {usd(f.capDollars)} per service including add-ons; live only in select cities.</td></tr>
          <tr><th scope="row">Guaranteed bookings?</th><td>No. It&apos;s a discovery channel.</td></tr>
        </tbody>
      </table></div>
      <p>Nearest fits professionals who want student clients and work where it&apos;s live. It isn&apos;t a general directory for every client. See <Link href="/locations">Locations</Link> and the <Link href="/resources/where-to-list-beauty-business-free">full comparison guide</Link>.</p>
      <ProCta />
    </div>
  );
}
