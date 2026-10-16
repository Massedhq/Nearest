import { redirect } from "next/navigation";
import { getViewer, destinationFor } from "@/lib/viewer";
import { contributorForUser } from "@/lib/lead-contributors";
import { dfwTargets } from "@/lib/recruit-targets";
import { ContributorNav } from "@/components/ContributorNav";
import { RecruitTargets } from "@/components/RecruitTargets";

export const metadata = { title: "Where to recruit", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Lead Contributors: which DFW cities and categories still need professionals, and which are filled (closed). */
export default async function LeadTargets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in?redirect_url=/leads");
  if (!(await contributorForUser(viewer.user?.id))) redirect(viewer.admin ? "/admin/outreach/targets" : await destinationFor(viewer));
  const [data, sp] = await Promise.all([dfwTargets(), searchParams]);
  return (
    <main className="scr" style={{ maxWidth: 1100, padding: "16px 16px 40px", boxSizing: "border-box" }}>
      <div className="col" style={{ gap: 18 }}>
        <ContributorNav at="targets" />
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Dallas–Fort Worth</span>
          <h1 className="disp h1" style={{ margin: 0 }}>Where to recruit</h1>
          <p className="small muted p" style={{ margin: 0 }}>Every DFW city and every service category Nearest offers. Work the cities that still need professionals; when a city&apos;s spots are filled it moves to Filled — closed, so you can move on to the next one. Updated every time you open this page.</p>
        </div>
        <RecruitTargets data={data} sp={sp} basePath="/leads/targets" />
      </div>
    </main>
  );
}
