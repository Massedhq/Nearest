import "server-only";
import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db, professionalProfiles, users } from "@/db";
import { setupSteps } from "./pro";
import { sendFinishSetupEmail } from "./email";

/** Pros who joined but haven't submitted their profile: 1 day after joining, then 2 and 4 days after the previous reminder (then stop). */
const AFTER_HOURS = [24, 48, 96];

export async function remindUnfinishedSetup() {
  const base = process.env.APP_URL || "https://www.usenearest.com";
  let sent = 0;
  const handled = new Set<string>();
  for (let step = 0; step < AFTER_HOURS.length; step++) {
    const due = await db.select({ p: professionalProfiles, u: users }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId))
      .where(and(
        isNotNull(professionalProfiles.entryPaidAt), inArray(professionalProfiles.reviewStatus, ["draft", "rejected"]),
        eq(professionalProfiles.setupReminders, step),
        lt(step === 0 ? professionalProfiles.entryPaidAt : professionalProfiles.setupRemindedAt, sql`now() - make_interval(hours => ${AFTER_HOURS[step]}::int)`),
      )).limit(100);
    for (const { p, u } of due) {
      if (handled.has(p.userId)) continue; // one reminder per person per run
      handled.add(p.userId);
      const [claimed] = await db.update(professionalProfiles).set({ setupReminders: step + 1, setupRemindedAt: new Date() })
        .where(and(eq(professionalProfiles.userId, p.userId), eq(professionalProfiles.setupReminders, step))).returning();
      if (!claimed) continue;
      try {
        const left = (await setupSteps(p.userId)).filter((s) => !s.done && !s.optional).length || 1;
        const { inbox } = await import("./inbox");
        await inbox(u.id, { kind: "setup_reminder", title: "Finish setting up your profile", body: `You're ${left} step${left === 1 ? "" : "s"} away — everything so far is saved.`, href: "/pro/home" });
        if (u.email) await sendFinishSetupEmail({ to: u.email, first: u.firstName ?? "Hi", left, link: `${base}/pro/home`, last: step === AFTER_HOURS.length - 1 });
        sent++;
      } catch (e) { console.error("setup reminder", e); }
    }
  }
  return sent;
}
