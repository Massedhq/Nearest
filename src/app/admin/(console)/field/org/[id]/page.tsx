import { OrgDetail } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../../shell";

export const metadata = { title: "Organization · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldOrg({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const a = await ownerField();
  const { id } = await params;
  const { saved } = await searchParams;
  return (<><FieldHead at="/orgs" title="Organization & cards" /><OrgDetail actor={a} base="/admin/field" placeId={id} saved={saved} /></>);
}
