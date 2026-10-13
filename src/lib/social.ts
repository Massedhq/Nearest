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

/**
 * Facebook: a page/profile username ("lashesbyavy") or a numeric profile ("id:1000…" from profile.php?id=…).
 * Accepts facebook.com/name, m.facebook.com/name, fb.com/name, facebook.com/profile.php?id=123, @name or just name.
 */
export function facebookHandle(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const id = v.match(/profile\.php\?(?:[^#]*&)?id=(\d{5,20})/i);
  if (id) return `id:${id[1]}`;
  if (/^id:\d{5,20}$/.test(v)) return v;
  const m = v.match(/(?:facebook|fb)\.com\/(?:pg\/|people\/[^/]+\/)?@?([A-Za-z0-9.]+)/i);
  const h = (m ? m[1] : v.split(/[/?#\s]/)[0]).replace(/^@+/, "").replace(/[^A-Za-z0-9.]/g, "").slice(0, 50);
  return h && !["share", "sharer", "groups", "events", "watch", "photo", "photos", "story.php", "permalink.php", "reel", "login", "home.php"].includes(h.toLowerCase()) ? h : null;
}

/** Pinterest: the profile username from pinterest.com/name (any country domain), @name or just name. Pin/board links aren't profiles. */
export function pinterestHandle(raw: string | null | undefined): string | null {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  if (/pin\.it\//i.test(v)) return null; // short share links can't be read — the pro pastes the full profile link
  const m = v.match(/pinterest\.[a-z.]+\/@?([A-Za-z0-9_]+)/i);
  const h = (m ? m[1] : v.split(/[/?#\s]/)[0]).replace(/^@+/, "").replace(/[^A-Za-z0-9_]/g, "").slice(0, 30);
  return h && !["pin", "search", "ideas", "today", "explore", "business", "login"].includes(h.toLowerCase()) ? h : null;
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
export const facebookUrl = (h: string) => (h.startsWith("id:") ? `https://www.facebook.com/profile.php?id=${h.slice(3)}` : `https://www.facebook.com/${encodeURIComponent(h)}`);
/** How a Facebook handle reads on screen. */
export const facebookLabel = (h: string) => (h.startsWith("id:") ? "Facebook" : h);
export const pinterestUrl = (h: string) => `https://www.pinterest.com/${encodeURIComponent(h)}/`;
export const tiktokUrl = (h: string) => `https://www.tiktok.com/@${encodeURIComponent(h)}`;
