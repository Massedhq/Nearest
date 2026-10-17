import { requirePro } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { UpdateViewer } from "@/components/UpdateViewer";
import { pendingUpdates } from "@/lib/pro-updates";
import { PRO_TERMS_VERSION, proTermsSections } from "@/lib/pro-terms";
import { isOwnerBusiness } from "@/lib/entry";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Updates" };
export const dynamic = "force-dynamic";

/** Business → Updates: anything a professional who joined earlier needs to acknowledge (today: Professional Terms updates). */
export default async function Updates() {
  const { profile: p, viewer } = await requirePro();
  const owner = viewer.admin?.role === "OWNER" || (await isOwnerBusiness(p.userId));
  const list = pendingUpdates(p, owner);
  return (
    <div className="scr">
      <TopBar title="Updates" back="/pro/business" />
      <div className="body">
        <p className="small muted p">Changes to how Nearest works that need your acknowledgment. Open one to read it — it stays open until you acknowledge it.</p>
        {list.length === 0 && (
          <div className="card ok small"><span className="b">You&apos;re all caught up.</span>{p.proTermsAcceptedAt && <span className="muted">You accepted the current Professional Terms (version {p.proTermsVersion}) on {fmtDate(p.proTermsAcceptedAt, { month: "short", day: "numeric", year: "numeric" })}.</span>}</div>
        )}
        {list.map((u) => <UpdateViewer key={u.id} title={u.title} date={u.date} changes={u.changes} sections={proTermsSections()} version={PRO_TERMS_VERSION} />)}
      </div>
    </div>
  );
}
