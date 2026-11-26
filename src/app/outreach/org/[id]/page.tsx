import { OrgDetail } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../../team";

export const metadata = { title: "Organization", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Org({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { id } = await params;
  const { saved } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/orgs" title="Organization" name={name} owner={owner}><OrgDetail actor={a} base="/outreach" placeId={id} saved={saved} /></OutreachShell>;
}
