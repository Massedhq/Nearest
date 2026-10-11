import "server-only";

/**
 * Where campaign screenshots live. Stored in Vercel Blob as PRIVATE when the store allows it; otherwise as a
 * random, unlisted file. Either way the storage URL is never sent to a browser — screenshots are served only through
 * /api/campaign/evidence/[id] to the student who sent them and to admins.
 */
export async function storeEvidence(path: string, body: Buffer, mime: string): Promise<{ url: string; access: "private" | "public" }> {
  const { put } = await import("@vercel/blob");
  try {
    const r = await put(path, body, { access: "private", contentType: mime, addRandomSuffix: true });
    return { url: r.url, access: "private" };
  } catch {
    const r = await put(path, body, { access: "public", contentType: mime, addRandomSuffix: true });
    return { url: r.url, access: "public" };
  }
}

export async function readEvidence(url: string, access: string): Promise<{ body: ReadableStream; type: string } | null> {
  try {
    if (access === "private") {
      const { get } = await import("@vercel/blob");
      const r = await get(url, { access: "private" });
      if (!r || !r.stream) return null;
      return { body: r.stream as ReadableStream, type: r.headers.get("content-type") ?? "image/jpeg" };
    }
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok || !res.body) return null;
    return { body: res.body, type: res.headers.get("content-type") ?? "image/jpeg" };
  } catch (e) {
    console.error("evidence read", e);
    return null;
  }
}

export async function deleteEvidence(url: string) {
  try { const { del } = await import("@vercel/blob"); await del(url); } catch (e) { console.error("evidence delete", e); }
}

/** The real image type from the file's first bytes (never trust the name or the browser's label). */
export function sniffImage(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
