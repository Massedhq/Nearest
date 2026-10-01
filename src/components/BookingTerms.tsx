import { Icon } from "./Icon";
import { money } from "@/lib/time";

export function PriceBox({ price, deposit, pro, general, charge, invite = 0 }: { price: number; deposit: number; pro: number; general: number; charge: number; invite?: number }) {
  return (
    <div className="card">
      <div className="row between"><span>Service</span><span className="num">{money(price)}</span></div>
      {invite > 0 && <div className="row between" style={{ color: "#8FD3A8" }}><span>Invite reward — thanks for sharing Nearest</span><span className="num">−{money(invite)}</span></div>}
      {pro > 0 && <div className="row between muted"><span>Credit with this professional</span><span className="num">−{money(pro)}</span></div>}
      {general > 0 && <div className="row between muted"><span>Nearest credit</span><span className="num">−{money(general)}</span></div>}
      <hr className="hr" />
      <div className="row between b"><span>Total due today</span><span className="num">{money(charge)}</span></div>
      <span className="xs muted">
        {deposit >= price
          ? `Nothing extra is added. At this price, your whole ${money(price)} counts as the protected deposit — it only goes to the professional if you cancel within the cancellation window or don't show.`
          : `Nothing extra is added. ${money(deposit)} of the ${money(price)} is the protected deposit — it only goes to the professional if you cancel within the cancellation window or don't show.`}
      </span>
    </div>
  );
}

export function Terms({ deposit, cutoffHours, graceMin }: { deposit: number; cutoffHours: number; graceMin: number }) {
  return (
    <div className="card warn small">
      <span className="eyebrow" style={{ color: "#E3C58A" }}>Before you book</span>
      <div className="row top-a"><Icon name="wallet" size="s" /><span>Nearest uses service credits instead of cash refunds. Credits stay with the professional you booked.</span></div>
      <div className="row top-a"><Icon name="cal" size="s" /><span>Cancel {cutoffHours}+ hours ahead to keep your full payment as credit. Inside {cutoffHours} hours, the {money(deposit)} deposit is forfeited.</span></div>
      <div className="row top-a"><Icon name="clock" size="s" /><span>{graceMin}-minute grace period. After that you can be marked a no-show.</span></div>
      <div className="row top-a"><Icon name="lock" size="s" /><span>Your payment is held until you release it after your appointment.</span></div>
    </div>
  );
}
