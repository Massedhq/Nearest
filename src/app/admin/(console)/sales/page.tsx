import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyLink } from "../founding/CopyLink";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { earningsFor, mainOwnerId, partners, payoutsFor, partnerPerformance, referredPros } from "@/lib/partner";
import { ENTRY, type EntryType } from "@/lib/entry";
import { chicagoNow, money, fmtDate } from "@/lib/time";
import { approvePayout, changePayoutAmount, markPayoutPaid, syncPayments, sendPayoutStripe } from "@/app/admin/enforce-actions";
import Link from "next/link";

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
  const perf = await partnerPerformance();
  const [main, list, e, payouts, s, [count]] = await Promise.all([
    mainOwnerId(), partners(), earningsFor(month), payoutsFor(month), getSettings(),
    db.select({ n: sql<number>`count(*)::int` }).from(professionalProfiles),
  ]);
  const isMain = main === user.id;
  const brought = await referredPros(isMain ? null : user.id);
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
        <span className="xs muted">Pros #1–{(pool - Number(s["partner.nearest_block"])).toLocaleString()}: payments split equally between the {list.length} partners. The last {Number(s["partner.nearest_block"])} of the first {pool.toLocaleString()} go to Nearest. After {pool.toLocaleString()}, each partner earns $8.80 / $13.60 / $17.85 / $26 per $11 / $16 / $21 / $30 payment (members who joined at $10: $8) from pros who used their code.</span>
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
        <span className="eyebrow">{isMain ? "Partner earnings & payouts" : "Your earnings"}</span>
        <table className="tbl">
          <thead><tr><th>Partner</th><th>Code</th><th>Pool share</th><th>From code</th><th>Earned</th><th>Payout</th>{isMain && <th>Send to</th>}{isMain && <th />}</tr></thead>
          <tbody>
            {rows.map((r) => {
              const p = payouts.find((x) => x.partnerId === r.userId);
              const partner = list.find((x) => x.userId === r.userId);
              return (
                <tr key={r.userId} style={{ verticalAlign: "top" }}>
                  <td>{r.name}</td><td className="num">{r.code}</td><td>{money(r.poolShareCents)}</td><td>{money(r.codeCents)} <span className="xs muted">({r.codePros})</span></td><td className="b">{money(r.totalCents)}</td>
                  <td>
                    {p ? <span className={`tag ${p.status === "paid" ? "ok" : "warn"}`}>{p.status === "paid" ? (p.transferId ? "Sent via Stripe" : "Paid") : "Approved"} {money(p.amountCents)}</span> : <span className="tag">Not approved</span>}
                    {p?.note && <div className="xs muted" style={{ marginTop: 4 }}>{p.note}</div>}
                  </td>
                  {isMain && (
                    <td className="small">
                      {partner?.stripeReady ? (
                        <><div className="b">Stripe</div><div>{partner.payoutDestination ?? "Bank or debit card"}</div></>
                      ) : partner?.payoutMethod ? (
                        <><div className="b">{partner.payoutMethod}</div><div>{partner.payoutHandle}</div>{partner.payoutNote && <div className="xs muted">{partner.payoutNote}</div>}</>
                      ) : <span className="tag warn">Not added yet</span>}
                    </td>
                  )}
                  {isMain && (
                    <td style={{ minWidth: 220 }}>
                      {!p && (
                        <details><summary className="btn sm" style={{ listStyle: "none", display: "inline-flex" }}>Approve</summary>
                          <div style={{ marginTop: 8 }}>
                            <ActionForm action={approvePayout} submitLabel="Approve payout" buttonClass="btn sm">
                              <input type="hidden" name="month" value={month} /><input type="hidden" name="partnerId" value={r.userId} />
                              <div className="field"><label htmlFor={`a_${r.userId}`}>Amount ($)</label><input id={`a_${r.userId}`} name="amount" inputMode="decimal" defaultValue={(r.totalCents / 100).toFixed(2)} /></div>
                              <div className="field"><label htmlFor={`r_${r.userId}`}>Reason if different</label><input id={`r_${r.userId}`} name="reason" placeholder="Optional" /></div>
                            </ActionForm>
                          </div>
                        </details>
                      )}
                      {p?.status === "approved" && (
                        <div className="col" style={{ gap: 6 }}>
                          {partner?.stripeReady ? (
                            <ActionForm action={sendPayoutStripe} submitLabel={`Send ${money(p.amountCents)} via Stripe`} buttonClass="btn sm"><input type="hidden" name="id" value={p.id} /></ActionForm>
                          ) : null}
                          <form action={markPayoutPaid}><input type="hidden" name="id" value={p.id} /><button className={partner?.stripeReady ? "link small" : "btn sm"} type="submit">{partner?.stripeReady ? "Paid another way — mark paid" : "Mark paid"}</button></form>
                          <details><summary className="link small" style={{ cursor: "pointer" }}>Change amount</summary>
                            <div style={{ marginTop: 8 }}>
                              <ActionForm action={changePayoutAmount} submitLabel="Save amount" buttonClass="btn ghost sm">
                                <input type="hidden" name="id" value={p.id} />
                                <div className="field"><label htmlFor={`c_${p.id}`}>Amount ($)</label><input id={`c_${p.id}`} name="amount" inputMode="decimal" defaultValue={(p.amountCents / 100).toFixed(2)} /></div>
                                <div className="field"><label htmlFor={`cr_${p.id}`}>Reason</label><input id={`cr_${p.id}`} name="reason" required /></div>
                              </ActionForm>
                            </div>
                          </details>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="xs muted">Earnings come from membership payments professionals actually made. {isMain ? "Partners with a connected bank account or debit card are paid with Send via Stripe; others, send it yourself and tap Mark paid. Every approval, change and payment is logged." : "Avy approves and sends payouts. "}
          {!isMain && <Link className="link xs" href="/admin/profile">{me && list.find((x) => x.userId === me.userId)?.payoutMethod ? "Update where you get paid" : "Add where you want to be paid"}</Link>}
        </span>
      </div>

      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <span className="eyebrow">{isMain ? "Partner performance" : "Your performance"}</span>
        <table className="tbl">
          <thead><tr><th>Partner</th><th>Invitations sent</th><th>Accepted</th><th>Pros signed up</th><th>Paid entry</th><th>Live</th><th>This month</th></tr></thead>
          <tbody>
            {(isMain ? perf : perf.filter((p) => p.userId === user.id)).map((p) => (
              <tr key={p.userId}>
                <td className="b">{p.name}</td>
                <td>{p.sent}</td>
                <td>{p.accepted}{p.sent ? <span className="xs muted"> ({Math.round((p.accepted / p.sent) * 100)}%)</span> : null}</td>
                <td>{p.signedUp}</td><td>{p.paid}</td><td>{p.live}</td>
                <td className="small">{p.sentMonth} sent • {p.signedUpMonth} signed up • {p.paidMonth} paid</td>
              </tr>
            ))}
          </tbody>
        </table>
        <span className="xs muted">Counts professionals who came in through each partner&apos;s invitations or partner link. &ldquo;Live&rdquo; means approved, paid, ID-verified and payouts set up. {isMain ? "Kisses and Kee each see only their own row." : ""}</span>
      </div>

      <div className="card" style={{ gap: 12, overflowX: "auto" }}>
        <div className="row between"><span className="eyebrow">{isMain ? "Professionals brought in by partners" : "Professionals you brought in"}</span><span className="xs muted">{brought.length} total</span></div>
        {brought.length === 0 ? (
          <span className="small muted">No one yet. Share your partner link or send invitations from First In — every professional who joins through them shows here.</span>
        ) : (
          <table className="tbl">
            <thead><tr><th>Professional</th>{isMain && <th>Partner</th>}<th>City</th><th>How they came in</th><th>Signed up</th><th>Entry</th><th>Status</th></tr></thead>
            <tbody>
              {brought.map((b) => (
                <tr key={b.userId}>
                  <td className="b"><Link href={`/admin/professionals/${b.userId}`} style={{ color: "inherit" }}>{b.business ?? `${b.first ?? ""} ${b.last?.[0] ?? ""}.`}</Link></td>
                  {isMain && <td>{[b.partnerFirst, b.partnerLast].filter(Boolean).join(" ") || "—"}</td>}
                  <td>{b.city ?? "—"}</td>
                  <td className="small">{b.viaInvite ? `Invitation ${b.viaInvite}` : "Partner link"}</td>
                  <td>{fmtDate(b.signedUp, { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="small">{b.paidAt && b.entryType && b.entryType in ENTRY ? `${ENTRY[b.entryType as EntryType].short} • ${money(b.rate ?? 0)}` : "Not paid yet"}</td>
                  <td><span className={`tag ${b.isLive ? "ok" : ""}`}>{b.isLive ? "Live" : b.paidAt ? "Setting up" : "Signed up"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <span className="xs muted">Credit comes from your partner link (remembered for 30 days after they open it) or invitations you create in First In. Once credited, it&apos;s permanent.</span>
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
