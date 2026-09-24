import { and, asc, eq, or } from "drizzle-orm";
import { db, bookings, messages } from "@/db";
import { getViewer } from "@/lib/viewer";

// Messages for one booking, only for its student or its professional.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.user) return Response.json({ error: "Sign in" }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "Not found" }, { status: 404 });
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), or(eq(bookings.studentId, viewer.user.id), eq(bookings.proId, viewer.user.id))) });
  if (!b) return Response.json({ error: "Not found" }, { status: 404 });
  const rows = await db.select().from(messages).where(eq(messages.bookingId, id)).orderBy(asc(messages.createdAt)).limit(500);
  return Response.json(rows.map((m) => ({ id: m.id, mine: m.senderId === viewer.user!.id, body: m.body, at: m.createdAt })), { headers: { "Cache-Control": "no-store" } });
}
