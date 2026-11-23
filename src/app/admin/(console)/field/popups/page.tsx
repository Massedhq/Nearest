import { PopupsView } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Pop-ups · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldPopups({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const a = await ownerField();
  const { edit } = await searchParams;
  return (<><FieldHead at="/popups" title="Pop-up events" /><PopupsView actor={a} base="/admin/field" editId={edit} /></>);
}
