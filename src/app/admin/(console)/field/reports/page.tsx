import { ReportsView } from "@/components/field/TaskViews";
import { ownerField, FieldHead } from "../shell";

export const metadata = { title: "Reports · Field team" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const a = await ownerField();

  return (<><FieldHead at="/reports" title="Reports" /><ReportsView actor={a} base="/admin/field" /></>);
}
