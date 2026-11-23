import { ProsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Professionals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Pros() {
  const { a, name, owner } = await assistantField();
  return <OutreachShell at="/pros" title="Professionals" name={name} owner={owner}><ProsView actor={a} /></OutreachShell>;
}
