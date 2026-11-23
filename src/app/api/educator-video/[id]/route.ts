import { eq } from "drizzle-orm";
import { db, educatorContracts, educators } from "@/db";
import { fieldActor, mayWork } from "@/lib/team";
import { readEvidence } from "@/lib/campaign-storage";

/** A video educator's uploaded training video — only for the owner it belongs to (and the main owner). Never cached. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const a = await fieldActor();
  if (!a || a.assistant) return new Response("Not found", { status: 404 });
  const c = await db.query.educatorContracts.findFirst({ where: eq(educatorContracts.id, id) });
  const e = c ? await db.query.educators.findFirst({ where: eq(educators.id, c.educatorId) }) : null;
  if (!c?.videoUrl || !e || !mayWork(a, e.ownerId)) return new Response("Not found", { status: 404 });
  const file = await readEvidence(c.videoUrl, c.videoAccess ?? "private");
  if (!file) return new Response("Not available", { status: 404 });
  return new Response(file.body, { headers: { "content-type": file.type, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-disposition": `inline; filename="${(c.videoName ?? "training-video.mp4").replace(/[^\w.\- ]/g, "")}"` } });
}
