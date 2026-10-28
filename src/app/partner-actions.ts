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
    await notifyAdmins({ kind: "partner", title: "New Nearest Partner application", body: `${name} · ${specialty} · ${city}${state ? `, ${state}` : ""}${instagram ? ` · @${instagram}` : ""}`, href: `/admin/partners#a-${row.id}` });
  } catch { /* never block the applicant */ }
  sendEmail({
    to: email, subject: "We got your Nearest Partner application", eyebrow: "Nearest Partner", heading: `Thanks, ${name.split(" ")[0]}.`,
    lines: ["We'll review your application and email you. Once you're approved, you'll set up your page with the same email address.", `While you wait, see how it looks to your clients (${partnerDemoLink()}) and how setup works (${partnerSetupDemoLink()}).`],
    button: { label: "See the demo", url: partnerDemoLink() },
  }).catch(() => {});
  return { ok: "Thanks — your application is in. We'll email you after we review it." };
}
