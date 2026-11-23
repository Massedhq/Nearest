import { MapView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Vote map", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VoteMapPage() {
  const f = await assistantField(); const { a, name, owner } = f;
  return <OutreachShell viewAs={f.viewAs} at="/map" title="Vote map" name={name} owner={owner}><MapView actor={a} /></OutreachShell>;
}
