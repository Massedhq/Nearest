import Image from "next/image";
import { redirect } from "next/navigation";
import { SignOutButton } from "@clerk/nextjs";
import { getViewer, clerkContact } from "@/lib/viewer";
import { activeHold, recordAttempt, CLOSED_MESSAGE, CLOSED_TITLE } from "@/lib/enrollment-holds";

export const metadata = { title: "Enrollment closed" };
export const dynamic = "force-dynamic";

/** Shown to a professional whose registration is on hold. The visit is recorded for the owners. Nothing is deleted. */
export default async function EnrollmentClosed() {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  const email = viewer.user?.email ?? (await clerkContact())?.email ?? null;
  const hold = await activeHold({ userId: viewer.user?.id, email });
  if (!hold) redirect("/pro/home");
  await recordAttempt(hold, "signed_in", "Opened Nearest for professionals");
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t xs muted">Nearest for professionals</div><span className="sp" /></div>
      <div className="body">
        <Image src="/brand/nearest-monogram.png" alt="" width={84} height={84} />
        <h1 className="disp h2">{CLOSED_TITLE}</h1>
        <div className="card small"><span>{CLOSED_MESSAGE}</span></div>
        <span className="xs muted">Your information is saved — you won&apos;t need to start over when enrollment opens for you.</span>
        <SignOutButton redirectUrl="/pro"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
