import { Icon } from "./Icon";
import { money } from "@/lib/time";

/**
 * Students see their total split into two parts: "Service" and one "Deposit/Booking Fee" line (the protected deposit +
 * Nearest's booking fee). Both are INSIDE the listed price — nothing is added. Cards and promotional credit cover only the
 * Service part, so the Deposit/Booking Fee is always paid.
 */
export function depositFeeSplit(price: number, deposit: number, fee: number, travel = 0) {
  const depositFee = Math.max(0, Math.min(price - travel, deposit + fee));
  return { service: Math.max(0, price - travel - depositFee), depositFee, travel };
}

export function DepositFeeNote({ deposit, fee }: { deposit: number; fee: number }) {
  return (
    <span className="xs muted">
      {fee > 0
        ? `The Deposit/Booking Fee is part of your price, not extra: ${money(deposit)} is your protected deposit and ${money(fee)} is the booking fee. The deposit only goes to the professional if you cancel within the cancellation window or don't show. Cards and promotional credit cover the service, so the Deposit/Booking Fee is always paid.`
        : `The Deposit/Booking Fee is part of your price, not extra: it's your ${money(deposit)} protected deposit, which only goes to the professional if you cancel within the cancellation window or don't show.`}
    </span>
  );
}

export function PriceBox({ price, deposit, fee = 0, pro, general, charge, invite = 0, card = 0, cardLabel }: { price: number; deposit: number; fee?: number; pro: number; general: number; charge: number; invite?: number; card?: number; cardLabel?: string }) {
  const sp = depositFeeSplit(price, deposit, fee);
  return (
    <div className="card">
      {sp.service > 0 && <div className="row between"><span>Service</span><span className="num">{money(sp.service)}</span></div>}
      {invite > 0 && <div className="row between" style={{ color: "#8FD3A8" }}><span>Invite reward — thanks for sharing Nearest</span><span className="num">−{money(invite)}</span></div>}
      {card > 0 && <div className="row between" style={{ color: "#8FD3A8" }}><span>{cardLabel ?? "Nearest Card"}</span><span className="num">−{money(card)}</span></div>}
      {general - card > 0 && <div className="row between muted"><span>Nearest credit</span><span className="num">−{money(general - card)}</span></div>}
      <div className="row between"><span>Deposit/Booking Fee</span><span className="num">{money(sp.depositFee)}</span></div>
      {pro > 0 && <div className="row between muted"><span>Credit with this professional</span><span className="num">−{money(pro)}</span></div>}
      <hr className="hr" />
      <div className="row between b"><span>Total due today</span><span className="num">{money(charge)}</span></div>
      <DepositFeeNote deposit={deposit} fee={fee} />
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
