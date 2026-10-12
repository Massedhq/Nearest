import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, studentIdDocs } from "@/db";
import { requireStudent, verifyStep } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { EnrollmentProofCapture } from "@/components/EnrollmentProofCapture";
import { NO_ID_LABEL } from "@/lib/enrollment-proof";

export const metadata = { title: "Proof of enrollment" };

/** "My school does not issue student IDs" — also where students land when Nearest asks for a clearer document. */
export default async function ProofOfEnrollment() {
  const { user, profile } = await requireStudent();
  const step = await verifyStep(user.id, profile);
  if (step !== "/verify/id" && step !== "/verify/finish") redirect(step ?? "/home");
  const selfie = await db.query.studentIdDocs.findFirst({ where: and(eq(studentIdDocs.userId, user.id), eq(studentIdDocs.kind, "selfie")), columns: { kind: true } });
  return (
    <div className="scr">
      <TopBar title="Get Verified" back={step} />
      <div className="body">
        <h1 className="disp h1">{NO_ID_LABEL}</h1>
        {profile.clearerProofRequestedAt && profile.reviewNote && (
          <div className="card warn small" style={{ gap: 4 }}>
            <span className="b">Nearest needs a clearer document</span>
            <span>{profile.reviewNote}</span>
            <span className="muted">Your selfie is saved — just upload the document again.</span>
          </div>
        )}
        <EnrollmentProofCapture needSelfie={!selfie} />
        <div className="card small"><div className="row top-a"><Icon name="lock" size="s" /><span className="grow muted">Your document is private. Only Nearest reviewers can see it, and it&apos;s deleted as soon as your review is finished. Once approved, you have the same access as students verified with a school ID.</span></div></div>
      </div>
    </div>
  );
}
