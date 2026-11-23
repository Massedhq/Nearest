import { OrgsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Organizations", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Orgs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { q } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/orgs" title="Organizations" name={name} owner={owner}><OrgsView actor={a} base="/outreach" q={(q ?? "").slice(0, 80)} /></OutreachShell>;
}
