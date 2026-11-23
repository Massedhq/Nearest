import { TaskDetail } from "@/components/field/TaskViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../../team";

export const metadata = { title: "Task", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { id } = await params;
  return <OutreachShell viewAs={f.viewAs} at="/tasks" title="Task" name={name} owner={owner}><TaskDetail actor={a} base="/outreach" id={id} /></OutreachShell>;
}
