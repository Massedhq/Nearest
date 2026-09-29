import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { GuideView } from "@/components/GuideView";
import { requireStudent } from "@/lib/student";
import { guideFor } from "@/lib/guide";

export const metadata = { title: "How Nearest works" };

export default async function StudentGuide() {
  await requireStudent();
  const sections = await guideFor("student");
  return (
    <div className="scr">
      <TopBar title="How Nearest works" back="/account" />
      <div className="body">
        <h1 className="disp h1">How Nearest works</h1>
        <GuideView sections={sections} intro="Everything you can do on Nearest — finding a pro, booking, appointment day, credits and more. Tap a question to open it." />
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
