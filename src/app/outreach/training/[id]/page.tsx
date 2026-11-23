import { TrainingView } from "@/components/field/TaskViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../../team";

export const metadata = { title: "Training", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const f = await assistantField(); const { a, name, owner } = f;
  const { id } = await params;
  return <OutreachShell viewAs={f.viewAs} at="/training" title="Training" name={name} owner={owner}><TrainingView base="/outreach" lessonId={id} userId={f.assistantUserId} canTick={!f.viewAs} ownerId={f.a.ownerId} /></OutreachShell>;
}
