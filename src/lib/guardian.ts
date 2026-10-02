import "server-only";
import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db, studentProfiles, users } from "@/db";
import { sendGuardianEmail } from "./email";

type User = typeof users.$inferSelect;
type Profile = typeof studentProfiles.$inferSelect;

export function ageFromDob(dob: string | null | undefined) {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) a--;
  return a;
}

/** Students 13–17 need their parent or guardian's own approval (by email link) before booking. */
export const needsGuardian = (u: Pick<User, "dateOfBirth">) => {
  const a = ageFromDob(u.dateOfBirth);
  return a !== null && a < 18;
};

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

/** Send (or resend) the approval email. Creates the link the first time. Returns whether it went out. */
export async function sendGuardianInvite(u: User, p: Profile, opts: { force?: boolean } = {}) {
  if (!needsGuardian(u) || !p.guardianEmail || p.guardianStatus === "approved" || p.guardianStatus === "declined") return false;
  if (!opts.force && p.guardianEmailSentAt) return false; // already sent
  const token = p.guardianToken ?? randomBytes(24).toString("hex");
  const res = await sendGuardianEmail({ to: p.guardianEmail, studentFirst: u.firstName ?? "Your student", age: ageFromDob(u.dateOfBirth), link: `${await origin()}/guardian/${token}` });
  await db.update(studentProfiles).set({ guardianToken: token, guardianStatus: "pending", guardianEmailSentAt: res.sent ? new Date() : p.guardianEmailSentAt }).where(eq(studentProfiles.userId, u.id));
  return res.sent;
}

export async function profileByGuardianToken(token: string) {
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const p = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.guardianToken, token) });
  if (!p) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, p.userId) });
  return u ? { profile: p, user: u } : null;
}
