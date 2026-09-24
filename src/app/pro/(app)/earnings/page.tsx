import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "Earnings" };

export default function Page() {
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">Earnings</div><span className="sp" /></div>
      <div className="body"><ComingSoon title="Earnings" phase="a later phase" /></div>
      <Tabs kind="pro" active="Earnings" />
    </div>
  );
}
