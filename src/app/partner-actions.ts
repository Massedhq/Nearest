"use server";
import { headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, partnerApplications } from "@/db";
import { notifyAdmins } from "@/lib/outreach";
import { sendEmail } from "@/lib/email";
import { normEmail, partnerDemoLink, partnerSetupDemoLink } from "@/lib/partners";

type FormState = { error?: string; ok?: string };
const s = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max);

/** Public: apply to become a Nearest Partner (no account needed). The owners review it in Admin → Partner pages. */
export async function applyPartner(_: FormState, form: FormData): Promise<FormState> {
  if (s(form, "website", 200)) return { ok: "Thanks — we got your application." }; // honeypot
  const name = s(form, "name", 120);
  const email = normEmail(s(form, "email", 200));
  const instagram = s(form, "instagram", 120).replace(/^@/, "");
  const city = s(form, "city", 80);
  const state = s(form, "state", 40);
  const specialty = s(form, "specialty", 120);
  const about = s(form, "about", 1000);
  if (name.length < 2) return { error: "Enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a working email address." };
  if (!city) return { error: "Enter your city." };
  if (!specialty) return { error: "Tell us your specialty." };
  if (form.get("agree") !== "on") return { error: "Check the box to agree to be contacted about the partner program." };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  if (ip) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(partnerApplications)
      .where(and(eq(partnerApplications.ip, ip), gte(partnerApplications.createdAt, new Date(Date.now() - 3600_000))));
    if (n >= 5) return { error: "Too many applications from this connection. Try again in an hour." };
  }
  const existing = await db.query.partnerApplications.findFirst({ where: and(eq(partnerApplications.email, email), eq(partnerApplications.status, "new")) });
  if (existing) return { ok: "We already have your application — we'll email you soon." };

  const [row] = await db.insert(partnerApplications).values({ name, email, instagram: instagram || null, city, state: state || null, specialty, about: about || null, ip }).returning();
  try {
    const mainId = await (await import("@/lib/partner")).mainOwnerId(); // partner pages are the main owner's alone
    await notifyAdmins({ kind: "partner", title: "New Nearest Partner application", body: `${name} · ${specialty} · ${city}${state ? `, ${state}` : ""}${instagram ? ` · @${instagram}` : ""}`, href: `/admin/partners#a-${row.id}` }, mainId ? [mainId] : undefined);
  } catch { /* never block the applicant */ }
  sendEmail({
    to: email, subject: "We got your Nearest Partner application", eyebrow: "Nearest Partner", heading: `Thanks, ${name.split(" ")[0]}.`,
    lines: ["We'll review your application and email you. Once you're approved, you'll set up your page with the same email address.", `While you wait, see how it looks to your clients (${partnerDemoLink()}) and how setup works (${partnerSetupDemoLink()}).`],
    button: { label: "See the demo", url: partnerDemoLink() },
  }).catch(() => {});
  return { ok: "Thanks — your application is in. We'll email you after we review it." };
}

/**
 * A professional applies from their app (Menu → Become a Nearest Partner, 2026-11-22). Only after
 * partner.apply_min_bookings completed bookings; one open request at a time; the main owner approves on Admin →
 * Partner pages → Applications (same row as public applications, matched to their account email on approval).
 */
export async function requestPartnership(_: FormState, form: FormData): Promise<FormState> {
  const { requirePro } = await import("@/lib/pro");
  const { user, profile } = await requirePro();
  const { partnerApplyStatus } = await import("@/lib/partner-apply");
  if (await (await import("@/lib/partners")).partnerPageFor(user.id)) return { ok: "You're already a Nearest Partner — open the Partner side from your Menu." };
  const st = await partnerApplyStatus(user.id, user.email);
  if (!st.eligible) return { error: `You can apply once you have ${st.min} completed bookings on Nearest. You have ${st.completed}.` };
  if (st.pending) return { ok: "Your request is already in — we'll email you after we review it." };
  if (!user.email) return { error: "Add an email to your account first." };
  const about = s(form, "about", 1000);
  if (about.length < 20) return { error: "Tell us a little about what you'd share with your clients and followers (a sentence or two)." };
  if (form.get("agree") !== "on") return { error: "Check the box to send your request." };
  const name = profile.businessName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Professional";
  const specialty = s(form, "specialty", 120) || "Beauty professional";
  const [row] = await db.insert(partnerApplications).values({
    name, email: normEmail(user.email), instagram: profile.instagram || null, specialty, about: `${about}\n\n(Applied from the pro app — ${st.completed} completed bookings on Nearest.)`, city: s(form, "city", 80) || "—",
  }).returning();
  try {
    const mainId = await (await import("@/lib/partner")).mainOwnerId();
    await notifyAdmins({ kind: "partner", title: "Partner request from a professional", body: `${name} · ${st.completed} completed bookings · ${specialty}`, href: `/admin/partners#a-${row.id}` }, mainId ? [mainId] : undefined);
  } catch { /* never block the request */ }
  sendEmail({
    to: user.email, subject: "We got your Nearest Partner request", eyebrow: "Nearest Partner", heading: `Thanks, ${(user.firstName ?? name).split(" ")[0]}.`,
    lines: ["We'll review your request and email you. Once you're approved, the Partner side opens right in your app."],
    button: { label: "See how partner pages look", url: partnerDemoLink() },
  }).catch(() => {});
  return { ok: "Your request is in. We'll email you after we review it." };
}
