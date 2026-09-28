import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, users, professionalProfiles, studentProfiles, bookings, schools } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { stripe } from "@/lib/stripe";
import { getEntryState } from "@/lib/entry";
import { findStaleStripeRefs } from "@/lib/stripe-hygiene";
import { clearTestStripeLinks } from "@/app/admin/actions";

export const metadata = { title: "Launch readiness" };
export const dynamic = "force-dynamic";

type Check = { area: string; label: string; ok: boolean | null; detail: string; fix?: string };

const env = (k: string) => (process.env[k] ?? "").trim();

export default async function Launch() {
  await requireAdmin({ owner: true });
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // ---------- Sign-in (Clerk) ----------
  const pk = env("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"), ck = env("CLERK_SECRET_KEY");
  add({ area: "Sign-in", label: "Clerk live publishable key", ok: pk.startsWith("pk_live_"), detail: pk ? `${pk.slice(0, 8)}…` : "missing", fix: "Clerk → Production → API keys → copy pk_live_ into Vercel NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, then redeploy." });
  add({ area: "Sign-in", label: "Clerk live secret key", ok: ck.startsWith("sk_live_"), detail: ck ? `${ck.slice(0, 8)}…` : "missing", fix: "Clerk → Production → API keys → copy sk_live_ into Vercel CLERK_SECRET_KEY, then redeploy." });
  add({ area: "Sign-in", label: "Owner emails set", ok: env("OWNER_EMAILS").split(",").filter(Boolean).length > 0, detail: env("OWNER_EMAILS") || "missing" });
  add({ area: "Sign-in", label: "Main owner email set", ok: Boolean(env("MAIN_OWNER_EMAIL")), detail: env("MAIN_OWNER_EMAIL") || "missing" });

  // ---------- Payments (Stripe) ----------
  const sk = env("STRIPE_SECRET_KEY");
  add({ area: "Payments", label: "Stripe live secret key", ok: sk.startsWith("sk_live_") || sk.startsWith("rk_live_"), detail: sk ? `${sk.slice(0, 8)}…` : "missing", fix: "Stripe (live mode) → Developers → API keys → Secret key → Vercel STRIPE_SECRET_KEY, then redeploy." });
  if (sk) {
    try {
      const me = await stripe().accounts.retrieve(null);
      add({ area: "Payments", label: "Stripe account can take payments", ok: Boolean(me.charges_enabled), detail: me.charges_enabled ? "charges enabled" : "not yet", fix: "Stripe → finish Activate account (business details, bank)." });
      add({ area: "Payments", label: "Stripe account can pay out", ok: Boolean(me.payouts_enabled), detail: me.payouts_enabled ? "payouts enabled" : "not yet", fix: "Stripe → Settings → Payouts → add Nearest's bank account." });
      try { await stripe().accounts.list({ limit: 1 }); add({ area: "Payments", label: "Stripe Connect (pro & partner payouts)", ok: true, detail: "available" }); }
      catch (e) { add({ area: "Payments", label: "Stripe Connect (pro & partner payouts)", ok: false, detail: (e as Error).message.slice(0, 140), fix: "Stripe → Connect → Get started (Marketplace, Express), and turn on Accounts v1 support in Settings → Developers → API policies." }); }
    } catch (e) {
      add({ area: "Payments", label: "Stripe key accepted", ok: false, detail: (e as Error).message.slice(0, 160) });
    }
  }
  const wh = env("STRIPE_WEBHOOK_SECRET");
  add({ area: "Payments", label: "Stripe webhook secret", ok: wh.startsWith("whsec_"), detail: wh ? "set" : "missing", fix: "Stripe (live) → Developers → Webhooks → endpoint https://usenearest.com/api/stripe/webhook with the events in docs/LAUNCH.md → copy the signing secret into Vercel STRIPE_WEBHOOK_SECRET." });
  add({ area: "Payments", label: "Accounts v1 support (live)", ok: null, detail: "Can't be read automatically", fix: "Stripe (live) → Settings → Developers → API policies → turn on Accounts v1 support. Then connect your own payout account on My profile — if that works, this is on." });

  // ---------- Email (Resend) ----------
  const rk = env("RESEND_API_KEY");
  add({ area: "Email", label: "Resend key", ok: rk.startsWith("re_"), detail: rk ? "set" : "missing" });
  if (rk) {
    try {
      const { Resend } = await import("resend");
      const d = await new Resend(rk).domains.list();
      const dom = d.data?.data?.find((x) => x.name === "usenearest.com");
      add({ area: "Email", label: "usenearest.com verified in Resend", ok: dom?.status === "verified", detail: dom ? dom.status : "domain not added", fix: "resend.com → Domains → add usenearest.com and its DNS records → Verify." });
    } catch (e) { add({ area: "Email", label: "usenearest.com verified in Resend", ok: false, detail: (e as Error).message.slice(0, 140) }); }
  }
  add({ area: "Email", label: "Sends from @usenearest.com", ok: /@usenearest\.com/i.test(env("EMAIL_FROM")), detail: env("EMAIL_FROM") || "missing (defaults to hello@usenearest.com)" });
  add({ area: "Email", label: "Links in emails point to the live site", ok: env("APP_URL") === "https://usenearest.com" || env("APP_URL") === "https://www.usenearest.com", detail: env("APP_URL") || "missing" });

  // ---------- Site ----------
  add({ area: "Site", label: "Photo storage (Vercel Blob)", ok: Boolean(env("BLOB_READ_WRITE_TOKEN")), detail: env("BLOB_READ_WRITE_TOKEN") ? "connected" : "missing" });
  add({ area: "Site", label: "15-minute scheduled check (reminders, payouts, holds)", ok: Boolean(env("CRON_SECRET")), detail: env("CRON_SECRET") ? "CRON_SECRET set" : "missing", fix: "Vercel → Environment Variables → CRON_SECRET (same value as .env.local), then redeploy." });

  // ---------- Marketplace switches ----------
  const s = await getSettings();
  const state = await getEntryState();
  add({ area: "Marketplace", label: "Professional registration open", ok: s["status.pro_registration"] === true, detail: s["status.pro_registration"] ? "open" : "closed", fix: "Command Center → Marketplace status." });
  add({ area: "Marketplace", label: "Student registration open", ok: s["status.student_registration"] === true, detail: s["status.student_registration"] ? "open" : "closed", fix: "Command Center → Marketplace status." });
  add({ area: "Marketplace", label: "Bookings on", ok: s["status.bookings"] === true, detail: s["status.bookings"] ? "active" : "paused", fix: "Command Center → Marketplace status → Bookings." });
  add({ area: "Marketplace", label: "Enrollment phase", ok: state === "FIRST_IN_OPEN", detail: state.replace(/_/g, " ").toLowerCase(), fix: "First In → Enrollment phase." });
  const [{ n: schoolCount }] = await db.select({ n: sql<number>`count(*)::int` }).from(schools);
  add({ area: "Marketplace", label: "Schools loaded", ok: schoolCount > 1000, detail: `${schoolCount.toLocaleString()} schools`, fix: "Run: npm run schools:import -- --state TX (then without --state for every state)." });

  // ---------- Test data ----------
  const [[u], [p], [st], [b]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles),
    db.select({ n: sql<number>`count(*)::int` }).from(studentProfiles),
    db.select({ n: sql<number>`count(*)::int` }).from(bookings),
  ]);
  let stale: Awaited<ReturnType<typeof findStaleStripeRefs>> = [];
  if (sk) { try { stale = await findStaleStripeRefs(); } catch { /* Stripe unreachable — shown in Payments above */ } }
  add({ area: "Test data", label: "Stripe links left over from test mode", ok: stale.length === 0,
    detail: stale.length ? stale.map((x) => `${x.name} (${[x.customer && "customer", x.account && "payout account", x.subscription && "membership"].filter(Boolean).join(", ")})`).join(" • ") : "none — every saved Stripe link exists in live mode",
    fix: stale.length ? "Tap Clear test Stripe links below. It keeps the accounts; those people just reconnect (payouts) or restart their membership in live mode." : undefined });

  const areas = [...new Set(checks.map((c) => c.area))];
  const red = checks.filter((c) => c.ok === false).length;
  return (
    <>
      <AdminHead eyebrow="Owner only • checks the live settings this site is running with" title="Launch readiness" />
      <div className={`card ${red ? "warn" : "ok"}`} style={{ gap: 6 }}>
        <span className="disp h2">{red ? `${red} thing${red === 1 ? "" : "s"} to finish before promoting` : "Ready to promote"}</span>
        <span className="small muted">Green = done. Red = needs attention (the fix is listed). Grey = check by hand. Refresh after each change and redeploy.</span>
      </div>
      {areas.map((a) => (
        <div key={a} className="card" style={{ gap: 8 }}>
          <span className="eyebrow">{a}</span>
          {checks.filter((c) => c.area === a).map((c) => (
            <div key={c.label} className="row top-a" style={{ gap: 10, borderTop: "1px solid #1C1C1F", paddingTop: 8 }}>
              <span className={`tag ${c.ok === true ? "ok" : c.ok === false ? "bad" : ""}`} style={{ minWidth: 56, justifyContent: "center" }}>{c.ok === true ? "Done" : c.ok === false ? "Fix" : "Check"}</span>
              <div className="col g4 grow"><span className="small b">{c.label}</span><span className="xs muted">{c.detail}</span>{c.ok !== true && c.fix && <span className="xs">{c.fix}</span>}</div>
            </div>
          ))}
        </div>
      ))}
      {stale.length > 0 && (
        <form action={clearTestStripeLinks} className="card" style={{ gap: 8 }}>
          <span className="small">Found {stale.length} Stripe link{stale.length === 1 ? "" : "s"} from test mode. Clearing removes only those links — accounts, profiles and bookings stay.</span>
          <button className="btn sm" type="submit">Clear test Stripe links</button>
        </form>
      )}
      <p className="xs muted p">Full step-by-step guide: <Link className="link xs" href="https://github.com/Massedhq/Nearest/blob/main/docs/LAUNCH.md">docs/LAUNCH.md</Link></p>
    </>
  );
}
