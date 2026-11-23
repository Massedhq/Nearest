import { EducatorsView } from "@/components/field/TaskViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Video educators", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; send?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { edit, send } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/educators" title="Video educators" name={name} owner={owner}><EducatorsView actor={a} base="/outreach" editId={edit} sendId={send} /></OutreachShell>;
}
