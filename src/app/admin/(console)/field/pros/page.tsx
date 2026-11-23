import { ProsView } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Professionals · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldPros() {
  const a = await ownerField();
  return (<><FieldHead at="/pros" title="Professionals" /><ProsView actor={a} /></>);
}
