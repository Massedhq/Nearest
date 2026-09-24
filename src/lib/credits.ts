import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, credits } from "@/db";

/** Balances a student can use with this pro: credit tied to that pro, plus general Nearest credit. */
export async function creditBalances(studentId: string, proId: string) {
  const [pro] = await db.select({ n: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits).where(and(eq(credits.studentId, studentId), eq(credits.proId, proId)));
  const [gen] = await db.select({ n: sql<number>`coalesce(sum(${credits.amountCents}),0)::int` }).from(credits).where(and(eq(credits.studentId, studentId), isNull(credits.proId)));
  return { pro: Math.max(0, pro.n), general: Math.max(0, gen.n) };
}

/** How much credit applies to a price, keeping any card charge at $0 or at least Stripe's $0.50 minimum. */
export function applyCredits(price: number, bal: { pro: number; general: number }) {
  let pro = Math.min(bal.pro, price);
  let general = Math.min(bal.general, price - pro);
  let charge = price - pro - general;
  if (charge > 0 && charge < 50) {
    const giveBack = 50 - charge;
    const g = Math.min(general, giveBack);
    general -= g;
    pro -= Math.min(pro, giveBack - g);
    charge = price - pro - general;
  }
  return { pro, general, charge };
}
