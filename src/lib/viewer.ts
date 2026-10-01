import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { eq, sql } from "drizzle-orm";
import { db, users, adminMembers, professionalProfiles, type User } from "@/db";

export type Viewer = {
  clerkUserId: string;
  user: User | null;
  admin: { role: string; active: boolean } | null;
};

export async function getViewer(): Promise<Viewer | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = (await db.query.users.findFirst({ where: eq(users.clerkUserId, userId) })) ?? (await relinkByEmail(userId));
  const admin = user
    ? (await db.query.adminMembers.findFirst({ where: eq(adminMembers.userId, user.id) })) ?? null
    : null;
  return { clerkUserId: userId, user, admin: admin && admin.active && ownerAllowed(user, admin.role) ? { role: admin.role, active: admin.active } : null };
}

/**
 * A sign-in we haven't seen before (for example after switching Clerk from test to live keys, which issues new
 * sign-in IDs) is linked to the existing Nearest account with the same VERIFIED email — so owners, pros and
 * students keep their history instead of getting a second, empty account.
 */
async function relinkByEmail(clerkUserId: string) {
  const cu = await currentUser();
  const primary = cu?.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId);
  if (!primary || primary.verification?.status !== "verified") return null;
  const email = primary.emailAddress.toLowerCase();
  const rows = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`);
  if (!rows.length) return null;
  // Prefer an owner account, then the oldest.
  const admins = new Set((await db.select({ id: adminMembers.userId }).from(adminMembers)).map((a) => a.id));
  const pick = [...rows].sort((a, b) => Number(admins.has(b.id)) - Number(admins.has(a.id)) || a.createdAt.getTime() - b.createdAt.getTime())[0];
  const [linked] = await db.update(users).set({ clerkUserId, updatedAt: new Date() }).where(eq(users.id, pick.id)).returning();
  return linked ?? null;
}

const mainOwnerEmail = () => (process.env.MAIN_OWNER_EMAIL ?? "").trim().toLowerCase();

/**
 * Owner access is checked on every request, not just remembered:
 * - the account's email must be in OWNER_EMAILS, and
 * - the account must be an owner account, not a professional or student account.
 * The main owner (MAIN_OWNER_EMAIL) can never be locked out by the second rule.
 * Nothing is deleted — fixing OWNER_EMAILS restores access immediately.
 */
export function ownerAllowed(user: User | null, role: string) {
  if (role !== "OWNER") return true;
  const email = user?.email?.toLowerCase() ?? "";
  if (!email || !ownerEmails().includes(email)) return false;
  if (email === mainOwnerEmail()) return true;
  return user?.accountType === "staff";
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Pulls verified phone/email off the Clerk user so our row always mirrors what Clerk verified. */
export async function clerkContact() {
  const cu = await currentUser();
  if (!cu) return null;
  const email = cu.primaryEmailAddress;
  const phone = cu.primaryPhoneNumber;
  const now = new Date();
  return {
    clerkUser: cu,
    email: email?.emailAddress?.toLowerCase() ?? null,
    emailVerifiedAt: email?.verification?.status === "verified" ? now : null,
    phone: phone?.phoneNumber ?? null,
    phoneVerifiedAt: phone?.verification?.status === "verified" ? now : null,
    door: (cu.unsafeMetadata?.door as string | undefined) ?? null,
    repToken: (cu.unsafeMetadata?.repToken as string | undefined) ?? null,
    invite: (cu.unsafeMetadata?.invite as string | undefined) ?? null,
    dob: (cu.unsafeMetadata?.dob as string | undefined) ?? null,
    ref: (cu.unsafeMetadata?.ref as string | undefined) ?? null,
    guardianEmail: (cu.unsafeMetadata?.guardianEmail as string | undefined)?.slice(0, 120) ?? null,
    guardianConsent: cu.unsafeMetadata?.guardianConsent === true,
    typedPhone: (cu.unsafeMetadata?.phone as string | undefined)?.slice(0, 30) || null,
  };
}

/**
 * First sign-in by an email listed in OWNER_EMAILS: make sure a users row exists
 * (as staff unless they already have a student/pro account) and grant OWNER.
 */
export async function ensureOwner(viewer: Viewer | null): Promise<Viewer | null> {
  if (!viewer || viewer.admin) return viewer;
  const list = ownerEmails();
  if (!list.length) return viewer;
  const c = await clerkContact();
  if (!c?.email || !list.includes(c.email) || !c.emailVerifiedAt) return viewer;
  // Never turn a professional or student account into an owner — not even if its email is on the owner list.
  const isMain = c.email === mainOwnerEmail();
  if (!isMain && (c.door === "pro" || (viewer.user && viewer.user.accountType !== "staff"))) return viewer;

  let user = viewer.user;
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        clerkUserId: viewer.clerkUserId,
        accountType: "staff",
        firstName: c.clerkUser.firstName,
        lastName: c.clerkUser.lastName,
        email: c.email,
        emailVerifiedAt: c.emailVerifiedAt,
        phone: c.phone,
        phoneVerifiedAt: c.phoneVerifiedAt,
      })
      .onConflictDoNothing()
      .returning();
    user = user ?? (await db.query.users.findFirst({ where: eq(users.clerkUserId, viewer.clerkUserId) }))!;
  }
  await db.insert(adminMembers).values({ userId: user.id, role: "OWNER" }).onConflictDoNothing();
  return { ...viewer, user, admin: { role: "OWNER", active: true } };
}

/** Where a signed-in person belongs. */
export async function destinationFor(viewer: Viewer | null): Promise<string> {
  if (!viewer) return "/";
  const { user, admin } = viewer;
  if (admin && (user?.accountType === "professional" || (await hasProBusiness(user?.id)))) return "/workspace";
  if (admin) return "/admin";
  if (user?.accountType === "professional") return "/pro/home";
  if (user?.accountType === "student") return "/home";
  if (user?.accountType === "staff" && (await (await import("./reps")).repForUser(user.id))) return "/rep";
  if (!user) {
    const c = await clerkContact();
    if (c?.door === "rep" && c.repToken) return `/api/rep/accept?token=${encodeURIComponent(c.repToken)}`;
    if (c?.door === "pro") return c.invite ? `/pro/onboarding?invite=${encodeURIComponent(c.invite)}` : "/pro/onboarding";
    if (c?.door === "admin") return "/not-authorized";
    return "/onboarding";
  }
  return "/";
}

export function displayName(u: Pick<User, "firstName" | "lastName"> | null | undefined) {
  if (!u) return "";
  return [u.firstName, u.lastName].filter(Boolean).join(" ");
}

export function initials(u: Pick<User, "firstName" | "lastName"> | null | undefined) {
  if (!u) return "";
  return `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase();
}

/** Owners can run their own professional business on their owner login (set up from Switch workspace). */
export async function hasProBusiness(userId: string | null | undefined) {
  if (!userId) return false;
  return Boolean(await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId), columns: { userId: true } }));
}

/** Can this person use the professional side? Regular pros, or an owner who set up their own business. */
export async function proAccess(viewer: Viewer | null) {
  if (!viewer?.user) return false;
  if (viewer.user.accountType === "professional") return true;
  return Boolean(viewer.admin) && (await hasProBusiness(viewer.user.id));
}
