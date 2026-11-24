import { MeetingsView } from "@/components/field/TeamRoomViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Meetings · Field team" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await ownerField();
  return (<><FieldHead at="/meetings" title="Meetings" /><MeetingsView actor={a} /></>);
}
