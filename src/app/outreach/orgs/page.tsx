import { OrgsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Organizations", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Orgs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { a, name, owner } = await assistantField();
  const { q } = await searchParams;
  return <OutreachShell at="/orgs" title="Organizations" name={name} owner={owner}><OrgsView actor={a} base="/outreach" q={(q ?? "").slice(0, 80)} /></OutreachShell>;
}
