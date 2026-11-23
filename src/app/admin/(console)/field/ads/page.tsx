import { AdsView } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Ads · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldAds({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const a = await ownerField();
  const { edit } = await searchParams;
  return (<><FieldHead at="/ads" title="Ads" /><AdsView actor={a} base="/admin/field" editId={edit} /></>);
}
