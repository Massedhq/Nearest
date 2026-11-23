import { TeamView } from "@/components/field/TeamView";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "My assistants · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldTeam() {
  const a = await ownerField();
  return (<><FieldHead at="/team" title="My assistants" /><TeamView actor={a} /></>);
}
