import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Messages" };

export default function Page() {
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Messages</div><span className="sp" /></div>
      <div className="body"><ComingSoon title="Messages" phase="a later phase" /></div>
      <Tabs kind="pro" active="Messages" />
    </div>
  );
}
