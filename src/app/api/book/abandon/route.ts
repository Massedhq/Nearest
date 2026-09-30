import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { getViewer } from "@/lib/viewer";
import { releaseHold } from "@/lib/bookings";

// Stripe Checkout's back arrow lands here: release the unpaid hold and return the student
// to the page they booked from (the pro's profile or the Model Call), not a "finish payment" screen.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const viewer = await getViewer();
  const home = new URL("/home", req.url);
  if (!viewer?.user || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.redirect(home);
  const b = await db.query.bookings.findFirst({ where: (t, { and, eq }) => and(eq(t.id, id), eq(t.studentId, viewer.user!.id)) });
  if (!b) return NextResponse.redirect(home);
  const r = await releaseHold(b.id, viewer.user.id);
  if (r === "paid") return NextResponse.redirect(new URL(`/bookings/${b.id}?booked=1`, req.url));
  const back = b.modelCallId ? `/book/call/${b.modelCallId}` : `/p/${b.proId}`;
  return NextResponse.redirect(new URL(`${back}?notbooked=1`, req.url));
}
