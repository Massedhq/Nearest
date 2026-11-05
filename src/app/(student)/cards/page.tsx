import Link from "next/link";
import { requireBrowsingStudent } from "@/lib/student";
import { myCards, cardLabel, validThruLabel, activateDays } from "@/lib/nearest-cards";
import { NearestCardForm } from "@/components/NearestCardForm";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Cards & activations" };
export const dynamic = "force-dynamic";

/** Account → Cards & activations: add a Nearest Card so its value is saved on the account (and safe if the card is lost). */
export default async function CardsPage() {
  const { user, canBook, finishStep } = await requireBrowsingStudent();
  const [cards, days] = await Promise.all([myCards(user.id), activateDays()]);
  return (
    <div className="scr">
      <TopBar title="Cards & activations" back="/account" />
      <div className="body">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Add a Nearest Card</span>
          <span className="small">Type the 16-digit number from the front and the code from the back. Once it&apos;s saved here, losing the card doesn&apos;t matter — and it&apos;s only used when you choose it for a booking.</span>
          <NearestCardForm back="/cards" />
        </div>
        {!canBook && finishStep && (
          <Link className="card warn small" href={finishStep} style={{ textDecoration: "none", color: "inherit" }}>
            <span><span className="b">Finish verifying to book.</span> You can save cards now and use them on a booking once you&apos;re verified.</span>
          </Link>
        )}
        {cards.length > 0 && <h3 className="eyebrow p">My cards</h3>}
        {cards.map(({ c, b, state, bookingId }) => (
          <div key={c.id} className="card" style={{ gap: 4 }}>
            <div className="row between"><span className="b">{cardLabel(b.kind)} •••• {c.number.slice(-4)}</span><span className={`tag ${state === "ready" ? "ok" : state === "saved" ? "warn" : ""}`}>{state === "ready" ? "Ready to use" : state === "saved" ? "Chosen for a booking" : "Used"}</span></div>
            <span className="small">{b.kind === "free" ? `Covers a service up to ${money(b.amountCents)}` : `${money(b.amountCents)} off`}</span>
            <span className="xs muted">Added {c.activatedAt ? fmtDate(c.activatedAt) : ""} • card valid thru {validThruLabel(b.validThru)}</span>
            {bookingId && <Link className="link xs" href={`/bookings/${bookingId}`}>{state === "used" ? "See the booking it paid for" : "See the booking (you can switch or remove the card there)"}</Link>}
          </div>
        ))}
        <div className="card small" style={{ gap: 6 }}>
          <span className="b">How it works</span>
          <span>• Your card is never used automatically. When you book, choose it under &quot;Use a Nearest Card on this booking?&quot; — or pick it later on the booking before you pay. You can switch or remove it until you pay.</span>
          <span>• One card covers one booking. If the booking costs less than the card, the rest isn&apos;t kept, so save bigger cards for bigger bookings.</span>
          <span>• If that booking expires or is declined before you pay, the card is ready to use again. If you cancel after paying, the card&apos;s part comes back as Nearest credit like the rest of your payment.</span>
          <span>• A free card covers your service up to its amount; anything above that is what you pay.</span>
          <span>• Each card works once, and only one card from the same group per student.</span>
          <span>• Save it to your account within {days} days of getting it (and before the Valid thru date on the card). A card that isn&apos;t saved in time goes inactive and can&apos;t be used. Once it&apos;s saved, it stays until you use it.</span>
          <span>• Nearest Cards are promotional: no cash value, can&apos;t be sold or exchanged for cash, and can&apos;t be used on Bundle bookings.</span>
          <Link className="link small" href="/credits">See My credits</Link>
        </div>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
