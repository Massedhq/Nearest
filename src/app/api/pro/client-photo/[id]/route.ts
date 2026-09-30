import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { getViewer } from "@/lib/viewer";

// Download a client photo to the pro's phone (saves as a file instead of opening in the browser).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer?.user || !/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.proId, viewer.user.id)) });
  if (!b?.photoUrl) return new NextResponse("Not found", { status: 404 });
  const img = await fetch(b.photoUrl, { cache: "no-store" });
  if (!img.ok || !img.body) return new NextResponse("Couldn't load the photo. Try again.", { status: 502 });
  const type = img.headers.get("content-type") ?? "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("heic") ? "heic" : "jpg";
  const day = b.startsAt.toISOString().slice(0, 10);
  return new NextResponse(img.body, {
    headers: {
      "content-type": type,
      "content-disposition": `attachment; filename="nearest-client-${day}-${b.number}.${ext}"`,
      "cache-control": "private, no-store",
    },
  });
}
