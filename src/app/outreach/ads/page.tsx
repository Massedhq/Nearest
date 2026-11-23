import { AdsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Ads", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Ads({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { a, name, owner } = await assistantField();
  const { edit } = await searchParams;
  return <OutreachShell at="/ads" title="Ads" name={name} owner={owner}><AdsView actor={a} base="/outreach" editId={edit} /></OutreachShell>;
}
