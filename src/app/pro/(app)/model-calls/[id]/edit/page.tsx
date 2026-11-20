import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, modelCalls } from "@/db";
import { requirePro } from "@/lib/pro";
import { fmtDate, fmtTime } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { ModelCallDetails } from "@/components/ModelCallDetails";
import { updateModelCall } from "@/app/pro/actions";
import { callReady } from "@/lib/model-calls";

export const metadata = { title: "Edit model call" };

/** Edit an open Model Call (2026-11-20): add the required inspiration photos, sides, prices, payment, spots, details. */
export default async function EditModelCall({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePro({ assistant: true });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const call = await db.query.modelCalls.findFirst({ where: and(eq(modelCalls.id, id), eq(modelCalls.userId, user.id)) });
  if (!call || !["open", "full"].includes(call.status)) notFound();
  return (
    <div className="scr">
      <TopBar title="Edit Model Call" back="/pro/model-calls" />
      <div className="body">
        <div className="card" style={{ gap: 4 }}>
          <span className="b">{call.serviceName}</span>
          <span className="small muted">{call.flexible ? `Open time • through ${fmtDate(call.startsAt, { month: "short", day: "numeric" })}` : `${fmtDate(call.startsAt)} • ${fmtTime(call.startsAt)}`} • {call.durationMin} min • {call.spotsTaken} booked</span>
        </div>
        {!callReady(call) && <div className="card warn small"><span><span className="b">Hidden until you add an inspiration photo.</span> Every Model Call needs 1 to 3 photos of the look before anyone can see it.</span></div>}
        <ActionForm action={updateModelCall} submitLabel="Save changes">
          <input type="hidden" name="id" value={call.id} />
          <ModelCallDetails userId={user.id} call={call} />
        </ActionForm>
        <span className="xs muted">Price and payment changes apply to new bookings. Models already booked keep what they paid.</span>
      </div>
    </div>
  );
}
