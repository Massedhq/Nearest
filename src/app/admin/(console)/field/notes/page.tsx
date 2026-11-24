import { NotesView } from "@/components/field/TeamRoomViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Note Room · Field team" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await ownerField();
  return (<><FieldHead at="/notes" title="Note Room" /><NotesView actor={a} /></>);
}
