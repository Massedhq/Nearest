import { eq } from "drizzle-orm";
import { db, learnClasses } from "@/db";
import { getViewer, proAccess } from "@/lib/viewer";
import { readEvidence } from "@/lib/campaign-storage";
import { insideApp } from "@/lib/learn";

export const dynamic = "force-dynamic";

/** A class cover — only inside the app, to signed-in professionals (published classes) and admins. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.user) return new Response("Not available", { status: 403 });
  if (!insideApp(req, "image")) return new Response("Not available", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const c = await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) });
  if (!c?.coverUrl) return new Response("Not found", { status: 404 });
  const allowed = Boolean(viewer.admin) || (c.status === "published" && (await proAccess(viewer)));
  if (!allowed) return new Response("Not available", { status: 403 });
  const file = await readEvidence(c.coverUrl, c.coverAccess ?? "private");
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.body, { headers: { "Content-Type": file.type, "Cache-Control": "private, max-age=600", "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff" } });
}
