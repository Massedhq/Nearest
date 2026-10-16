import { eq } from "drizzle-orm";
import { db, prospectDrafts } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { readEvidence } from "@/lib/campaign-storage";
import { canSeeDraft } from "@/lib/screenshot-leads";

/** A draft's screenshot — only to the admin it belongs to (or the main owner). Never a public link. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { user } = await requireAdmin();
  const { id, n } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const d = await db.query.prospectDrafts.findFirst({ where: eq(prospectDrafts.id, id) });
  if (!d || !(await canSeeDraft(user.id, d.recruiterId))) return new Response("Not found", { status: 404 });
  const img = (d.images as { url: string; access: string }[])[Number(n)];
  if (!img) return new Response("Not found", { status: 404 });
  const r = await readEvidence(img.url, img.access);
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(r.body, { headers: { "content-type": r.type, "cache-control": "private, no-store" } });
}
