import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyLink } from "../founding/CopyLink";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { earningsFor, mainOwnerId, partners, payoutsFor } from "@/lib/partner";
import { chicagoNow, money } from "@/lib/time";
import { approvePayout, markPayoutPaid, syncPayments } from "@/app/admin/enforce-actions";

export const metadata = { title: "Sales Track" };

function lastMonths(n: number) {
  const [y, m] = chicagoNow().date.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
const label = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function Sales({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { user } = await requireAdmin();
  const months = lastMonths(12);
  const q = (await searchParams).month;
  const month = q && months.includes(q) ? q : months[0];
  const [main, list, e, payouts, s, [count]] = await Promise.all([
    mainOwnerId(), partners(), earningsFor(month), payoutsFor(month), getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles),
  ]);
  const isMain = main === user.id;
  const pool = Number(s["partner.pool_size"]);
  const me = list.find((p) => p.userId === user.id);
  const rows = isMain ? e.perPartner : e.perPartner.filter((p) => p.userId === user.id);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const pct = Math.min(100, Math.round((count.n / pool) * 100));

  return (
    <>
      <AdminHead eyebrow={isMain ? "Main owner view — all partners" : "Your earnings and the group total"} title="Sales Track" />
      <div className="card" style={{ gap: 12 }}>
        <div className="row between"><span className="eyebrow">Group progress</span><span className={`tag ${count.n >= pool ? "ok" : ""}`}>{count.n >= pool ? "Personal codes phase" : "Shared pool phase"}</span></div>
        <div className="row" style={{ gap: 18 }}><span className="stat" style={{ fontSize: 48 }}>{count.n.toLocaleString()} / {pool.toLocaleString()}</span><span className="small muted">professionals signed up</span></div>
        <div className="bar gold"><i style={{ width: `${pct}%` }} /></div>
        <span className="xs muted">Pros #1–{(pool - Number(s["partner.nearest_block"])).toLocaleString()}: payments split equally between the {list.length} partners. The last {Number(s["partner.nearest_block"])} of the first {pool.toLocaleString()} go to Nearest. After {pool.toLocaleString()}, each partner earns $8 / $17 / $26 per $10 / $20 / $30 payment from pros who used their code.</span>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {months.slice(0, 6).map((m) => <a key={m} className={`chip${m === month ? " on" : ""}`} href={`/admin/sales?month=${m}`}>{label(m)}</a>)}
      </div>

      <div className="kpis k3">
        <div className="card" style={{ gap: 6 }}><span className="xs muted">Shared pool — {label(month)}</span><span className="stat">{money(e.poolCents)}</span><span className="xs muted">{money(e.perPartner[0]?.poolShareCents ?? 0)} each</span></div>
        {isMain && <div className="card" style={{ gap: 6 }}><span className="xs muted">Kept by Nearest</span><span className="stat">{money(e.nearestCents)}</span></div>}
        {isMain && <div className="card" style={{ gap: 6 }}><span className="xs muted">All membership payments</span><span className="stat">{money(e.totalCents)}</span></div>}
        {!isMain && me && <div className="card pearl" style={{ gap: 6 }}><span className="xs muted">Your total — {label(month)}</span><span className="stat">{money(rows[0]?.totalCents ?? 0)}</span></div>}
      </div>

      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">{isMain ? "Partner earnings" : "Your earnings"}</span>
        <table className="tbl">
          <thead><tr><th>Partner</th><th>Code</th><th>Pool share</th><th>From your code</th><th>Pros on code</th><th>Total</th><th>Payout</th>{isMain && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = payouts.find((x) => x.partnerId === r.userId);
              return (
                <tr key={r.userId}>
                  <td>{r.name}</td><td className="num">{r.code}</td><td>{money(r.poolShareCents)}</td><td>{money(r.codeCents)}</td><td>{r.codePros}</td><td className="b">{money(r.totalCents)}</td>
                  <td>{p ? <span className={`tag ${p.status === "paid" ? "ok" : "warn"}`}>{p.status === "paid" ? "Paid" : "Approved"} {money(p.amountCents)}</span> : <span className="tag">Not approved</span>}</td>
                  {isMain && (
                    <td>
                      {!p && r.totalCents > 0 && <form action={approvePayout}><input type="hidden" name="month" value={month} /><input type="hidden" name="partnerId" value={r.userId} /><button className="btn sm" type="submit">Approve</button></form>}
                      {p?.status === "approved" && <form action={markPayoutPaid}><input type="hidden" name="id" value={p.id} /><button className="btn ghost sm" type="submit">Mark paid</button></form>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="xs muted">Earnings come from membership payments pros actually made (free-trial months earn nothing). {isMain ? "Only you can approve payouts." : "Avy approves payouts."}</span>
      </div>

      {me?.code && (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Your partner link</span>
          <span className="small muted">Pros who sign up with this link (or from an invitation you create) are credited to you.</span>
          <CopyLink url={`${origin}/pro/sign-up?ref=${me.code}`} />
        </div>
      )}
      {isMain && (
        <div className="card" style={{ gap: 10 }}>
          <span className="eyebrow">Membership payments</span>
          <span className="small muted">Payments arrive automatically from Stripe once the webhook is set up. You can also pull them now.</span>
          <ActionForm action={syncPayments} submitLabel="Sync payments from Stripe" buttonClass="btn ghost sm"><span /></ActionForm>
        </div>
      )}
    </>
  );
}
