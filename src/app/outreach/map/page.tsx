import { MapView } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "../team";

export const metadata = { title: "Vote map", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function VoteMapPage() {
  const { a, name, owner } = await assistantField();
  return <OutreachShell at="/map" title="Vote map" name={name} owner={owner}><MapView actor={a} /></OutreachShell>;
}
