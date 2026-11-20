import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { requirePro } from "@/lib/pro";
import { fmtDate, fmtTime, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { cancelModelCall, deleteModelCall } from "@/app/pro/actions";
import { callPhotos, callReady, SHOW_ON_LABEL } from "@/lib/model-calls";

export const metadata = { title: "Model calls" };

const TAG: Record<string, string> = { open: "ok", full: "warn", cancelled: "bad", completed: "" };

export default async function ModelCalls({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { user, profile } = await requirePro({ assistant: true });
  const calls = await db.select().from(modelCalls).where(eq(modelCalls.userId, user.id)).orderBy(desc(modelCalls.startsAt)).limit(50);
  const now = Date.now();
  return (
    <div className="scr">
      <TopBar title="Model calls" back="/pro/home" />
      <div className="body">
        {saved && <div className="card ok small" role="status"><span>Saved.</span></div>}
        <p className="muted small p">Every Model Call needs 1 to 3 inspiration photos of the look. Choose where it shows — the student side, your partner page, or both — each with its own price.</p>
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
              {callPhotos(c).length > 0 && (
                <div className="row" style={{ gap: 6 }}>
                  {callPhotos(c).map((u, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={u} src={u} alt={`Inspiration ${i + 1}`} style={{ width: 64, height: 80, objectFit: "cover", borderRadius: 10 }} />
                  ))}
                  {c.videoUrl && <span className="tag">Video</span>}
                </div>
              )}
              {!callReady(c) && !past && (c.status === "open" || c.status === "full") && <div className="card warn small" style={{ padding: 10 }}><span><span className="b">Hidden</span> — add an inspiration photo so models can see this Model Call.</span></div>}
              <div className="xs muted">{SHOW_ON_LABEL[c.showOn] ?? c.showOn}{c.payMode === "deposit" && c.depositProCents ? ` • Deposit to book ${money(c.depositProCents)}` : " • Pay in full"}</div>
              <div className="small muted">{c.flexible ? `Open time • through ${fmtDate(c.startsAt, { month: "short", day: "numeric" })}` : `${fmtDate(c.startsAt)} • ${fmtTime(c.startsAt)}`} • {c.durationMin} min</div>
              <div className="row between small"><span>{c.showOn !== "partner" && <>Students {money(c.priceCents)}</>}{c.showOn === "both" && " • "}{c.showOn !== "student" && c.publicPriceCents != null && <>Public {money(c.publicPriceCents)}</>}</span><span>{c.spotsTaken} of {c.spots} spots taken</span></div>
              {c.requirements && c.requirements.length > 0 && <div className="chips">{c.requirements.map((r) => <span key={r} className="tag">{r}</span>)}</div>}
              {!past && (c.status === "open" || c.status === "full") && (
                <>
                  <Link className={`btn sm${callReady(c) ? " ghost" : ""}`} href={`/pro/model-calls/${c.id}/edit`} style={{ width: "100%" }}>{callReady(c) ? "Edit" : "Add inspiration photos"}</Link>
                  <form action={cancelModelCall}><input type="hidden" name="id" value={c.id} /><button className="btn danger sm" type="submit" style={{ width: "100%" }}>Cancel model call</button></form>
                </>
              )}
              {(c.status === "cancelled" || past) && <form action={deleteModelCall}><input type="hidden" name="id" value={c.id} /><button className="btn ghost sm" type="submit" style={{ width: "100%" }}>Delete</button></form>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
