import { eq } from "drizzle-orm";
import { db, campaignEvidence } from "@/db";
import { getViewer } from "@/lib/viewer";
import { readEvidence } from "@/lib/campaign-storage";

/** A campaign screenshot — only for the student who sent it and for Nearest admins. Never cached publicly. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const viewer = await getViewer();
  if (!viewer?.user) return new Response("Sign in", { status: 401 });
  const ev = await db.query.campaignEvidence.findFirst({ where: eq(campaignEvidence.id, id) });
  if (!ev || (ev.studentId !== viewer.user.id && !viewer.admin)) return new Response("Not found", { status: 404 });
  const file = await readEvidence(ev.storageUrl, ev.storageAccess);
  if (!file) return new Response("Not available", { status: 404 });
  return new Response(file.body, { headers: { "content-type": ev.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
