import Link from "next/link";
import { requirePro, setupSteps, nextStep } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { IdCapture } from "@/components/IdCapture";
import { submitProIdDocs } from "@/app/pro/id-actions";

export const metadata = { title: "Verify your identity" };

/** Setup step: photo ID + live selfie, so every professional account is verified and secured before review. */
export default async function IdentityStep({ searchParams }: { searchParams: Promise<{ edit?: string; welcome?: string }> }) {
  const { user, profile: p, building } = await requirePro();
  const sp = await searchParams;
  const edit = sp.edit === "1";
  const steps = await setupSteps(user.id);
  const sent = ["pending", "verified"].includes(p.identityStatus ?? "");
  return (
    <SetupShell steps={steps} current="identity" title="Verify your identity" edit={edit}>
      {sp.welcome === "1" && !building && <div className="card ok small"><span className="b">Terms accepted — your profile is switched on.</span><span>One last thing, for everyone&apos;s safety: verify your ID below. Students can find and book you as soon as Nearest confirms it (usually within a day).</span></div>}
      <p className="muted small p">A photo of your driver&apos;s license or state ID and a live selfie. Nearest checks that they match, to keep your account and your clients safe. It&apos;s not a background check, your ID is never shown publicly, and the photos are deleted once you&apos;re reviewed.</p>
      {building ? (
        <div className="card warn small"><span className="b">The professional does this step themselves.</span><span>The selfie has to be them, live — they&apos;ll be asked after they claim their profile. You can skip it.</span></div>
      ) : p.identityStatus === "verified" ? (
        <div className="card ok small"><span className="b">Your ID is verified.</span></div>
      ) : sent ? (
        <div className="card ok small"><span className="b">Sent — Nearest is checking your ID.</span><span className="muted">You can keep going while we review it.</span></div>
      ) : (
        <>
          {p.identityStatus === "rejected" && <div className="card bad small"><span className="b">Please retake your ID photos</span><span>{p.identityNote ?? "We couldn't confirm your ID from those photos."}</span></div>}
          <IdCapture action={submitProIdDocs} idName="gov_id" idLabel="Photo of your driver's license or state ID" idHint="Your name and photo clearly visible" submitLabel="Send for verification" />
        </>
      )}
      {(sent || building) && <Link className="btn" href={nextStep(steps, "identity")}>Continue</Link>}
    </SetupShell>
  );
}
