import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { GuideView } from "@/components/GuideView";
import { requirePro } from "@/lib/pro";
import { guideFor } from "@/lib/guide";

export const metadata = { title: "How Nearest works" };

export default async function ProGuide() {
  await requirePro();
  const sections = await guideFor("pro");
  return (
    <div className="scr">
      <TopBar title="How Nearest works" back="/pro/business" />
      <div className="body">
        <h1 className="disp h1">How Nearest works</h1>
        <GuideView sections={sections} intro="Everything you can do as a Nearest professional — going live, your calendar, Model Calls, appointments and getting paid. Tap a question to open it." />
      </div>
      <Tabs kind="pro" active="Business" />
    </div>
  );
}
