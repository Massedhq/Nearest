import { asc, eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { getViewer } from "@/lib/viewer";
import { VoteFlow } from "@/components/VoteFlow";
import { AdTags } from "@/components/AdTags";

export const metadata = { title: "Your city. Your choice.", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * Online voting (2026-11-13) — where Facebook, Instagram and Google ads (and direct visitors) land. The SAME vote
 * screens as /card, without the printed-voucher questions; after the vote, the Nearest GRANTED reward wheel. AdTags
 * records the first-party ad visit (UTM tags, click ids) and loads ad tags only after consent.
 */
export default async function OnlineVote() {
  const viewer = await getViewer();
  const states = (await db.selectDistinct({ state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.state))).map((r) => r.state).filter(Boolean) as string[];
  return (
    <div className="scr">
      <VoteFlow states={states.length ? states : ["TX"]} signedIn={viewer?.user?.accountType === "student"} online />
      <AdTags />
    </div>
  );
}
