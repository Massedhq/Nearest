import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer } from "@/lib/viewer";
import { teamAssistantFor } from "@/lib/team";
import { FieldHome } from "@/components/field/FieldViews";
import { OutreachShell } from "@/components/field/OutreachShell";
import { assistantField } from "./team";

export const metadata = { title: "Field team", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PROBLEMS: Record<string, string> = {
  invalid: "That invitation link isn't valid. Ask for a new one.",
  email: "You're signed in with a different email than the one your invitation was made for. Sign out, then sign in or create your login with the invited email.",
  removed: "This access is no longer active.",
  expired: "This invitation has expired. Ask for a new one.",
  account: "This email already has another kind of Nearest account. Ask to be invited with a different email.",
};

export default async function OutreachHome({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const viewer = await getViewer();
  if (e && !(await teamAssistantFor(viewer?.user?.id))) {
    return (
      <div className="scr" style={{ justifyContent: "center" }}>
        <div className="body" style={{ flex: "none", alignItems: "center" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={72} height={72} />
          <h1 className="disp h2">Field team</h1>
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{PROBLEMS[e] ?? "This page is for Nearest's field team. Open the invitation link you were sent."}</span>
            {viewer && <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>}
          </div>
        </div>
      </div>
    );
  }
  const { a, name, owner } = await assistantField();
  return <OutreachShell at="" title="Today" name={name} owner={owner}><FieldHome actor={a} base="/outreach" /></OutreachShell>;
}
