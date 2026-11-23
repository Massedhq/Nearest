import { ProsView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Professionals", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Pros() {
  const f = await assistantField(); const { a, name, owner } = f;
  return <OutreachShell viewAs={f.viewAs} at="/pros" title="Professionals" name={name} owner={owner}><ProsView actor={a} /></OutreachShell>;
}
