// Turn whatever a pro types or pastes into a clean handle, and back into a working link.
// Accepts "@lashesbyavy", "lashesbyavy", "instagram.com/lashesbyavy", "https://www.instagram.com/lashesbyavy/?igsh=…",
// "tiktok.com/@lashesbyavy", "https://www.tiktok.com/@lashesbyavy?lang=en", etc.

const clean = (h: string) => h.replace(/^@+/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);

export function instagramHandle(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const m = v.match(/instagram\.com\/(?:_u\/)?@?([A-Za-z0-9._]+)/i);
  const h = clean(m ? m[1] : v.split(/[/?#\s]/)[0]);
  return h && !["p", "reel", "reels", "stories", "explore"].includes(h.toLowerCase()) ? h : null;
}

export function tiktokHandle(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const m = v.match(/tiktok\.com\/@([A-Za-z0-9._]+)/i);
  const h = clean(m ? m[1] : v.split(/[/?#\s]/)[0]);
  return h || null;
}

/** Websites: add https:// if they left it off; only http(s) links are allowed. */
export function websiteUrl(raw: string | null | undefined): string | null {
  let v = String(raw ?? "").trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch { return null; }
}

export const instagramUrl = (h: string) => `https://www.instagram.com/${encodeURIComponent(h)}/`;
export const tiktokUrl = (h: string) => `https://www.tiktok.com/@${encodeURIComponent(h)}`;
