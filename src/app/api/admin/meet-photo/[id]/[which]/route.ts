import { eq } from "drizzle-orm";
import { db, outreachMeetings } from "@/db";
import { getViewer } from "@/lib/viewer";
import { readEvidence } from "@/lib/campaign-storage";

/** A photo from an outreach-meeting booking — owners only, never cached publicly. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; which: string }> }) {
  const { id, which } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["pro", "friend"].includes(which)) return new Response("Not found", { status: 404 });
  const viewer = await getViewer();
  if (viewer?.admin?.role !== "OWNER" || !viewer.admin.active) return new Response("Not found", { status: 404 });
  const m = await db.query.outreachMeetings.findFirst({ where: eq(outreachMeetings.id, id) });
  const url = which === "pro" ? m?.photo : m?.friendPhoto;
  if (!m || !url) return new Response("Not found", { status: 404 });
  const file = await readEvidence(url, (which === "pro" ? m.photoAccess : m.friendPhotoAccess) ?? "private");
  if (!file) return new Response("Not available", { status: 404 });
  return new Response(file.body, { headers: { "content-type": file.type, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
