import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, bookings, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { getSettings } from "@/lib/settings";
import { fmtDate, fmtTime } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { ChatThread } from "@/components/ChatThread";

export const metadata = { title: "Messages" };

export default async function StudentChat({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireVerifiedStudent();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ b: bookings, pro: professionalProfiles.businessName }).from(bookings).innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId)).where(and(eq(bookings.id, id), eq(bookings.studentId, user.id))).limit(1))[0];
  if (!row) notFound();
  const s = await getSettings();
  const closes = new Date(row.b.endsAt.getTime() + Number(s["appt.messaging_days"]) * 86400000);
  const open = ["confirmed", "completed", "no_show"].includes(row.b.status) && Date.now() < closes.getTime();
  return (
    <div className="scr">
      <TopBar title={row.pro ?? "Messages"} back={`/bookings/${id}`} />
      <div className="row xs muted" style={{ justifyContent: "center", padding: "0 22px 8px" }}>{row.b.serviceName} • {fmtDate(row.b.startsAt)} {fmtTime(row.b.startsAt)} • Open until {fmtDate(closes, { month: "short", day: "numeric" })}</div>
      <div className="body"><ChatThread bookingId={id} as="student" open={open} /></div>
    </div>
  );
}
