import { OrgsView } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Organizations · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldOrgs({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const a = await ownerField();
  const { q } = await searchParams;
  return (<><FieldHead at="/orgs" title="Organizations & cards" simple={!a.main} /><OrgsView actor={a} base="/admin/field" q={(q ?? "").slice(0, 80)} /></>);
}
