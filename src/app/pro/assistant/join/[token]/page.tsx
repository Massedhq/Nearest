import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, partnerAssistants, professionalProfiles } from "@/db";
import { AssistantSignUpForm } from "@/components/AssistantSignUpForm";
import { assistantTokenShape } from "@/lib/assistants";

export const metadata = { title: "Assistant invitation", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: a partner's assistant creates their own login from the partner's invitation link. */
export default async function AssistantJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = assistantTokenShape(token) ? await db.query.partnerAssistants.findFirst({ where: eq(partnerAssistants.token, token) }) : null;
  const biz = a ? await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, a.partnerId), columns: { businessName: true, displayName: true } }) : null;
  const who = biz?.businessName || biz?.displayName || "a Nearest Partner";
  const { userId } = await auth();
  if (a?.status === "invited" && userId && a.inviteExpiresAt.getTime() > Date.now()) redirect(`/api/assistant/accept?token=${token}`);
  const problem = !a ? "This invitation link isn't valid. Ask the professional for a new one."
    : a.status === "removed" ? "This invitation is no longer active."
    : a.status === "active" ? "This invitation was already used."
    : a.inviteExpiresAt.getTime() < Date.now() ? "This invitation has expired. Ask the professional to send a new one."
    : null;
  const [first, ...rest] = (a?.name ?? "").split(" ");
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <span className="eyebrow">Assistant invitation</span>
        <h1 className="disp h2" style={{ textAlign: "center" }}>{a && !problem ? `${first}, help run ${who} on Nearest.` : "Assistant invitation"}</h1>
        {problem ? (
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{problem}</span>
            {a?.status === "active" && <Link className="btn" href="/sign-in?redirect_url=/pro/assistant">Sign in</Link>}
          </div>
        ) : (
          <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}>
            <p className="small muted p" style={{ marginTop: 0 }}>Create your own login. You&apos;ll be able to post Model Calls, update services and prices, add photos, edit the partner page, see appointments and message clients for {who}. You won&apos;t see payouts, earnings or account settings.</p>
            <AssistantSignUpForm email={a!.email} token={token} firstName={first ?? ""} lastName={rest.join(" ")} />
          </div>
        )}
      </div>
    </div>
  );
}
