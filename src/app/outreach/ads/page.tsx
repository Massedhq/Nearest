import { AdsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Ads", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Ads({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { edit } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/ads" title="Ads" name={name} owner={owner}><AdsView actor={a} base="/outreach" editId={edit} /></OutreachShell>;
}
