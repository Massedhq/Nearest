import { asc, eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { getViewer } from "@/lib/viewer";
import { VoteFlow } from "@/components/VoteFlow";

export const metadata = { title: "Your city. Your choice.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Where the QR code on every Nearest GRANTED Certificate Voucher goes (and older Nearest Cards). Since 2026-11-11 it's the
 * "YOUR CITY. YOUR CHOICE." vote — no account needed — then the voucher number + code, then account creation.
 */
export default async function CardLanding() {
  const viewer = await getViewer();
  const states = (await db.selectDistinct({ state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.state))).map((r) => r.state).filter(Boolean) as string[];
  return (
    <div className="scr">
      <VoteFlow states={states.length ? states : ["TX"]} signedIn={viewer?.user?.accountType === "student"} />
    </div>
  );
}
