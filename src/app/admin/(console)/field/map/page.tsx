import { MapView } from "@/components/field/FieldViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Vote map · Field team" };
export const dynamic = "force-dynamic";

export default async function FieldMap() {
  const a = await ownerField();
  return (<><FieldHead at="/map" title="Vote map" /><MapView actor={a} /></>);
}
