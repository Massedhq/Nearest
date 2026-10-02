import "server-only";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { sendSentBackEmail } from "./email";

/** Email a professional that something was sent back (the in-app notification is sent by the action itself). */
export async function emailSentBack(userId: string, what: string, reason: string, fixLabel: string, path: string) {
  try {
    const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!u?.email) return;
    await sendSentBackEmail({ to: u.email, first: u.firstName ?? "Hi", what, reason, fixLabel, link: `${process.env.APP_URL || "https://www.usenearest.com"}${path}` });
  } catch (e) { console.error("sent-back email", e); }
}
