import "server-only";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, studentProfiles, users } from "@/db";
import { sendFinishVerifyEmail } from "./email";

/** Students who saved a selfie but haven't finished verifying: remind after 1, 3 and 7 days (then stop). */
const AFTER_HOURS = [24, 72, 168];

export async function remindUnfinishedVerification() {
  const base = process.env.APP_URL || "https://www.usenearest.com";
  let sent = 0;
  for (let step = 0; step < AFTER_HOURS.length; step++) {
    const due = await db.select({ p: studentProfiles, u: users }).from(studentProfiles).innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(and(
        isNotNull(studentProfiles.selfieOnlyAt), isNull(studentProfiles.schoolEmailVerifiedAt),
        eq(studentProfiles.verificationStatus, "unverified"), eq(studentProfiles.verifyReminders, step),
        lt(studentProfiles.selfieOnlyAt, sql`now() - make_interval(hours => ${AFTER_HOURS[step]}::int)`),
      )).limit(100);
    for (const { p, u } of due) {
      const [claimed] = await db.update(studentProfiles).set({ verifyReminders: step + 1 })
        .where(and(eq(studentProfiles.userId, p.userId), eq(studentProfiles.verifyReminders, step))).returning();
      if (!claimed) continue; // another run already sent this one
      try {
        const { inbox } = await import("./inbox");
        await inbox(u.id, { kind: "verify_reminder", title: "Finish verifying your account", body: "Verify with your school email or school ID to start browsing and booking.", href: "/verify/finish" });
        if (u.email) await sendFinishVerifyEmail({ to: u.email, first: u.firstName ?? "Hi", link: `${base}/verify/finish`, last: step === AFTER_HOURS.length - 1 });
        sent++;
      } catch (e) { console.error("verify reminder", e); }
    }
  }
  return sent;
}
