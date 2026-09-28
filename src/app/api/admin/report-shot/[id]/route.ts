import { eq } from "drizzle-orm";
import { db, problemReports } from "@/db";
import { getViewer } from "@/lib/viewer";

/** Screenshot attached to a problem report — admins only. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.admin) return new Response("Not allowed", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const r = await db.query.problemReports.findFirst({ where: eq(problemReports.id, id) });
  if (!r?.screenshotB64) return new Response("No screenshot", { status: 404 });
  return new Response(Buffer.from(r.screenshotB64, "base64"), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store, private" } });
}
