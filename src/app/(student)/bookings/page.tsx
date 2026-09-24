import { Tabs } from "@/components/Tabs";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata = { title: "My appointments" };

export default function Page() {
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My appointments</div><span className="sp" /></div>
      <div className="body"><ComingSoon title="My appointments" phase="a later phase" /></div>
      <Tabs kind="student" active="Bookings" />
    </div>
  );
}
