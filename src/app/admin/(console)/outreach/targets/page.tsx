import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { RecruitTargets } from "@/components/RecruitTargets";
import { requireAdmin } from "@/lib/admin";
import { dfwTargets } from "@/lib/recruit-targets";

export const metadata = { title: "Where to recruit" };
export const dynamic = "force-dynamic";

/** The same DFW recruiting dashboard Lead Contributors see. */
export default async function AdminTargets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const [data, sp] = await Promise.all([dfwTargets(), searchParams]);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Where to recruit" />
      <OutreachNav at="targets" />
      <p className="xs muted p">The same dashboard your Lead Contributors see on their Where to recruit page: every DFW city × category against the spots per category per city (Rules &amp; Settings → Growth).</p>
      <RecruitTargets data={data} sp={sp} basePath="/admin/outreach/targets" />
    </>
  );
}
