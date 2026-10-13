import { eq } from "drizzle-orm";
import { db, supporters } from "@/db";
import { getViewer } from "@/lib/viewer";
import { readEvidence } from "@/lib/campaign-storage";

/** Public only for a published supporter who allowed their portrait; admins can always see it for review. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const s = await db.query.supporters.findFirst({ where: eq(supporters.id, id) });
  if (!s?.portraitUrl) return new Response("Not found", { status: 404 });
  const isPublic = s.status === "published" && s.permPortrait && s.permStatement && s.permName;
  if (!isPublic) {
    const viewer = await getViewer();
    if (!viewer?.admin) return new Response("Not found", { status: 404 });
  }
  const file = await readEvidence(s.portraitUrl, s.portraitAccess ?? "public");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, { headers: { "Content-Type": file.type, "Cache-Control": isPublic ? "public, max-age=300" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
