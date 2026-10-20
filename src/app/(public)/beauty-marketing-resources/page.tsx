import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { ProCta } from "@/components/public/Cta";
import { pageMeta } from "@/lib/public/meta";

export const metadata = pageMeta(
  "Beauty Marketing Resources — Captions, Referral Scripts, Flyers & Calendars",
  "Copyable marketing templates for beauty professionals: referral scripts, captions, opening announcements, a seasonal promotion calendar and flyer copy.",
  "/beauty-marketing-resources",
);

const Copy = ({ label, text }: { label: string; text: string }) => (
  <figure style={{ margin: 0 }}><figcaption className="pub-muted">{label}</figcaption><pre className="pub-copy">{text}</pre></figure>
);

export default function MarketingResources() {
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Beauty marketing resources", href: "/beauty-marketing-resources" }]} />
      <p className="pub-eyebrow">Templates</p>
      <h1>Beauty marketing resources you can copy</h1>
      <p className="pub-lede">Ready-to-edit scripts, captions and plans. Replace the brackets with your details and keep your own voice.</p>
      <nav className="pub-toc" aria-label="On this page"><ul>
        <li><a href="#referral-scripts">Referral scripts</a></li><li><a href="#captions">Captions</a></li><li><a href="#openings">Opening announcements</a></li>
        <li><a href="#seasonal">Seasonal promotion calendar</a></li><li><a href="#content-calendar">Content calendar</a></li><li><a href="#flyers">Flyers</a></li>
      </ul></nav>

      <h2 id="referral-scripts">Referral scripts</h2>
      <Copy label="In person, right after the result" text={"I'm so glad you love it! I'm growing my book — if anyone asks who did your [service], I'd really appreciate you sending them my way."} />
      <Copy label="Text after the appointment" text={"Thanks for coming in today, [name]! If a friend wants [service], here's my link: [link]. When they book, you'll both get [small reward] on your next visit."} />
      <Copy label="Referral promotion rules" text={"Refer a friend → you both get [reward]\n• New clients only\n• Reward applies at the friend's first completed appointment\n• Ends [date]"} />

      <h2 id="captions">Captions</h2>
      <Copy label="Result" text={"[Service] — [length/shape/style]. [One detail that shows skill].\nBooking [days] · link in bio"} />
      <Copy label="Education" text={"\"How long will this last?\" With [care tip], about [range]. Here's how to make it last longer: [tips]."} />
      <Copy label="Trust" text={"Every client gets fresh [tools/liners]. Here's my cleaning routine between appointments."} />

      <h2 id="openings">Opening announcements (without sounding desperate)</h2>
      <Copy label="Specific and calm" text={"Two openings this Thursday after 4 PM for [service]. Book through the link in my bio."} />
      <Copy label="Waitlist first" text={"Hi [name] — a [time] spot just opened on [day]. You're first on my list; want it?"} />

      <h2 id="seasonal">Seasonal promotion calendar</h2>
      <div className="pub-table-wrap"><table>
        <thead><tr><th scope="col">Season</th><th scope="col">Promote from</th><th scope="col">Idea</th></tr></thead>
        <tbody>
          <tr><th scope="row">Back to school</th><td>2–3 weeks before classes</td><td>Low-maintenance styles; after-school slots</td></tr>
          <tr><th scope="row">Homecoming</th><td>4–6 weeks before</td><td>Group slots; school-color looks</td></tr>
          <tr><th scope="row">Holidays</th><td>Early November</td><td>Party-ready packages; gift cards if you sell them</td></tr>
          <tr><th scope="row">Valentine&apos;s</th><td>Mid-January</td><td>Date-night looks; bring-a-friend offer</td></tr>
          <tr><th scope="row">Prom</th><td>6–8 weeks before</td><td>Trials; full-look packages</td></tr>
          <tr><th scope="row">Graduation</th><td>4–6 weeks before</td><td>Photo-ready packages; family back-to-back slots</td></tr>
          <tr><th scope="row">Summer</th><td>May</td><td>Protective styles; vacation sets</td></tr>
        </tbody>
      </table></div>
      <p className="pub-more">More: <Link href="/resources/student-clients-prom-homecoming-graduation">student event seasons</Link></p>

      <h2 id="content-calendar">Content calendar</h2>
      <p>A full month of daily post ideas with caption starters is in the <Link href="/resources/nail-tech-30-day-content-calendar">30-day content calendar</Link>. It&apos;s written for nail techs, and the structure works for any specialty.</p>

      <h2 id="flyers">Flyers</h2>
      <p>Layout rules and sample copy for nails, braids and lashes are in <Link href="/resources/beauty-business-flyer">how to make a flyer that converts</Link>.</p>
      <ProCta />
    </div>
  );
}
