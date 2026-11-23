import { guideFor } from "@/lib/guide";
import { GuideView } from "@/components/GuideView";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "How it works — Field team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The owner assistant's own "How it works" guide. */
export default async function TeamGuide() {
  const f = await assistantField(); const { name, owner } = f;
  const sections = await guideFor("team");
  return (
    <OutreachShell viewAs={f.viewAs} at="/guide" title="How it works" name={name} owner={owner}>
      <GuideView sections={sections} intro="Everything about working the field team — organizations, calls and drop-offs, cards, pop-ups, professionals and ads. Tap a question to open it." />
    </OutreachShell>
  );
}
