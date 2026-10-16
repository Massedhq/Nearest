import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { RecruitTargets } from "@/components/RecruitTargets";
import { requireAdmin } from "@/lib/admin";
import { dfwTargets, whoCounts } from "@/lib/recruit-targets";

export const metadata = { title: "Where to recruit" };
export const dynamic = "force-dynamic";

/** The same DFW recruiting dashboard Lead Contributors see. */
export default async function AdminTargets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const [data, sp, people] = await Promise.all([dfwTargets(), searchParams, whoCounts()]);
  return (
    <>
      <AdminHead eyebrow="Professional Outreach" title="Where to recruit" />
      <OutreachNav at="targets" />
      <p className="xs muted p">The same dashboard your Lead Contributors see on their Where to recruit page: every DFW city × category against the spots per category per city (Rules &amp; Settings → Growth).</p>
      <p className="xs muted p">Every professional counts, however they joined — their own sign-up, any invitation, a sales rep, a partner or a Lead Contributor. A professional takes one spot in their city for each category they have an active service in, from the moment they submit their profile. Open a city to see who&apos;s counted, and who&apos;s there but not counted yet and why. Lead Contributors see the same lists (names and business names only).</p>
      <RecruitTargets data={data} sp={sp} basePath="/admin/outreach/targets" people={people} />
    </>
  );
}
