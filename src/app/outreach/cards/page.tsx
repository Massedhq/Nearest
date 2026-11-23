import { CardsView } from "@/components/field/TaskViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Cards", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const f = await assistantField(); const { a, name, owner } = f;

  return <OutreachShell viewAs={f.viewAs} at="/cards" title="Cards" name={name} owner={owner}><CardsView actor={a} base="/outreach" /></OutreachShell>;
}
