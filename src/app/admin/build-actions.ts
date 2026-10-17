"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, users, professionalProfiles, prospects } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { validName } from "@/lib/validate";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/log";
import { BUILD_COOKIE, buildTarget, managedClerkId, newClaimToken, CLAIM_DAYS } from "@/lib/build-mode";
import type { FormState } from "@/components/ActionForm";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const STEPS = new Set(["profile", "services", "credentials", "location", "hours", "communication", "portfolio"]);

async function owner() {
  const a = await requireAdmin();
  if (a.role !== "OWNER") throw new Error("Only owners can build profiles.");
  return a;
}

async function startBuilding(userId: string, step = "profile") {
  (await cookies()).set(BUILD_COOKIE, userId, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 8 });
  redirect(`/pro/setup/${STEPS.has(step) ? step : "profile"}`);
}

/**
 * Admin → Outreach → Build a profile: create the professional's account (no sign-in yet) and open the normal setup
 * pages to fill it in for them. Only with their permission. Credited to the owner who builds it.
 */
export async function createBuiltProfile(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await owner();
  const firstName = str(form, "firstName", 60), lastName = str(form, "lastName", 60);
  const email = str(form, "email", 160).toLowerCase();
  const phone = str(form, "phone", 30) || null;
  const businessName = str(form, "businessName", 80) || null;
  const prospectId = str(form, "prospectId", 40);
  if (!validName(firstName) || !validName(lastName)) return { error: "Enter their first and last name." };
  const { normEmail, normPhone, logProspect } = await import("@/lib/outreach");
  if (!normEmail(email)) return { error: "Enter the email address they'll use to sign in — their claim link goes there." };
  if (form.get("permission") !== "on") return { error: "Confirm they gave you permission to set up their profile." };
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (owners.includes(email)) return { error: "That email belongs to a Nearest owner. Use the professional's own email." };
  const taken = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
  if (taken) {
    const built = await buildTarget(taken.id);
    if (built) return { error: "You already started a profile for this email — open it from the list below." };
    return { error: "This email already has a Nearest account. Look them up under Professionals instead." };
  }

  const [u] = await db.insert(users).values({
    clerkUserId: managedClerkId(), accountType: "professional", firstName, lastName, email, phone,
  }).returning();
  // Same cohort rule as a professional who signs up on their own (the Terms they accept set their entry).
  const settings = await getSettings();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles);
  const cohort = n < Number(settings["growth.second_cohort_end"]) ? "SECOND" : "STANDARD";
  await db.insert(professionalProfiles).values({ userId: u.id, cohort, businessName, referredBy: user.id, builtBy: user.id, builtAt: new Date() });

  // Outreach: link their prospect record (picked, or matched by email / phone) — or add one — and stop recruiting them.
  const em = normEmail(email), ph = normPhone(phone);
  const hit = (prospectId && /^[0-9a-f-]{36}$/.test(prospectId) ? await db.query.prospects.findFirst({ where: eq(prospects.id, prospectId) }) : null)
    ?? (em ? await db.query.prospects.findFirst({ where: eq(prospects.emailNorm, em) }) : null)
    ?? (ph ? await db.query.prospects.findFirst({ where: eq(prospects.phoneNorm, ph) }) : null);
  if (hit) {
    await db.update(prospects).set({ status: "registered", registeredUserId: u.id, updatedAt: new Date() }).where(eq(prospects.id, hit.id));
    await logProspect(hit.id, "registered", "Nearest is building their profile for them (with their permission) — recruiting stopped.", user.id);
  } else {
    const [row] = await db.insert(prospects).values({
      recruiterId: user.id, name: `${firstName} ${lastName}`, business: businessName, email, emailNorm: em, phone, phoneNorm: ph,
      source: "Built by Nearest", status: "registered", registeredUserId: u.id,
    }).returning();
    await logProspect(row.id, "registered", "Nearest is building their profile for them (with their permission).", user.id);
  }
  await logActivity({ actorUserId: user.id, action: "pro.built_started", targetType: "professional", targetId: u.id, after: { email } });
  revalidatePath("/admin/outreach/build");
  await startBuilding(u.id);
  return {};
}

/** Open a built (unclaimed) profile in the setup pages again. */
export async function editBuiltProfile(form: FormData) {
  await owner();
  const id = str(form, "userId", 40);
  if (!(await buildTarget(id))) redirect(`/admin/outreach/build/${id}`);
  await startBuilding(id, str(form, "step", 20));
}

/** Leave the professional's setup pages and go back to Admin. */
export async function stopBuilding(form: FormData) {
  await owner();
  (await cookies()).delete(BUILD_COOKIE);
  const id = str(form, "userId", 40);
  redirect(/^[0-9a-f-]{36}$/.test(id) ? `/admin/outreach/build/${id}` : "/admin/outreach/build");
}

/**
 * Email the professional their claim link. Opening it, they create a password (8+ characters), sign in, accept the
 * Professional Terms, and their profile goes live. Sending again replaces the earlier link.
 */
export async function sendClaimLink(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await owner();
  const id = str(form, "userId", 40);
  const t = await buildTarget(id);
  if (!t) return { error: "This profile has already been claimed." };
  const { setupSteps } = await import("@/lib/pro");
  const left = (await setupSteps(id)).filter((s) => !s.done && !s.optional && s.key !== "identity");
  if (left.length) return { error: `Finish these steps first: ${left.map((s) => s.label).join(", ")}.` };
  const { enrollmentQuote } = await import("@/lib/enroll");
  const q = await enrollmentQuote(t.p);
  if (!q.ok) return { error: q.reason.replace(/^Your city/, "Their city").replace(/Join the waitlist and we'll tell you/, "They'd join the waitlist —") };
  const { token, hash } = newClaimToken();
  const expires = new Date(Date.now() + CLAIM_DAYS * 86400_000);
  const [row] = await db.update(professionalProfiles).set({ claimTokenHash: hash, claimSentAt: new Date(), claimExpiresAt: expires })
    .where(and(eq(professionalProfiles.userId, id), isNull(professionalProfiles.claimedAt))).returning();
  if (!row) return { error: "This profile has already been claimed." };
  const h = await (await import("next/headers")).headers();
  const base = process.env.APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${base}/pro/claim/${token}`;
  const { sendEmail, emailEnabled } = await import("@/lib/email");
  const who = user.firstName ?? "Nearest";
  const r = await sendEmail({
    to: t.u.email, subject: "Your Nearest profile is ready", eyebrow: "Nearest",
    heading: `${t.u.firstName ?? "Hi"}, your Nearest profile is ready.`,
    lines: [
      `${who} from Nearest set up your professional profile, as you discussed, so students near you can find and book you.`,
      "All you need to do is create a password, then review and accept the Professional Terms. Your profile goes live right after.",
      "Your password just needs 8 or more characters. Next time you can sign in with it, or have a sign-in code emailed to you instead.",
      `This link works once and expires on ${expires.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Chicago" })}.`,
    ],
    button: { label: "Create my password", url: link },
  });
  await logActivity({ actorUserId: user.id, action: "pro.claim_link_sent", targetType: "professional", targetId: id, after: { emailed: r.sent } });
  revalidatePath(`/admin/outreach/build/${id}`);
  revalidatePath("/admin/outreach/build");
  if (!r.sent) return { ok: `${emailEnabled() ? "The email didn't go through" : "Email isn't set up"} — copy this link and send it to them yourself (works once, ${CLAIM_DAYS} days): ${link}` };
  return { ok: `Sent to ${t.u.email}. You can also text them this link (works once, ${CLAIM_DAYS} days): ${link}` };
}
