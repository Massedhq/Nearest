import Link from "next/link";
import { requireBrowsingStudent } from "@/lib/student";
import { myCards, cardLabel, validThruLabel, activateDays } from "@/lib/nearest-cards";
import { NearestCardForm } from "@/components/NearestCardForm";
import { GrantedCard } from "@/components/GrantedCard";
import { CardPlacesList } from "@/components/CardPlacesList";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Cards & activations" };
export const dynamic = "force-dynamic";

/** Account → Cards & activations: add a Nearest Card so its value is saved on the account (and safe if the card is lost). */
export default async function CardsPage({ searchParams }: { searchParams: Promise<{ welcome?: string; v?: string }> }) {
  const { user, canBook, finishStep } = await requireBrowsingStudent();
  const sp = await searchParams;
  // Voted on /card and then signed in (or created the account): link the vote and activate the voucher they entered.
  const claimed = await (await import("@/lib/vouchers")).claimVote(user.id);
  // Online reward wheel: the held reward becomes this student's own digital GRANTED card.
  const wheel = await (await import("@/lib/reward-wheel")).claimSpin(user.id).catch(() => null);
  const [cards, days] = await Promise.all([myCards(user.id), activateDays()]);
  const current = cards.filter((x) => x.state !== "used");
  const used = cards.filter((x) => x.state === "used");
  return (
    <div className="scr">
      <TopBar title="Cards & activations" back="/account" />
      <div className="body">
        {(sp.welcome || claimed.linked) && (
          <div className="card" style={{ gap: 6 }}>
            <span className="b">Welcome to Nearest — your vote is saved.</span>
            <span className="small muted">Thanks for telling us what you want in your city. We&apos;ll let you know when those professionals are here.</span>
          </div>
        )}
        {wheel && <div className={`card small ${wheel.ok ? "" : "warn"}`}><span>{wheel.message}</span></div>}
        {claimed.voucher && <div className={`card small ${claimed.voucher.ok ? "" : "warn"}`}><span>{claimed.voucher.message}</span></div>}
        {sp.v === "no" && !claimed.voucher && <div className="card warn small"><span>We couldn&apos;t activate the voucher you entered. Check the number and code and enter it below.</span></div>}
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Activate a GRANTED voucher or Nearest Card</span>
          <span className="small">Type the 16-digit number and the security code printed on your Nearest GRANTED Certificate Voucher (or the back of an older Nearest Card). Once it&apos;s saved here, losing the paper doesn&apos;t matter — and it&apos;s only used when you choose it for a booking.</span>
          <NearestCardForm back="/cards" />
        </div>
        {!canBook && finishStep && (
          <Link className="card warn small" href={finishStep} style={{ textDecoration: "none", color: "inherit" }}>
            <span><span className="b">Finish verifying to book.</span> Your voucher is saved — you can use it on a booking once you&apos;ve verified your school ID (and, under 18, your parent has approved).</span>
          </Link>
        )}
        {current.length > 0 && <h3 className="eyebrow p">My card</h3>}
        {current.map(({ c, b, state, bookingId }) => (
          <div key={c.id} className="card" style={{ gap: 4 }}>
            {b.channel === "digital" && <GrantedCard label={b.kind === "free" ? "Free service" : `${money(b.amountCents)} off`} kind={b.kind} number={c.number} code={c.code} validThru={validThruLabel(b.validThru)} />}
            <div className="row between"><span className="b">{cardLabel(b.kind, !!b.sharedNumber || b.channel === "digital")} •••• {c.number.slice(-4)}</span><span className={`tag ${state === "ready" ? "ok" : "warn"}`}>{state === "ready" ? "Ready to use" : "Chosen for a booking"}</span></div>
            <span className="small">{b.kind === "free" ? "One eligible free service" : `${money(b.amountCents)} off`}</span>
            <span className="xs muted">Added {c.activatedAt ? fmtDate(c.activatedAt) : ""} • card valid thru {validThruLabel(b.validThru)}</span>
            {bookingId && <Link className="link xs" href={`/bookings/${bookingId}`}>See the booking (you can switch or remove the card there)</Link>}
          </div>
        ))}
        {used.length > 0 && <h3 className="eyebrow p">Used cards</h3>}
        {used.map(({ c, b, bookingId, bPaidAt }) => (
          <div key={c.id} className="card" style={{ gap: 4, opacity: 0.7 }}>
            <div className="row between"><span className="b">{cardLabel(b.kind, !!b.sharedNumber || b.channel === "digital")} •••• {c.number.slice(-4)}</span><span className="tag">Used</span></div>
            <span className="small">{b.kind === "free" ? "One eligible free service" : `${money(b.amountCents)} off`} • used {bPaidAt ? fmtDate(bPaidAt) : ""}</span>
            <span className="xs muted">Each card works once, so this one can&apos;t be used again.</span>
            {bookingId && <Link className="link xs" href={`/bookings/${bookingId}`}>See the booking it paid for</Link>}
          </div>
        ))}
        {cards.length === 0 && <CardPlacesList />}
        <div className="card small" style={{ gap: 6 }}>
          <span className="b">How it works</span>
          <span>• Your card is never used automatically. When you book, choose it under &quot;Use a GRANTED voucher or Nearest Card on this booking?&quot; — or pick it later on the booking before you pay. You can switch or remove it until you pay.</span>
          <span>• One card covers one booking. If the booking costs less than the card, the rest isn&apos;t kept, so save bigger cards for bigger bookings.</span>
          <span>• If that booking expires or is declined before you pay, the card is ready to use again. If you cancel after paying, the card&apos;s part comes back as Nearest credit like the rest of your payment.</span>
          <span>• A free card covers the full price of the professional's eligible free service. The deposit and booking fee are paid separately.</span>
          <span>• Each voucher or card works once. GRANTED vouchers: one discount and one free-service voucher per student. Older Nearest Cards: one per student.</span>
          <span>• GRANTED vouchers can be activated until the Valid thru date printed on them. Older Nearest Cards must be saved within {days} days of getting them (and before Valid thru). Once saved, it stays until you use it.</span>
          <span>• GRANTED vouchers and Nearest Cards are promotional: no cash value, can&apos;t be sold or exchanged for cash, and can&apos;t be used on Bundle bookings.</span>
          <Link className="link small" href="/credits">See My credits</Link>
        </div>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
