import { EducatorsView } from "@/components/field/TaskViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Video educators · Field team" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string; send?: string }> }) {
  const a = await ownerField();
  const { edit, send } = await searchParams;
  return (<><FieldHead at="/educators" title="Video educators" /><EducatorsView actor={a} base="/admin/field" editId={edit} sendId={send} /></>);
}
