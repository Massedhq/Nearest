import { OrgDetail } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../../shell";

export const metadata = { title: "Organization · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldOrg({ params }: { params: Promise<{ id: string }> }) {
  const a = await ownerField();
  const { id } = await params;
  return (<><FieldHead at="/orgs" title="Organization" /><OrgDetail actor={a} base="/admin/field" placeId={id} /></>);
}
