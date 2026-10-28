import { desc, eq, and, inArray } from "drizzle-orm";
import { db, partnerOrders } from "@/db";
import { requirePro } from "@/lib/pro";
import { sellerAmount } from "@/lib/shop";
import { ActionForm } from "@/components/ActionForm";
import { TopBar } from "@/components/TopBar";
import { markShipped } from "@/app/pro/shop-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Shop orders" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, [string, string]> = { paid: ["Paid", "ok"], shipped: ["Shipped", "ok"], refunded: ["Refunded", ""] };
const PAYOUT: Record<string, string> = { sent: "Paid out", owed: "Waiting for payout setup", waiting: "Paid out when you mark it shipped", none: "" };

/** Partner: every shop order — what to ship (address shown here only), downloads delivered, and what they're paid. */
export default async function ShopOrders() {
  const { user } = await requirePro();
  const orders = await db.select().from(partnerOrders).where(and(eq(partnerOrders.sellerId, user.id), inArray(partnerOrders.status, ["paid", "shipped", "refunded"]))).orderBy(desc(partnerOrders.paidAt)).limit(200);
  const toShip = orders.filter((o) => o.kind === "physical" && o.status === "paid");
  const rest = orders.filter((o) => !(o.kind === "physical" && o.status === "paid"));
  const card = (o: typeof orders[number]) => {
    const [label, cls] = STATUS[o.status] ?? [o.status, ""];
    return (
      <div key={o.id} className="card" style={{ gap: 8 }}>
        <div className="row between" style={{ gap: 8 }}><span className="b">{o.qty > 1 ? `${o.qty} × ` : ""}{o.title}</span><span className={`tag ${cls}`}>{label}</span></div>
        <span className="small muted">#{String(o.number).padStart(5, "0")} · {o.paidAt ? fmtDate(o.paidAt, { month: "short", day: "numeric" }) : ""} · {o.kind === "digital" ? `Digital · downloaded ${o.downloads}×` : "Physical"}</span>
        <span className="small">Paid {money(o.totalCents)}{o.status !== "refunded" ? ` · you get ${money(sellerAmount(o))}` : ""}{PAYOUT[o.payoutStatus] ? ` · ${PAYOUT[o.payoutStatus]}` : ""}</span>
        {o.kind === "physical" && o.shipTo && o.status !== "refunded" && (
          <div className="small" style={{ background: "#0E0E10", border: "1px solid #2A2A2D", borderRadius: 12, padding: 10, lineHeight: 1.5 }}>
            <b>Ship to</b><br />{o.shipTo.name}<br />{o.shipTo.line1}{o.shipTo.line2 ? <>, {o.shipTo.line2}</> : null}<br />{o.shipTo.city}, {o.shipTo.state} {o.shipTo.postal}
          </div>
        )}
        {o.status === "shipped" && o.tracking && <span className="small muted">{o.carrier ? `${o.carrier} ` : ""}tracking {o.tracking}</span>}
        {o.kind === "physical" && o.status === "paid" && (
          <ActionForm action={markShipped} submitLabel="Mark shipped" buttonClass="btn sm" className="col g8">
            <input type="hidden" name="id" value={o.id} />
            <div className="row" style={{ gap: 8 }}>
              <div className="field" style={{ width: 120 }}><label htmlFor={`c-${o.id}`}>Carrier</label><input id={`c-${o.id}`} name="carrier" maxLength={40} placeholder="USPS" /></div>
              <div className="field grow"><label htmlFor={`t-${o.id}`}>Tracking (optional)</label><input id={`t-${o.id}`} name="tracking" maxLength={80} /></div>
            </div>
          </ActionForm>
        )}
      </div>
    );
  };
  return (
    <div className="scr">
      <TopBar title="Shop orders" back="/pro/partner/shop" />
      <div className="body" style={{ gap: 14 }}>
        {orders.length === 0 && <div className="card"><span className="small muted">No orders yet. When someone buys from your shop, it shows here.</span></div>}
        {toShip.length > 0 && <span className="eyebrow">To ship ({toShip.length})</span>}
        {toShip.map(card)}
        {rest.length > 0 && <span className="eyebrow">All orders</span>}
        {rest.map(card)}
        <span className="xs muted">Can&apos;t ship an order? Contact Nearest support before you mark it shipped and we&apos;ll refund the buyer.</span>
      </div>
    </div>
  );
}
