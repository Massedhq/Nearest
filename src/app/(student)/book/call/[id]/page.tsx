import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, modelCalls, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { liveProWhere } from "@/lib/search";
import { creditBalances, applyCredits } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { PriceBox, Terms } from "@/components/BookingTerms";
import { Icon } from "@/components/Icon";
import { bookModelCall } from "@/app/book-actions";
import { WherePicker } from "@/components/WherePicker";

export const metadata = { title: "Book a model call" };

export default async function BookCall({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const call = await db.query.modelCalls.findFirst({ where: eq(modelCalls.id, id) });
  if (!call) notFound();
  const [pro] = await db.select().from(professionalProfiles).where(and(eq(professionalProfiles.userId, call.userId), ...liveProWhere(null, "all"))).limit(1);
  if (!pro) notFound();
  const full = call.status !== "open" || call.spotsTaken >= call.spots || call.startsAt.getTime() < Date.now();
  const s = await getSettings();
  const deposit = Math.min(Number(s["appt.deposit_cents"]), call.priceCents);
  const use = applyCredits(call.priceCents, await creditBalances(user.id, call.userId));
  return (
    <div className="scr">
      <TopBar title="Book a Model Call" back="/model-calls" />
      <div className="body">
        <div className="card">
          <div className="b">{call.serviceName} (Model Call)</div><div className="small muted">{pro.businessName}</div>
          <hr className="hr" />
          <div className="row small"><Icon name="cal" size="s" /> {fmtDate(call.startsAt, { weekday: "long", month: "long", day: "numeric" })} • {fmtTime(call.startsAt)}</div>
          <div className="row small"><Icon name="clock" size="s" /> About {call.durationMin} minutes</div>
          {call.requirements && call.requirements.length > 0 && <div className="chips">{call.requirements.map((r) => <span key={r} className="tag">{r}</span>)}</div>}
        </div>
        {full ? (
          <div className="card bad small"><span>This model call is full or no longer open.</span></div>
        ) : (
          <>
            {call.priceCents > 0 && <PriceBox price={call.priceCents} deposit={deposit} pro={use.pro} general={use.general} charge={use.charge} />}
            <Terms deposit={deposit} cutoffHours={Number(s["cancel.cutoff_hours"])} graceMin={Number(s["appt.grace_minutes"])} />
            <ActionForm action={bookModelCall} submitLabel={use.charge > 0 ? "Continue to payment" : "Claim my spot"}>
              <input type="hidden" name="modelCallId" value={call.id} />
              {!pro.addressLine && <WherePicker mode="travel" proCity="" />}
              <label className="check"><input type="checkbox" name="agree" required />I meet the requirements and agree to the booking terms</label>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
