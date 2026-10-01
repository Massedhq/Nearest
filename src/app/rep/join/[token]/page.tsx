import Image from "next/image";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, salesReps } from "@/db";
import { RepSignUpForm } from "@/components/RepSignUpForm";

export const metadata = { title: "Join the Nearest sales team" };

export default async function RepJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rep = /^[0-9a-f]{48}$/.test(token) ? await db.query.salesReps.findFirst({ where: eq(salesReps.token, token) }) : null;
  const { userId } = await auth();
  if (rep?.status === "invited" && userId) redirect(`/api/rep/accept?token=${token}`); // already signed in → link the invitation

  const problem = !rep ? "This invitation link isn't valid. Ask for a new one."
    : rep.status === "removed" ? "This invitation is no longer active."
    : rep.status === "active" ? "This invitation was already used."
    : rep.inviteExpiresAt.getTime() < Date.now() ? "This invitation has expired. Ask for a new one."
    : null;
  const [first, ...rest] = (rep?.name ?? "").split(" ");

  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none", alignItems: "center" }}>
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <span className="eyebrow">Sales Team Invitation</span>
        <h1 className="disp h2" style={{ textAlign: "center" }}>{rep && !problem ? `${first}, you're invited to the Nearest sales team.` : "Nearest sales team"}</h1>
        {problem ? (
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{problem}</span>
            {rep?.status === "active" && <Link className="btn" href="/sign-in?redirect_url=/rep">Sign in to your dashboard</Link>}
          </div>
        ) : (
          <div className="lightbox" style={{ width: "100%", maxWidth: 420 }}>
            <RepSignUpForm email={rep!.email} token={token} firstName={first ?? ""} lastName={rest.join(" ")} />
          </div>
        )}
      </div>
    </div>
  );
}
