import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, users } from "@/db";
import { requirePro } from "@/lib/pro";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ChatThread } from "@/components/ChatThread";

export const metadata = { title: "Messages" };

export default async function ProChat({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePro();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ b: bookings, first: users.firstName, last: users.lastName }).from(bookings).innerJoin(users, eq(users.id, bookings.studentId)).where(and(eq(bookings.id, id), eq(bookings.proId, user.id))).limit(1))[0];
  if (!row) notFound();
  const s = await getSettings();
  const closes = new Date(row.b.endsAt.getTime() + Number(s["appt.messaging_days"]) * 86400000);
  const open = ["confirmed", "completed", "no_show"].includes(row.b.status) && Date.now() < closes.getTime();
  return (
    <div className="scr">
      <TopBar title={`${row.first} ${row.last?.[0] ?? ""}.`} back={`/pro/appointments/${id}`} />
      <div className="row xs muted" style={{ justifyContent: "center", padding: "0 22px 8px" }}>{row.b.serviceName} • {fmtDate(row.b.startsAt)} {fmtTime(row.b.startsAt)}</div>
      <div className="body"><ChatThread bookingId={id} as="pro" open={open} /></div>
    </div>
  );
}
