import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { requirePro } from "@/lib/pro";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { cancelModelCall } from "@/app/pro/actions";

export const metadata = { title: "Model calls" };

const TAG: Record<string, string> = { open: "ok", full: "warn", cancelled: "bad", completed: "" };

export default async function ModelCalls() {
  const { user, profile } = await requirePro();
  const calls = await db.select().from(modelCalls).where(eq(modelCalls.userId, user.id)).orderBy(desc(modelCalls.startsAt)).limit(50);
  const now = Date.now();
  return (
    <div className="scr">
      <TopBar title="Model calls" back="/pro/home" />
      <div className="body">
        <p className="muted small p">Model calls show under <span className="b" style={{ color: "#ECE8E1" }}>Model Calls near me</span> for students nearby once student search opens.</p>
        {profile.reviewStatus === "approved" ? (
          <Link className="btn" href="/pro/model-calls/new"><Icon name="plus" /> Create a model call</Link>
        ) : (
          <div className="card warn small"><span>You can publish model calls once your profile is approved.</span></div>
        )}
        {calls.length === 0 && <p className="small muted p">You haven&apos;t created any model calls yet.</p>}
        {calls.map((c) => {
          const past = c.startsAt.getTime() < now;
          const status = past && c.status === "open" ? "completed" : c.status;
          return (
            <div key={c.id} className="card">
              <div className="row between"><span className="b">{c.serviceName}</span><span className={`tag ${TAG[status]}`}>{status}</span></div>
              <div className="small muted">{fmtDate(c.startsAt)} • {fmtTime(c.startsAt)} • {c.durationMin} min</div>
              <div className="row between small"><span>{money(c.priceCents)} model price</span><span>{c.spotsTaken} of {c.spots} spots taken</span></div>
              {c.requirements && c.requirements.length > 0 && <div className="chips">{c.requirements.map((r) => <span key={r} className="tag">{r}</span>)}</div>}
              {!past && (c.status === "open" || c.status === "full") && (
                <form action={cancelModelCall}><input type="hidden" name="id" value={c.id} /><button className="btn danger sm" type="submit" style={{ width: "100%" }}>Cancel model call</button></form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
