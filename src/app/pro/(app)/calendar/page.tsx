import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Calendar" };

export default function Page() {
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Calendar</div><span className="sp" /></div>
      <div className="body"><ComingSoon title="Calendar" phase="a later phase" /></div>
      <Tabs kind="pro" active="Calendar" />
    </div>
  );
}
