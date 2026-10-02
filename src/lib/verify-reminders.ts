import "server-only";
import { and, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, studentProfiles, users } from "@/db";
import { sendFinishVerifyEmail } from "./email";

/** Students who saved a selfie but haven't finished verifying: 1 day after, then 2 and 4 days after the previous reminder (then stop). */
const AFTER_HOURS = [24, 48, 96];

export async function remindUnfinishedVerification() {
  const base = process.env.APP_URL || "https://www.usenearest.com";
  let sent = 0;
  const handled = new Set<string>();
  for (let step = 0; step < AFTER_HOURS.length; step++) {
    const due = await db.select({ p: studentProfiles, u: users }).from(studentProfiles).innerJoin(users, eq(users.id, studentProfiles.userId))
      .where(and(
        isNotNull(studentProfiles.selfieOnlyAt), isNull(studentProfiles.schoolEmailVerifiedAt),
        eq(studentProfiles.verificationStatus, "unverified"), eq(studentProfiles.verifyReminders, step),
        lt(step === 0 ? studentProfiles.selfieOnlyAt : studentProfiles.verifyRemindedAt, sql`now() - make_interval(hours => ${AFTER_HOURS[step]}::int)`),
      )).limit(100);
    for (const { p, u } of due) {
      if (handled.has(p.userId)) continue; // one reminder per person per run
      handled.add(p.userId);
      const [claimed] = await db.update(studentProfiles).set({ verifyReminders: step + 1, verifyRemindedAt: new Date() })
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
