import { redirect } from "next/navigation";
import { requireStudent, verifyStep } from "@/lib/student";
import { TopBar } from "@/components/TopBar";
import { SelfieOnlyCapture } from "@/components/IdCapture";
import { Steps } from "@/components/Steps";

export const metadata = { title: "Take your selfie" };

/** No school ID on hand: take the selfie now, finish with the ID or a school email. */
export default async function VerifyLater() {
  const { user, profile } = await requireStudent();
  const step = await verifyStep(user.id, profile);
  if (step !== "/verify/id" && step !== "/verify/finish") redirect(step ?? "/home");
  return (
    <div className="scr">
      <TopBar title="Get Verified" back="/verify/id" />
      <div className="body">
        <Steps at={3} />
        <h1 className="disp h1">No ID with you? No problem.</h1>
        <p className="muted small p">Take your selfie now and your account will be created. Then finish verifying with your school ID later — or right away with your school email.</p>
        <SelfieOnlyCapture />
      </div>
    </div>
  );
}
