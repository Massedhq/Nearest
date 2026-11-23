import { TaskDetail } from "@/components/field/TaskViews";
import { ownerField, FieldHead } from "../../shell";

export const metadata = { title: "Task · Field team" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const a = await ownerField();
  const { id } = await params;
  return (<><FieldHead at="/tasks" title="Task" /><TaskDetail actor={a} base="/admin/field" id={id} /></>);
}
