import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, teamAssistants, users } from "@/db";
import { AssistantSignUpForm } from "@/components/AssistantSignUpForm";
import { teamTokenShape } from "@/lib/team";

export const metadata = { title: "Field team invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: an owner's assistant creates their own login from the owner's invitation link. */
export default async function TeamJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = teamTokenShape(token) ? await db.query.teamAssistants.findFirst({ where: eq(teamAssistants.token, token) }) : null;
  const owner = a ? await db.query.users.findFirst({ where: eq(users.id, a.ownerId), columns: { firstName: true } }) : null;
  const { userId } = await auth();
  if (a?.status === "invited" && userId && a.inviteExpiresAt.getTime() > Date.now()) redirect(`/api/team/accept?token=${token}`);
  const problem = !a ? "This invitation link isn't valid. Ask for a new one."
    : a.status === "removed" ? "This invitation is no longer active."
    : a.status === "active" ? "This invitation was already used."
    : a.inviteExpiresAt.getTime() < Date.now() ? "This invitation has expired. Ask for a new one."
    : null;
  const [first, ...rest] = (a?.name ?? "").split(" ");
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <span className="eyebrow">Field team invitation</span>
        <h1 className="disp h2" style={{ textAlign: "center" }}>{a && !problem ? `${first}, welcome to the Nearest field team.` : "Field team invitation"}</h1>
        {problem ? (
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{problem}</span>
            {a?.status === "active" && <Link className="btn" href="/sign-in?redirect_url=/outreach">Sign in</Link>}
          </div>
        ) : (
          <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}>
            <p className="small muted p" style={{ marginTop: 0 }}>Create your own login to work {owner?.firstName ?? "your owner"}&apos;s outreach: organizations, calls and emails, meetings and card drop-offs, pop-up events, professional sign-ups, ad prep and the live vote map.</p>
            <AssistantSignUpForm email={a!.email} token={token} firstName={first ?? ""} lastName={rest.join(" ")} team />
          </div>
        )}
      </div>
    </div>
  );
}
