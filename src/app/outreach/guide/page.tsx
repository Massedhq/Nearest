import { guideFor } from "@/lib/guide";
import { withOwnerName } from "@/lib/team";
import { GuideView } from "@/components/GuideView";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "How it works — Field team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The owner assistant's own "How it works" guide. */
export default async function TeamGuide() {
  const f = await assistantField(); const { name, owner } = f;
  // Never "your owner" — the owner's own name everywhere she reads (owner's rule).
  const say = (x: string) => withOwnerName(x, owner);
  const sections = (await guideFor("team")).map((sec) => ({ ...sec, topics: sec.topics.map((t) => ({ ...t, q: say(t.q), a: t.a.map(say), steps: t.steps?.map(say) })) }));
  return (
    <OutreachShell viewAs={f.viewAs} at="/guide" title="How it works" name={name} owner={owner}>
      <GuideView sections={sections} intro="Everything about working the field team — organizations, calls and drop-offs, cards, pop-ups, professionals and ads. Tap a question to open it." />
    </OutreachShell>
  );
}
