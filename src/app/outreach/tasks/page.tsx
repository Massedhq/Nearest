import { TasksPage } from "@/components/field/TaskViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Tasks", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { day } = await searchParams;
  return <OutreachShell viewAs={f.viewAs} at="/tasks" title="Tasks" name={name} owner={owner}><TasksPage actor={a} base="/outreach" day={day} /></OutreachShell>;
}
