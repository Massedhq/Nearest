import { eq } from "drizzle-orm";
import { db, learnClasses } from "@/db";
import { getViewer } from "@/lib/viewer";
import { insideApp } from "@/lib/learn";

export const dynamic = "force-dynamic";

/**
 * Streams a Learn at Nearest class video — only inside the app. While Learn at Nearest is coming soon, only admins can
 * play (preview). Never a public link: the stored Blob URL is never sent to a browser, a link opened in a new tab or
 * from another site is refused, and nothing is cached. Supports Range requests so the player can seek.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const viewer = await getViewer();
  if (!viewer?.user || !viewer.admin) return new Response("Not available", { status: 403 });
  if (!insideApp(req, "video")) return new Response("This class plays only inside Nearest.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const c = await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) });
  if (!c?.videoUrl) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range");
  const head: Record<string, string> = range ? { Range: range } : {};
  let res: Response | null = null;
  try {
    if (c.videoAccess === "private") {
      const { get } = await import("@vercel/blob");
      const r = await get(c.videoUrl, { access: "private", headers: head });
      if (r?.stream) {
        const h = r.headers;
        const status = h.get("content-range") ? 206 : 200;
        res = new Response(r.stream as ReadableStream, { status, headers: copyHeaders(h) });
      }
    } else {
      const r = await fetch(c.videoUrl, { headers: head, cache: "no-store" });
      if (r.ok && r.body) res = new Response(r.body, { status: r.status, headers: copyHeaders(r.headers) });
    }
  } catch (e) {
    console.error("learn video", e);
  }
  return res ?? new Response("Not found", { status: 404 });
}

function copyHeaders(src: { get(name: string): string | null }) {
  const out = new Headers();
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) { const v = src.get(k); if (v) out.set(k, v); }
  if (!out.get("accept-ranges")) out.set("Accept-Ranges", "bytes");
  out.set("Cache-Control", "private, no-store");
  out.set("Content-Disposition", "inline");
  out.set("X-Content-Type-Options", "nosniff");
  out.set("Cross-Origin-Resource-Policy", "same-origin");
  return out;
}
