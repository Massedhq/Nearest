import { requirePro } from "@/lib/pro";
import { openInbox } from "@/lib/inbox-page";
import { TopBar } from "@/components/TopBar";
import { InboxList } from "@/components/Inbox";
import { PhoneAlerts } from "@/components/PhoneAlerts";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function ProNotifications() {
  const { user, building } = await requirePro();
  const items = await openInbox(user.id);
  return (
    <div className="scr">
      <TopBar title="Notifications" back="/pro/home" />
      <div className="body">{!building && <PhoneAlerts />}<InboxList items={items} /></div>
    </div>
  );
}
