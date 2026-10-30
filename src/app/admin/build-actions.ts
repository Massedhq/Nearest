"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, users, professionalProfiles, prospects, prospectDrafts, categories, cities, cityCounties, counties } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { validName } from "@/lib/validate";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/log";
import { BUILD_COOKIE, buildTarget, managedClerkId, newClaimToken, CLAIM_DAYS } from "@/lib/build-mode";
import type { FormState } from "@/components/ActionForm";
import type { DraftFields } from "@/lib/screenshot-leads";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const STEPS = new Set(["profile", "services", "credentials", "location", "hours", "communication", "portfolio"]);

async function owner() {
  const a = await requireAdmin();
  if (a.role !== "OWNER") throw new Error("Only owners can build profiles.");
  return a;
}

const COOKIE = { path: "/", httpOnly: true, sameSite: "lax" as const, secure: true, maxAge: 60 * 60 * 8 };
async function startBuilding(userId: string, step = "profile") {
  (await cookies()).set(BUILD_COOKIE, userId, COOKIE);
  redirect(`/pro/setup/${STEPS.has(step) ? step : "profile"}`);
}

/**
 * Build a profile: details read from optional screenshots (read on the owner's device, no AI service). Matches the
 * category and city to Nearest's lists and fills in the county, the same way Add from screenshots does.
 */
export async function readBuildDetails(raw: Record<string, unknown>): Promise<{ fields: DraftFields; cityId: number | null; note: string }> {
  await owner();
  const { cleanFields, fillCounty } = await import("@/lib/screenshot-leads");
  const { resolvePlace } = await import("@/lib/outreach");
  const read = await cleanFields({ ...raw, state: raw.state || (raw.city ? "TX" : "") });
  const { fields, from } = await fillCounty({ ...read, state: read.state || "TX" });
  const cityId = await resolvePlace(fields.city, fields.state);
  const missing = [!fields.categoryId && "category", !cityId && "city"].filter(Boolean);
  const note = [
    fields.city && !cityId ? `${fields.city} isn't one of Nearest's cities yet — pick the city they serve.` : "",
    from ? `County filled in from the ${from === "zip" ? `ZIP ${fields.zip}` : "city"}.` : "",
    missing.length ? `Couldn't tell their ${missing.join(" or ")} from the screenshots — choose it below.` : "",
  ].filter(Boolean).join(" ");
  return { fields, cityId, note };
}


/** "Classic full set $85; Brow lamination $60" → services to finish on the Services step (prices kept, length left blank). */
function servicesFromPrices(prices: string, categoryId: number) {
  return prices.split(/[;\n]+/).map((part) => part.trim().match(/^(.{2,60}?)\s*[-–:]?\s*\$\s?(\d{1,4}(?:\.\d{2})?)\b/)).filter((m): m is RegExpMatchArray => Boolean(m))
    .slice(0, 20).map((m) => ({ categoryId, name: m[1].replace(/[\s:–-]+$/, "").trim(), price: String(Number(m[2])), duration: "", adultsOnly: false, photo: null, addFee: true, addons: [] }));
}

/**
 * Admin → Outreach → Build a profile: create the professional's account (no sign-in yet) and open the normal setup
 * pages to finish it for them. Only with their permission. Credited to the owner who builds it. Everything optional
 * that's given — screenshots, their photo, their logo, details read from the screenshots — is saved straight onto
 * the profile so there's as little left to do as possible. (Pictures go straight from the browser to storage: the
 * photo and logo through /api/blob, screenshots through /api/admin/build-screenshots.)
 */
export async function createBuiltProfile(form: FormData): Promise<{ error: string } | { userId: string; next: string; handoff?: "setup" }> {
  const { user } = await owner();
  const firstName = str(form, "firstName", 60), lastName = str(form, "lastName", 60);
  const email = str(form, "email", 160).toLowerCase();
  const phone = str(form, "phone", 30) || null;
  const businessName = str(form, "businessName", 80) || null;
  const prospectId = str(form, "prospectId", 40);
  const categoryId = Number(str(form, "categoryId", 10));
  const cityId = Number(str(form, "cityId", 10));
  if (!validName(firstName) || !validName(lastName)) return { error: "Enter their first and last name." };
  const nameProblem = (await import("@/lib/legal-name")).legalNameProblem(firstName, lastName, businessName, "they"); // legal name ≠ business name
  if (nameProblem) return { error: nameProblem };
  const { normEmail, normPhone, logProspect } = await import("@/lib/outreach");
  if (!normEmail(email)) return { error: "Enter the email address they'll use to sign in — their claim link goes there." };
  if (form.get("permission") !== "on") return { error: "Confirm they gave you permission to set up their profile." };
  const [cat, city] = await Promise.all([
    Number.isInteger(categoryId) && categoryId > 0 ? db.query.categories.findFirst({ where: and(eq(categories.id, categoryId), eq(categories.active, true)) }) : null,
    Number.isInteger(cityId) && cityId > 0 ? db.query.cities.findFirst({ where: and(eq(cities.id, cityId), eq(cities.active, true)) }) : null,
  ]);
  if (!cat) return { error: "Choose the main service category they provide." };
  if (!city) return { error: "Choose the city they provide services in." };
  const owners = (process.env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (owners.includes(email)) return { error: "That email belongs to a Nearest owner. Use the professional's own email." };
  const taken = await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` });
  if (taken && form.get("partner") === "1" && taken.accountType === "professional" && !(await buildTarget(taken.id))) {
    // Already a professional on Nearest: make them a partner on their existing account (no new profile, no link needed).
    const { partnerApplications, partnerPages } = await import("@/db");
    const existing = await db.query.partnerPages.findFirst({ where: eq(partnerPages.userId, taken.id) });
    if (existing) return { error: "They're already a partner — find them under All partner pages." };
    const [app] = await db.insert(partnerApplications).values({ name: `${firstName} ${lastName}`, email, city: city?.name ?? null, state: city?.state ?? null, specialty: cat?.name ?? null, about: "Added by Nearest (existing professional)", status: "approved", decidedAt: new Date(), decidedBy: user.id }).returning();
    await db.insert(partnerPages).values({ userId: taken.id, applicationId: app.id, published: true, addedBy: user.id, partnerApprovedAt: new Date() }).onConflictDoNothing();
    const { inbox } = await import("@/lib/inbox");
    await inbox(taken.id, { kind: "partner", title: "You're a Nearest Partner", body: "Your partner page is ready. Open Business → Partner page to add your links, videos and shop.", href: "/pro/partner" });
    const { sendEmail } = await import("@/lib/email");
    const { SITE_URL } = await import("@/lib/public/site");
    sendEmail({ to: email, subject: "You're a Nearest Partner", eyebrow: "Nearest Partner", heading: `Welcome, ${firstName}.`, lines: ["Your partner page is ready. Sign in to the Nearest pro app and open Business → Partner page to add your links, videos and shop — your link to share is at the top."], button: { label: "Open my partner page", url: `${SITE_URL}/pro/partner` } }).catch(() => {});
    await logActivity({ actorUserId: user.id, action: "partner.added_existing", targetType: "partner_page", targetId: taken.id, after: { email } });
    revalidatePath("/admin/partners");
    return { userId: taken.id, next: `/admin/partners?view=added#p-${taken.id}` };
  }
  if (taken) {
    const built = await buildTarget(taken.id);
    if (built) return { error: "You already started a profile for this email — open it from the list below." };
    return { error: "This email already has a Nearest account. Look them up under Professionals instead." };
  }
  // Their city must have room in their category (same spot rules as a professional who signs up).
  const { slotCount, categoryCap } = await import("@/lib/slots");
  const [n0, cap] = await Promise.all([slotCount(city.id, cat.id), categoryCap(city.id, cat.id)]);
  if (n0 >= cap) return { error: `Enrollment for ${cat.name} in ${city.name} is closed (${cap} of ${cap} spots taken), so they can't be listed there${cap < 10 ? " unless an owner authorizes the additional opening (Outreach → Markets)" : ""}.` };

  // Details read from the screenshots (cleaned again here — nothing from the browser is trusted as-is).
  let extra: Record<string, unknown> = {};
  try { extra = JSON.parse(str(form, "extra", 6000) || "{}"); } catch { extra = {}; }
  const { cleanFields } = await import("@/lib/screenshot-leads");
  const d = await cleanFields({ ...extra, name: `${firstName} ${lastName}`, business: businessName ?? "", email, phone: phone ?? "", categoryId: cat.id, city: city.name, state: city.state });
  const link = await db.query.cityCounties.findFirst({ where: eq(cityCounties.cityId, city.id) });
  const county = link ? await db.query.counties.findFirst({ where: eq(counties.id, link.countyId) }) : null;
  const zip = /^\d{5}$/.test(d.zip) ? d.zip : null;
  const street = d.address ? d.address.split(",")[0].trim().slice(0, 160) : "";
  const { geocode } = await import("@/lib/geo");
  const point = street && zip ? await geocode(street, city.name, zip, city.state).catch(() => null) : null;
  const status = /licen[sc]ed/i.test(d.credentials) && !/pending|student|in school/i.test(d.credentials) ? "licensed" : null;

  const [u] = await db.insert(users).values({
    clerkUserId: managedClerkId(), accountType: "professional", firstName, lastName, email, phone,
  }).returning();
  // Same cohort rule as a professional who signs up on their own (the Terms they accept set their entry).
  const settings = await getSettings();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles);
  const cohort = n < Number(settings["growth.second_cohort_end"]) ? "SECOND" : "STANDARD";
  const services = d.prices ? servicesFromPrices(d.prices, cat.id) : [];
  await db.insert(professionalProfiles).values({
    userId: u.id, cohort, businessName, referredBy: user.id, builtBy: user.id, builtAt: new Date(),
    displayName: `${firstName} ${lastName[0]}.`, slotCategoryId: cat.id, cityId: city.id, countyId: link?.countyId ?? null,
    zip, addressLine: street || null, lat: point?.lat ?? null, lng: point?.lng ?? null, serviceMode: street && zip ? "come_to_me" : null,
    instagram: d.instagram || null, website: d.website || d.bookingLink || null, professionalStatus: status,
    servicesDraft: services.length ? services : null,
  });
  const { ensureProSlug } = await import("@/lib/connections");
  try { await ensureProSlug(u.id); } catch (e) { console.error("build slug", e); }

  // Outreach: link their prospect record (picked, or matched by email / phone) — or add one — and stop recruiting them.
  const asPartner = form.get("partner") === "1"; // Admin → Partner pages → Add a partner (kept separate from Outreach)
  const em = normEmail(email), ph = normPhone(phone);
  const hit = (prospectId && /^[0-9a-f-]{36}$/.test(prospectId) ? await db.query.prospects.findFirst({ where: eq(prospects.id, prospectId) }) : null)
    ?? (em ? await db.query.prospects.findFirst({ where: eq(prospects.emailNorm, em) }) : null)
    ?? (ph ? await db.query.prospects.findFirst({ where: eq(prospects.phoneNorm, ph) }) : null);
  if (hit) {
    await db.update(prospects).set({ status: "registered", registeredUserId: u.id, updatedAt: new Date() }).where(eq(prospects.id, hit.id));
    await logProspect(hit.id, "registered", "Nearest is building their profile for them (with their permission) — recruiting stopped.", user.id);
  } else if (!asPartner) {
    const notes = [d.otherServices && `Also offers: ${d.otherServices}`, d.credentials && `Credentials (as shown): ${d.credentials}`, d.hours && `Hours: ${d.hours}`, d.prices && `Service prices (as listed): ${d.prices}`, d.deposit && `Deposit: ${d.deposit}`].filter(Boolean).join("\n");
    const [row] = await db.insert(prospects).values({
      recruiterId: user.id, name: `${firstName} ${lastName}`, business: businessName, email, emailNorm: em, phone, phoneNorm: ph,
      city: city.name, state: city.state, cityId: city.id, county: county?.name ?? null, category: cat.name, categoryId: cat.id,
      socialUrl: d.instagram ? `instagram.com/${d.instagram}` : d.website || null,
      source: "Built by Nearest", status: "registered", registeredUserId: u.id, notes: notes || null,
    }).returning();
    await logProspect(row.id, "registered", "Nearest is building their profile for them (with their permission).", user.id);
  }
  await logActivity({ actorUserId: user.id, action: "pro.built_started", targetType: "professional", targetId: u.id, after: { email, city: city.name, category: cat.name, partner: asPartner } });
  revalidatePath("/admin/outreach/build");
  if (asPartner) {
    // Approved as a partner right away (no application needed) and kept on Admin → Partner pages.
    const { partnerApplications, partnerPages } = await import("@/db");
    const ig = (await import("@/lib/social")).instagramHandle(str(form, "instagram", 120) || d.instagram || null);
    if (ig) await db.update(professionalProfiles).set({ instagram: ig }).where(eq(professionalProfiles.userId, u.id));
    const [app] = await db.insert(partnerApplications).values({
      name: `${firstName} ${lastName}`, email, instagram: ig, city: city.name, state: city.state, specialty: cat.name,
      about: "Added by Nearest", status: "approved", decidedAt: new Date(), decidedBy: user.id,
    }).returning();
    await db.insert(partnerPages).values({ userId: u.id, applicationId: app.id, published: true, addedBy: user.id }).onConflictDoNothing();
    await logActivity({ actorUserId: user.id, action: "partner.added", targetType: "partner_page", targetId: u.id, after: { email, instagram: ig } });
    revalidatePath("/admin/partners");
  }
  // Builder mode on for this profile; the page then uploads their photo, logo and screenshots, and opens the first
  // setup step that's still missing.
  (await cookies()).set(BUILD_COOKIE, u.id, COOKIE);
  const { setupSteps } = await import("@/lib/pro");
  const next = (await setupSteps(u.id)).find((x) => !x.done && !x.optional && x.key !== "identity")?.key ?? "services";
  // Partner who'll set it all up themselves: the page uploads their photo/logo (still in builder mode), then calls
  // partnerSetupHandoff, which leaves builder mode and emails their setup link.
  if (asPartner && str(form, "handoff", 10) === "setup") return { userId: u.id, next: `/admin/partners?show=added#p-${u.id}`, handoff: "setup" };
  return { userId: u.id, next: `/pro/setup/${next}` };
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
  if (/^[0-9a-f-]{36}$/.test(id) && (await (await import("@/lib/partner-handoff")).addedPartner(id))) redirect(`/admin/partners?show=added#p-${id}`);
  redirect(/^[0-9a-f-]{36}$/.test(id) ? `/admin/outreach/build/${id}` : "/admin/outreach/build");
}

/**
 * Email the professional their claim link. Opening it, they create a password (8+ characters), sign in, accept the
 * Professional Terms, and their profile goes live. Sending again replaces the earlier link.
 */
export async function sendClaimLink(_: FormState, form: FormData): Promise<FormState & { link?: string }> {
  const { user } = await owner();
  const id = str(form, "userId", 40);
  const t = await buildTarget(id);
  if (!t) return { error: "This profile has already been claimed." };
  { const { activeHold } = await import("@/lib/enrollment-holds"); if (await activeHold({ userId: id })) return { error: "They're on enrollment hold (no sign-up within the time limit). Release them in People → Enrollment holds first, then send a new link." }; }
  const { setupSteps } = await import("@/lib/pro");
  const left = (await setupSteps(id)).filter((s) => !s.done && !s.optional && s.key !== "identity");
  if (left.length) return { error: `Finish these steps first: ${left.map((s) => s.label).join(", ")}.` };
  const { builtEnrollmentQuote } = await import("@/lib/enroll");
  const q = await builtEnrollmentQuote(t.p);
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
  const copy = form.get("via") === "copy";
  const r = copy ? { sent: false } : await sendEmail({
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
  await logActivity({ actorUserId: user.id, action: "pro.claim_link_sent", targetType: "professional", targetId: id, after: { emailed: r.sent, copied: copy } });
  revalidatePath(`/admin/outreach/build/${id}`);
  revalidatePath("/admin/outreach/build");
  const lasts = `It works once and lasts ${CLAIM_DAYS} days; any earlier link stopped working.`;
  if (copy) return { link, ok: `Here's their link — copy it and send it to them by text or DM. ${lasts}` };
  if (!r.sent) return { link, ok: `${emailEnabled() ? "The email didn't go through" : "Email isn't set up"} — copy the link and send it yourself. ${lasts}` };
  return { link, ok: `Emailed to ${t.u.email}. You can also copy it and text or DM it. ${lasts}` };
}
