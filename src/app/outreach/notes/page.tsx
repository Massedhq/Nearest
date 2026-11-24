import { NotesView } from "@/components/field/TeamRoomViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Note Room", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Page() {
  const f = await assistantField(); const { a, name, owner } = f;
  return <OutreachShell viewAs={f.viewAs} at="/notes" title="Note Room" name={name} owner={owner}><NotesView actor={a} /></OutreachShell>;
}
