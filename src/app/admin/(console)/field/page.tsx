import { FieldHome } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "./shell";

export const metadata = { title: "Field team" };
export const dynamic = "force-dynamic";

export default async function FieldTeamHome() {
  const a = await ownerField();
  return (<><FieldHead at="" title="Field team" /><FieldHome actor={a} base="/admin/field" /></>);
}
