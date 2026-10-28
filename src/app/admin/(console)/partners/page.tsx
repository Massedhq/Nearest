import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, partnerApplications, partnerOrders, partnerPages, professionalProfiles, users } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/time";
import { personName } from "@/lib/pro-name";
import { partnerApplyLink, partnerDemoLink, partnerSetupDemoLink, partnerPageLink, partnerPagePath, PARTNER_DEMO_PATH, PARTNER_SETUP_DEMO_PATH, PARTNER_APPLY_PATH } from "@/lib/partners";
import { decidePartnerApplication, setPartnerPagePaused, refundPartnerOrder } from "@/app/admin/partner-actions";
import { sellerAmount } from "@/lib/shop";
import { money } from "@/lib/time";
import { inArray } from "drizzle-orm";

export const metadata = { title: "Partner pages" };
export const dynamic = "force-dynamic";

const TABS = [["new", "New"], ["approved", "Approved"], ["declined", "Declined"]] as const;

/** Owner: share the partner links and demos, review applications, and manage live partner pages. */
export default async function PartnersAdmin({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin({ owner: true });
  const sp = await searchParams;
  const show = TABS.some(([k]) => k === sp.show) ? sp.show! : "new";
  const [apps, counts, pages] = await Promise.all([
    db.select().from(partnerApplications).where(eq(partnerApplications.status, show)).orderBy(desc(partnerApplications.createdAt)).limit(200),
    db.select({ status: partnerApplications.status, n: sql<number>`count(*)::int` }).from(partnerApplications).groupBy(partnerApplications.status),
    db.select({ page: partnerPages, slug: professionalProfiles.slug, displayName: professionalProfiles.displayName, business: professionalProfiles.businessName, review: professionalProfiles.reviewStatus, first: users.firstName, last: users.lastName, email: users.email })
      .from(partnerPages).innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerPages.userId)).innerJoin(users, eq(users.id, partnerPages.userId))
      .orderBy(desc(partnerPages.approvedAt)),
  ]);
  const orders = await db.select({ o: partnerOrders, business: professionalProfiles.businessName, displayName: professionalProfiles.displayName })
    .from(partnerOrders).innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerOrders.sellerId))
    .where(inArray(partnerOrders.status, ["paid", "shipped", "refunded"])).orderBy(desc(partnerOrders.paidAt)).limit(50);
  const sales = orders.filter((r) => r.o.status !== "refunded").reduce((n, r) => n + r.o.totalCents, 0);
  const fees = orders.filter((r) => r.o.status !== "refunded").reduce((n, r) => n + r.o.feeCents, 0);
  const count = (k: string) => counts.find((c) => c.status === k)?.n ?? 0;
  const share: [string, string, string, string][] = [
    ["Partner link (apply)", partnerApplyLink(), PARTNER_APPLY_PATH, "What the partner program is, both demos, and the application form."],
    ["Demo: what clients see", partnerDemoLink(), PARTNER_DEMO_PATH, "Link page, booking profile, booking, Bundle my booking, Model Calls, shop, save to phone."],
    ["Demo: how setup works", partnerSetupDemoLink(), PARTNER_SETUP_DEMO_PATH, "Apply, sign in, page & links, services, portfolio, travel & hours, shop, share."],
    ["Demo: sales rep dashboard", `${partnerDemoLink()}/rep`, `${PARTNER_DEMO_PATH}/rep`, "For prospective reps: sales link, sign-ups, pros by status, city & category, earnings and the Campaign Guide — sample data only."],
  ];

  return (
    <>
      <AdminHead eyebrow="Professional Outreach · owner only" title="Partner pages" />
      <div className="card" style={{ gap: 12 }}>
        <span className="b">Links to share</span>
        {share.map(([label, url, path, note]) => (
          <div key={url} className="col g4" style={{ borderTop: "1px solid #1C1C1F", paddingTop: 10 }}>
            <span className="small b">{label}</span>
            <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="small" style={{ wordBreak: "break-all" }}>{url}</span><span className="row" style={{ gap: 14 }}><CopyButton text={url} /><Link className="link small" href={path} target="_blank">Open</Link></span></div>
            <span className="xs muted">{note}</span>
          </div>
        ))}
        <span className="xs muted">The demos use sample data and fit any phone or computer screen. Applications land here and ring the bell.</span>
      </div>

      <h2 className="disp h3">Applications</h2>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => <a key={k} className={`chip${show === k ? " on" : ""}`} href={`/admin/partners?show=${k}`}>{l} ({count(k)})</a>)}
      </div>
      {apps.length === 0 && <div className="card"><span className="small muted">Nothing here yet.</span></div>}
      {apps.map((a) => (
        <div key={a.id} id={`a-${a.id}`} className="card" style={{ gap: 10 }}>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="b">{a.name}</span><span className="xs muted">{fmtDate(a.createdAt, { month: "short", day: "numeric", year: "numeric" })}</span></div>
          <span className="small">{a.specialty} · {a.city}{a.state ? `, ${a.state}` : ""}{a.instagram ? <> · <a className="link" href={`https://www.instagram.com/${encodeURIComponent(a.instagram)}/`} target="_blank" rel="noopener noreferrer">@{a.instagram}</a></> : null}</span>
          <span className="small">{a.email}</span>
          {a.about && <span className="small muted">{a.about}</span>}
          {a.note && <span className="small"><span className="muted">Note:</span> {a.note}</span>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            {a.status !== "approved" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Approve" buttonClass="btn sm" className="col g4">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="approved" />
              </ActionForm>
            )}
            {a.status !== "declined" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Decline" buttonClass="btn ghost sm" className="row g8">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="declined" />
                <div className="field" style={{ minWidth: 200 }}><label htmlFor={`n-${a.id}`}>Note to them (optional)</label><input id={`n-${a.id}`} name="note" maxLength={500} /></div>
              </ActionForm>
            )}
            {a.status !== "new" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Move back to New" buttonClass="btn ghost sm" className="col g4">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="new" />
              </ActionForm>
            )}
          </div>
        </div>
      ))}

      <h2 className="disp h3">Shop orders</h2>
      <div className="card" style={{ gap: 6 }}>
        <span className="small">Last {orders.length} orders: {money(sales)} sold{fees ? ` · ${money(fees)} Nearest order fees` : ""}. Set the order fee and download limits in Rules &amp; Settings → Partner shop.</span>
      </div>
      {orders.map(({ o, business, displayName }) => (
        <div key={o.id} className="card" style={{ gap: 6 }}>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="b">{o.qty > 1 ? `${o.qty} × ` : ""}{o.title}</span><span className={`tag ${o.status === "refunded" ? "" : "ok"}`}>{o.status === "paid" && o.kind === "physical" ? "Paid — not shipped" : o.status}</span></div>
          <span className="small muted">#{String(o.number).padStart(5, "0")} · {business ?? displayName} · {o.kind} · {o.paidAt ? fmtDate(o.paidAt, { month: "short", day: "numeric" }) : ""} · buyer {o.buyerEmail}</span>
          <span className="small">Paid {money(o.totalCents)} · seller {money(sellerAmount(o))} · payout {o.payoutStatus}</span>
          {o.status !== "refunded" && o.payoutStatus !== "sent" && (
            <ActionForm action={refundPartnerOrder} submitLabel="Refund buyer" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={o.id} /></ActionForm>
          )}
        </div>
      ))}

      <h2 className="disp h3">Partner pages ({pages.length})</h2>
      {pages.length === 0 && <div className="card"><span className="small muted">Approved partners with a professional account show here.</span></div>}
      {pages.map((r) => {
        const name = personName(r.displayName, r.first, r.last);
        const state = r.page.pausedAt ? ["Paused", "bad"] : !r.page.published ? ["Hidden by them", ""] : r.review !== "approved" ? ["Waiting for profile approval", "warn"] : ["Live", "ok"];
        return (
          <div key={r.page.userId} className="card" style={{ gap: 8 }}>
            <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
              <Link className="b" href={`/admin/professionals/${r.page.userId}`}>{name}{r.business ? <span className="muted small"> · {r.business}</span> : null}</Link>
              <span className={`tag ${state[1]}`}>{state[0]}</span>
            </div>
            <span className="small muted">{r.email} · {r.page.links.length} links · {r.page.videos.length} videos</span>
            {r.slug && <div className="row" style={{ gap: 14, flexWrap: "wrap" }}><span className="small" style={{ wordBreak: "break-all" }}>{partnerPageLink(r.slug)}</span><CopyButton text={partnerPageLink(r.slug)} /><Link className="link small" href={partnerPagePath(r.slug)} target="_blank">Open</Link></div>}
            <ActionForm action={setPartnerPagePaused} submitLabel={r.page.pausedAt ? "Resume page" : "Pause page"} buttonClass="btn ghost sm" className="col g4">
              <input type="hidden" name="userId" value={r.page.userId} /><input type="hidden" name="pause" value={r.page.pausedAt ? "0" : "1"} />
            </ActionForm>
          </div>
        );
      })}
    </>
  );
}
