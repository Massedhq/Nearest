import { MeetingsView } from "@/components/field/TeamRoomViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Meetings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const f = await assistantField(); const { a, name, owner } = f;
  return <OutreachShell viewAs={f.viewAs} at="/meetings" title="Meetings" name={name} owner={owner}><MeetingsView actor={a} /></OutreachShell>;
}
