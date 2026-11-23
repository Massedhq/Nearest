import { TasksPage } from "@/components/field/TaskViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Tasks · Field team" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const a = await ownerField();
  const { day } = await searchParams;
  return (<><FieldHead at="/tasks" title="Tasks" /><TasksPage actor={a} base="/admin/field" day={day} /></>);
}
