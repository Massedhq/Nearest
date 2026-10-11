import Link from "next/link";
import { redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { requireStudent } from "@/lib/student";
import { entryFor, getCampaign } from "@/lib/campaign";
import { rewardBlocker, rewardOffers } from "@/lib/campaign-reward";
import { personName } from "@/lib/pro-name";
import { chicagoNow, label12 } from "@/lib/time";
import { bookCampaignReward } from "@/app/campaign-actions";

export const metadata = { title: "Book your free service" };
export const dynamic = "force-dynamic";

/** Book the approved launch reward with a participating professional. The student pays $0 — nothing else is charged. */
export default async function RewardPage({ searchParams }: { searchParams: Promise<{ offer?: string; day?: string }> }) {
  const { user } = await requireStudent();
  const entry = await entryFor(user.id);
  if (!entry) redirect("/campaign");
  const blocked = await rewardBlocker(entry);
  const c = await getCampaign();
  const sp = await searchParams;
  const offers = blocked ? [] : await rewardOffers();
  const pick = offers.find((o) => o.o.id === sp.offer) ?? null;
  const today = chicagoNow().date;
  const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + i + 1); return d.toISOString().slice(0, 10); });
  const day = pick && sp.day && days.includes(sp.day) ? sp.day : null;
  const times = pick && day ? await (await import("@/lib/availability")).openSlots(pick.o.proId, pick.service.durationMin, day) : [];
  const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="scr">
      <TopBar title="Free service" back="/campaign" />
      <div className="body">
        <div className="card" style={{ gap: 6 }}>
          <span className="eyebrow">{c.rewardTitle ?? "Your launch reward"}</span>
          <span className="small">{c.rewardIncludes}</span>
          <span className="small b">You pay $0 — no deposit, no service fee, no travel fee. Appointments are at the professional&apos;s location.</span>
          <span className="xs muted">One-time and non-transferable. If the professional declines, or the booking is cancelled, your free service comes back to you. A no-show uses it.</span>
        </div>
        {blocked && <div className="card small"><span>{blocked}</span></div>}
        {!blocked && !pick && offers.map(({ o, service, pro, first, last, city }) => (
          <Link key={o.id} className="card" href={`/campaign/reward?offer=${o.id}`} style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
            <span className="b">{service.name}</span>
            <span className="small">{personName(pro.displayName, first, last)}{pro.businessName ? ` • ${pro.businessName}` : ""}{city ? ` • ${city}` : ""}</span>
            <span className="xs muted">{service.durationMin} min • {o.slotsTotal - o.slotsUsed} reward appointment{o.slotsTotal - o.slotsUsed === 1 ? "" : "s"} left</span>
          </Link>
        ))}
        {!blocked && pick && (
          <>
            <div className="card" style={{ gap: 4 }}>
              <span className="b">{pick.service.name}</span>
              <span className="small">{personName(pick.pro.displayName, pick.first, pick.last)}{pick.pro.businessName ? ` • ${pick.pro.businessName}` : ""}</span>
              <Link className="link xs" href="/campaign/reward">Choose a different option</Link>
            </div>
            <div className="chips">{days.map((d) => <Link key={d} className={`chip${d === day ? " on" : ""}`} href={`/campaign/reward?offer=${pick.o.id}&day=${d}`}>{dayLabel(d)}</Link>)}</div>
            {day && (times.length === 0
              ? <div className="card small"><span>No open times that day. Try another day.</span></div>
              : (
                <ActionForm action={bookCampaignReward} submitLabel="Request this free appointment">
                  <input type="hidden" name="offerId" value={pick.o.id} />
                  <input type="hidden" name="day" value={day} />
                  <div className="chips">{times.map((t) => <label key={t} className="chip"><input type="radio" name="time" value={t} required style={{ marginRight: 6 }} />{label12(t)}</label>)}</div>
                  <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="agree" required /><span>I understand this uses my one free launch reward once the professional accepts, and a no-show uses it.</span></label>
                </ActionForm>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
