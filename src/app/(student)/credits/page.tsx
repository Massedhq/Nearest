import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "My credits" };

export default function Page() {
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My credits</div><span className="sp" /></div>
      <div className="body"><ComingSoon title="My credits" phase="a later phase" /></div>
      <Tabs kind="student" active="Credits" />
    </div>
  );
}
