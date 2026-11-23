import { PopupsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Pop-ups", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Popups({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { edit } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/popups" title="Pop-up events" name={name} owner={owner}><PopupsView actor={a} base="/outreach" editId={edit} /></OutreachShell>;
}
