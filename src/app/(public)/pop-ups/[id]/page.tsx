import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, fieldPopups } from "@/db";
import { pageMeta } from "@/lib/public/meta";

export const revalidate = 300;

/**
 * A Nearest pop-up sign-up event (2026-11-22): public only while Confirmed. Shows the name, host, address, date and
 * time and the details the team wrote — never the private contact or notes. Professionals come in person to sign up.
 */
async function load(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const p = await db.query.fieldPopups.findFirst({ where: eq(fieldPopups.id, id) });
  return p && p.status === "confirmed" ? p : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) return { title: "Pop-up event", robots: { index: false, follow: false } };
  const date = p.startsAt.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "long", month: "long", day: "numeric" });
  return pageMeta(`${p.name} — ${p.cityName}, ${p.state}`, `Beauty professionals: meet Nearest in person on ${date} at ${p.street}, ${p.cityName} and set up your free profile.`, `/pop-ups/${p.id}`);
}

export default async function PopupPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await load((await params).id);
  if (!p) notFound();
  const tz = { timeZone: "America/Chicago" } as const;
  const date = p.startsAt.toLocaleDateString("en-US", { ...tz, weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString("en-US", { ...tz, hour: "numeric", minute: "2-digit" });
  const addr = `${p.street}, ${p.cityName}, ${p.state} ${p.zip}`;
  return (
    <div className="pub-article">
      <p style={{ textTransform: "uppercase", letterSpacing: ".14em", fontSize: 12, fontWeight: 700 }}>Nearest pop-up</p>
      <h1>{p.name}</h1>
      <p><strong>{date}</strong><br />{time(p.startsAt)} – {time(p.endsAt)}</p>
      <p>{p.kind === "vendor" ? "Find the Nearest table at " : ""}{p.hostName ? <>{p.hostName}<br /></> : null}{addr}<br />
        <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noopener noreferrer">Get directions</a></p>
      {p.details && <p style={{ whiteSpace: "pre-wrap" }}>{p.details}</p>}
      <h2>Who it&apos;s for</h2>
      <p>Beauty professionals — nail techs, lash techs, braiders, stylists, barbers and more. Stop by, meet the Nearest team and set up your free professional profile on the spot. Bring your phone and a few photos of your work.</p>
      {p.sourceUrl && <p><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">See the event listing</a></p>}
      <p>Can&apos;t make it? <Link href="/for-professionals">See how Nearest works for professionals</Link>.</p>
    </div>
  );
}
