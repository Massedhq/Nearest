import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, bookings, professionalProfiles } from "@/db";
import { requireVerifiedStudent } from "@/lib/student";
import { expireStaleHolds } from "@/lib/bookings";
import { fmtDate, fmtTime } from "@/lib/time";
import { Tabs } from "@/components/Tabs";

export const metadata = { title: "My appointments" };

const LABEL: Record<string, [string, string]> = {
  pending_payment: ["Awaiting payment", "warn"], confirmed: ["Confirmed", "ok"], completed: ["Completed", ""],
  cancelled_student: ["Cancelled", "bad"], cancelled_pro: ["Cancelled by pro", "bad"], expired: ["Not completed", ""],
};

export default async function MyBookings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user } = await requireVerifiedStudent();
  await expireStaleHolds();
  const tab = (await searchParams).tab ?? "upcoming";
  const rows = await db
    .select({ b: bookings, pro: professionalProfiles.businessName })
    .from(bookings)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
    .where(eq(bookings.studentId, user.id))
    .orderBy(desc(bookings.startsAt))
    .limit(100);
  const now = Date.now();
  const list = rows.filter(({ b }) =>
    tab === "upcoming" ? (b.status === "confirmed" || b.status === "pending_payment") && b.endsAt.getTime() > now - 12 * 3600000
    : tab === "past" ? b.status === "completed" || (b.status === "confirmed" && b.endsAt.getTime() <= now - 12 * 3600000)
    : b.status.startsWith("cancelled"));
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t">My appointments</div><span className="sp" /></div>
      <div className="body">
        <div className="seg">
          {[["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"]].map(([k, l]) => (
            <Link key={k} href={`/bookings?tab=${k}`} className={tab === k ? "on" : ""} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 40, borderRadius: 10, textDecoration: "none", fontWeight: 600, fontSize: 13, background: tab === k ? "#ECE8E1" : "transparent", color: tab === k ? "#0A0A0A" : "#A8A399" }}>{l}</Link>
          ))}
        </div>
        {list.length === 0 && <p className="small muted p">Nothing here yet.</p>}
        <div className="col" style={{ gap: 0 }}>
          {list.map(({ b, pro }) => (
            <Link key={b.id} className="item" href={`/bookings/${b.id}`}>
              <div className="grow"><div className="b">{pro}</div><div className="small muted">{b.serviceName}</div><div className="xs muted">{fmtDate(b.startsAt)} • {fmtTime(b.startsAt)}</div></div>
              <span className={`tag ${LABEL[b.status][1]}`}>{LABEL[b.status][0]}</span>
            </Link>
          ))}
        </div>
        <Link className="card small" href="/credits" style={{ textDecoration: "none" }}>View my credits</Link>
      </div>
      <Tabs kind="student" active="Bookings" />
    </div>
  );
}
