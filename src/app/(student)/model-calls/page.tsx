import Link from "next/link";
import { requireVerifiedStudent } from "@/lib/student";
import { openModelCalls } from "@/lib/search";
import { ModelCallCard } from "@/components/ModelCallCard";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "Model Calls" };

export default async function ModelCallsPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await requireVerifiedStudent();
  const { area: mode } = await searchParams;
  const calls = await openModelCalls(area, mode);
  return (
    <div className="scr">
      <TopBar title="Model Calls" back="/home" />
      <div className="body">
        <h1 className="disp h1">Model Calls near me</h1>
        <p className="muted small p">Professionals practicing new techniques or building their portfolio, often at a lower price.</p>
        <div className="chips">
          <Link className={`chip${!mode ? " on" : ""}`} href="/model-calls">{area?.city ?? "My"} area</Link>
          <Link className={`chip${mode === "city" ? " on" : ""}`} href="/model-calls?area=city">{area?.city ?? "My city"}</Link>
          <Link className={`chip${mode === "all" ? " on" : ""}`} href="/model-calls?area=all">All DFW</Link>
        </div>
        {calls.length === 0 && <p className="small muted p">No open model calls right now. Check back soon.</p>}
        {calls.map((c) => <ModelCallCard key={c.call.id} c={c} />)}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
