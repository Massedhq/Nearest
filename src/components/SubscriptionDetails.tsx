import { stripe, stripeEnabled } from "@/lib/stripe";
import { fmtDate, money } from "@/lib/time";

/** Subscription details from Stripe: payment method, "if a payment fails", and invoices. */
export async function SubscriptionDetails({ customerId, subscriptionId, planLabel, standardCents }: { customerId: string | null; subscriptionId: string | null; planLabel: string; standardCents: number }) {
  let card: string | null = null;
  let invoices: { id: string; date: Date; amount: number; status: string; url: string | null; label: string }[] = [];
  if (stripeEnabled() && customerId) {
    try {
      const sub = subscriptionId ? await stripe().subscriptions.retrieve(subscriptionId, { expand: ["default_payment_method"] }) : null;
      let pm: { card?: { brand: string; last4: string } | null } | null = sub?.default_payment_method && typeof sub.default_payment_method !== "string" ? (sub.default_payment_method as unknown as { card?: { brand: string; last4: string } | null }) : null;
      if (!pm) {
        const c = await stripe().customers.retrieve(customerId, { expand: ["invoice_settings.default_payment_method"] });
        const d = !("deleted" in c && c.deleted) ? (c as { invoice_settings?: { default_payment_method?: unknown } }).invoice_settings?.default_payment_method : null;
        if (d && typeof d !== "string") pm = d as unknown as typeof pm;
      }
      if (pm?.card) card = `${pm.card.brand.charAt(0).toUpperCase()}${pm.card.brand.slice(1)} •••• ${pm.card.last4}`;
      const list = await stripe().invoices.list({ customer: customerId, limit: 12 });
      invoices = list.data.map((i) => ({
        id: i.id ?? "", date: new Date(i.created * 1000), amount: i.amount_paid || i.amount_due, status: i.status ?? "",
        url: i.hosted_invoice_url ?? null, label: i.billing_reason === "subscription_create" ? "First payment" : "Monthly membership",
      }));
    } catch { /* Stripe unavailable — show what we have */ }
  }
  return (
    <>
      <div className="card small" style={{ gap: 8 }}>
        <div className="row between"><span className="muted">Plan locked at signup</span><span className="b">{planLabel}</span></div>
        <div className="row between"><span className="muted">Rate after your first 12 months</span><span className="b">{money(standardCents)}/month</span></div>
        <div className="row between"><span className="muted">Payment method</span><span className="b">{card ?? "—"}</span></div>
      </div>
      <div className="card bad small" style={{ gap: 6 }}>
        <span className="eyebrow">If a payment fails</span>
        <span>Stripe retries your card automatically. While a payment is past due your profile is hidden from students, and a membership more than 90 days past due may be ended. Update your card with Manage billing to fix it right away.</span>
      </div>
      <div className="col" style={{ gap: 0 }}>
        <span className="eyebrow" style={{ marginBottom: 6 }}>Invoices</span>
        {invoices.length === 0 && <span className="small muted">No invoices yet.</span>}
        {invoices.map((i) => (
          <div key={i.id} className="row between small" style={{ padding: "10px 0", borderBottom: "1px solid #1C1C1F" }}>
            <span>{i.url ? <a className="link small" href={i.url} target="_blank" rel="noopener noreferrer">{i.label}</a> : i.label}{i.status !== "paid" && <span className="tag warn" style={{ marginLeft: 6 }}>{i.status}</span>}</span>
            <span className="muted">{fmtDate(i.date, { month: "short", day: "numeric" })} <span className="b" style={{ marginLeft: 8, color: "inherit" }}>{money(i.amount)}</span></span>
          </div>
        ))}
      </div>
    </>
  );
}
