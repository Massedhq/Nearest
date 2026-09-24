import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, bookings, messages, users, professionalProfiles } from "@/db";

/** Booking threads for a student or a pro, newest activity first. */
export async function threadsFor(userId: string, side: "student" | "pro") {
  const mine = side === "student" ? eq(bookings.studentId, userId) : eq(bookings.proId, userId);
  const rows = await db
    .select({
      id: bookings.id, serviceName: bookings.serviceName, startsAt: bookings.startsAt,
      pro: professionalProfiles.businessName, first: users.firstName, last: users.lastName,
      lastBody: sql<string | null>`(select body from ${messages} m where m.booking_id = ${bookings.id} order by m.created_at desc limit 1)`,
      lastAt: sql<Date | null>`(select max(created_at) from ${messages} m where m.booking_id = ${bookings.id})`,
    })
    .from(bookings)
    .innerJoin(professionalProfiles, eq(professionalProfiles.userId, bookings.proId))
    .innerJoin(users, eq(users.id, bookings.studentId))
    .where(and(mine, inArray(bookings.status, ["confirmed", "completed", "no_show"])))
    .orderBy(desc(sql`coalesce((select max(created_at) from ${messages} m where m.booking_id = ${bookings.id}), ${bookings.startsAt})`))
    .limit(50);
  return rows;
}
