import { OrgDetail } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../../team";

export const metadata = { title: "Organization", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Org({ params }: { params: Promise<{ id: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { id } = await params;
  return <OutreachShell viewAs={f.viewAs} at="/orgs" title="Organization" name={name} owner={owner}><OrgDetail actor={a} base="/outreach" placeId={id} /></OutreachShell>;
}
