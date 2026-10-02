import { redirect } from "next/navigation";
import { requireStudent, verifyStep } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { IdCapture, SchoolIdOnlyCapture } from "@/components/IdCapture";
import { Icon } from "@/components/Icon";
import { Steps } from "@/components/Steps";

export const metadata = { title: "Verify your ID" };

export default async function VerifyId() {
  const { user, profile } = await requireStudent();
  const step = await verifyStep(user.id, profile);
  if (step !== "/verify/id" && step !== "/verify/finish") redirect(step ?? "/home");
  return (
    <div className="scr">
      <TopBar title="Get Verified" back="/verify" />
      <div className="body">
        <Steps at={3} />
        <h1 className="disp h1">Get Verified</h1>
        <p className="muted small p">A Nearest team member checks that the ID matches your school and your selfie.</p>
        {step === "/verify/finish"
          ? <><p className="small p" style={{ margin: 0 }}>Your selfie is already saved — just add your school ID.</p><SchoolIdOnlyCapture /></>
          : <IdCapture allowLater />}
        <div className="card small"><div className="row top-a"><Icon name="lock" size="s" /><span className="grow muted">Your photos are private. Only Nearest reviewers can see them, and they&apos;re deleted as soon as your review is finished. They never appear on your profile.</span></div></div>
      </div>
    </div>
  );
}
