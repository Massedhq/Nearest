import Link from "next/link";
import { requireBrowsingStudent } from "@/lib/student";
import { myCards, cardLabel, validThruLabel } from "@/lib/nearest-cards";
import { NearestCardForm } from "@/components/NearestCardForm";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Cards & activations" };
export const dynamic = "force-dynamic";

/** Account → Cards & activations: add a Nearest Card so its value is saved on the account (and safe if the card is lost). */
export default async function CardsPage() {
  const { user, canBook, finishStep } = await requireBrowsingStudent();
  const cards = await myCards(user.id);
  return (
    <div className="scr">
      <TopBar title="Cards & activations" back="/account" />
      <div className="body">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">Add a Nearest Card</span>
          <span className="small">Type the 16-digit number from the front and the code from the back. Once it&apos;s added, its value is saved on your account — so if you lose the card, you don&apos;t lose the value.</span>
          <NearestCardForm back="/cards" />
        </div>
        {!canBook && finishStep && (
          <Link className="card warn small" href={finishStep} style={{ textDecoration: "none", color: "inherit" }}>
            <span><span className="b">Finish verifying to book.</span> You can add cards now; they&apos;re used when you book after you&apos;re verified.</span>
          </Link>
        )}
        {cards.length > 0 && <h3 className="eyebrow p">My cards</h3>}
        {cards.map(({ c, b }) => (
          <div key={c.id} className="card" style={{ gap: 4 }}>
            <div className="row between"><span className="b">{cardLabel(b.kind)} •••• {c.number.slice(-4)}</span><span className={`tag ${c.usedBookingId ? "" : "ok"}`}>{c.usedBookingId ? "Used" : "On your account"}</span></div>
            <span className="small">{b.kind === "free" ? `Covers a service up to ${money(b.amountCents)}` : `${money(b.amountCents)} off`}</span>
            <span className="xs muted">Added {c.activatedAt ? fmtDate(c.activatedAt) : ""} • card valid thru {validThruLabel(b.validThru)}</span>
            {c.usedBookingId && <Link className="link xs" href={`/bookings/${c.usedBookingId}`}>See the booking it paid for</Link>}
          </div>
        ))}
        <div className="card small" style={{ gap: 6 }}>
          <span className="b">How it works</span>
          <span>• The card&apos;s value goes into My credits and is taken off your total automatically when you pay for a booking — no extra step.</span>
          <span>• A free card covers your service up to its amount; anything above that is what you pay.</span>
          <span>• Each card works once, and only one card from the same group per student.</span>
          <span>• Add it before the Valid thru date on the card. Once it&apos;s on your account, the credit stays.</span>
          <span>• Nearest Cards are promotional: no cash value, can&apos;t be sold or exchanged for cash, and can&apos;t be used on Bundle bookings.</span>
          <Link className="link small" href="/credits">See My credits</Link>
        </div>
      </div>
      <Tabs kind="student" active="Account" />
    </div>
  );
}
