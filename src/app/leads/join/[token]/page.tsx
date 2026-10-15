import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, leadContributors } from "@/db";
import { ContributorSignUpForm } from "@/components/ContributorSignUpForm";
import { contributorTokenShape } from "@/lib/lead-contributors";

export const metadata = { title: "Professional Prospect Entry — invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: a Lead Contributor creates their login from the owner's invitation link. */
export default async function LeadContributorJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = contributorTokenShape(token) ? await db.query.leadContributors.findFirst({ where: eq(leadContributors.token, token) }) : null;
  const { userId } = await auth();
  if (c?.status === "invited" && userId && c.inviteExpiresAt.getTime() > Date.now()) redirect(`/api/leads/accept?token=${token}`);
  const problem = !c ? "This invitation link isn't valid. Ask Nearest for a new one."
    : c.status === "removed" ? "This invitation is no longer active."
    : c.status === "active" ? "This invitation was already used."
    : c.inviteExpiresAt.getTime() < Date.now() ? "This invitation has expired. Ask Nearest for a new one."
    : null;
  const [first, ...rest] = (c?.name ?? "").split(" ");
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <span className="eyebrow">Professional Prospect Entry</span>
        <h1 className="disp h2" style={{ textAlign: "center" }}>{c && !problem ? `${first}, create your Nearest login.` : "Professional Prospect Entry"}</h1>
        {problem ? (
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{problem}</span>
            {c?.status === "active" && <Link className="btn" href="/sign-in?redirect_url=/leads">Sign in</Link>}
          </div>
        ) : (
          <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}>
            <p className="small muted p" style={{ marginTop: 0 }}>You&apos;ll use this login to add professional prospects for Nearest and to create invitation links. It doesn&apos;t give access to anything else in Nearest.</p>
            <ContributorSignUpForm email={c!.email} token={token} firstName={first ?? ""} lastName={rest.join(" ")} />
          </div>
        )}
      </div>
    </div>
  );
}
