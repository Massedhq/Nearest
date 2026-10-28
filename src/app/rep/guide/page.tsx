import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";
import { repForUser } from "@/lib/reps";
import { guideFor } from "@/lib/guide";
import { GuideView } from "@/components/GuideView";

export const metadata = { title: "How it works — Nearest sales team" };

/** Sales reps' own "How it works" guide (signed-in reps only). */
export default async function RepGuide() {
  const viewer = await getViewer();
  const rep = await repForUser(viewer?.user?.id);
  if (!rep) redirect("/rep");
  const sections = await guideFor("rep");
  return (
    <div className="scr">
      <div className="body" style={{ maxWidth: 720, margin: "0 auto", width: "100%" }}>
        <Link className="link small" href="/rep">← Back to my dashboard</Link>
        <h1 className="disp h1">How it works</h1>
        <GuideView sections={sections} intro="Everything about being a Nearest sales rep — your links, tracking, campaigns, brand rules and payouts. Tap a question to open it." />
      </div>
    </div>
  );
}
