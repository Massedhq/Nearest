import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/student";
import { Steps } from "@/components/Steps";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { saveAccess, skipAccess } from "@/app/verify-actions";

export const metadata = { title: "Communication preferences" };

export default async function Access() {
  const { profile } = await requireStudent();
  if (profile.verificationStatus === "unverified") redirect("/verify");
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t" /><form action={skipAccess}><button className="link small" type="submit">Skip</button></form></div>
      <div className="body">
        <Steps at={5} />
        <h1 className="disp h1">How can Nearest work better for you?</h1>
        <p className="muted p">Optional. We only ask how you like to communicate.</p>
        <ActionForm action={saveAccess} submitLabel="Finish">
          <label className="check"><input type="checkbox" name="prefersText" defaultChecked={profile.prefersText} />I prefer text communication</label>
          <label className="check"><input type="checkbox" name="wantsAsl" defaultChecked={profile.wantsAsl} />I&apos;m looking for professionals who communicate in ASL</label>
          <label className="check"><input type="checkbox" name="showAccessibility" defaultChecked={profile.showAccessibility} />Show accessibility options when I search</label>
          <div className="row small top-a" style={{ padding: "4px 4px" }}><Icon name="bell" size="s" /><span className="muted grow">Every Nearest alert is visual and readable — reminders, check-in and messages never depend on calls or sound.</span></div>
        </ActionForm>
      </div>
    </div>
  );
}
