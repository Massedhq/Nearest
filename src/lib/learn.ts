import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db, learnClasses } from "@/db";

/**
 * Learn at Nearest — COMING SOON, professionals only.
 * Owners upload classes (video + cover + title + educator credit) under a written license from the educator.
 * Files are stored private in Blob under learn/<ownerId>/ and are only ever streamed through /api/learn/[id]/video and
 * /api/learn/[id]/cover to signed-in professionals and admins, and only to a page inside the app (not a new tab,
 * not another site). Nothing is sold yet: professionals see covers and titles marked "Coming soon"; only admins play.
 */

export const LEARN_LIMITS = {
  videoBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  coverBytes: 15 * 1024 * 1024,
  videoTypes: ["video/mp4", "video/quicktime", "video/webm"],
  coverTypes: ["image/jpeg", "image/png", "image/webp"],
  accessDays: 30, // planned: a purchase opens a class for 30 days
};

export const LEARN_STATUS: Record<string, string> = { draft: "Draft", published: "Shown to professionals", hidden: "Hidden" };

/** A Blob URL that one of OUR uploads made under this owner's learn/ folder (never a link someone pasted). */
export function ownLearnUrl(url: string, userId: string, folder: "video" | "cover") {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /\.blob\.vercel-storage\.com$/.test(u.hostname) && u.pathname.startsWith(`/learn/${userId}/${folder}/`);
  } catch { return false; }
}

export async function allClasses() {
  return db.select().from(learnClasses).orderBy(asc(learnClasses.sort), desc(learnClasses.createdAt));
}

/** What professionals see on Learn at Nearest while it's coming soon: published classes, no video. */
export async function publishedClasses() {
  try {
    return await db.select({ id: learnClasses.id, title: learnClasses.title, educatorName: learnClasses.educatorName, educatorLink: learnClasses.educatorLink, description: learnClasses.description, category: learnClasses.category, hasCover: learnClasses.coverUrl })
      .from(learnClasses).where(eq(learnClasses.status, "published")).orderBy(asc(learnClasses.sort), desc(learnClasses.createdAt));
  } catch (e) {
    console.warn("learn classes unavailable —", (e as Error).message?.split("\n")[0]);
    return [];
  }
}

/** What still blocks showing a class to professionals. */
export function publishProblems(c: typeof learnClasses.$inferSelect): string[] {
  const out: string[] = [];
  if (!c.title.trim()) out.push("a title");
  if (!c.educatorName.trim()) out.push("the educator's name");
  if (!c.coverUrl) out.push("a cover");
  if (!c.videoUrl) out.push("the class video");
  if (!c.licenseConfirmedAt) out.push("confirmation that you have a written agreement with the educator");
  return out;
}

/**
 * Only inside the app: the browser says where a media request comes from. A video/image tag on one of our pages sends
 * Sec-Fetch-Site same-origin; opening the link in a tab (dest "document") or from another site does not.
 */
export function insideApp(req: Request, dest: "video" | "image") {
  const site = req.headers.get("sec-fetch-site");
  const d = req.headers.get("sec-fetch-dest");
  if (site && site !== "same-origin") return false;
  if (d === "document" || d === "iframe") return false;
  if (d && d !== dest && d !== "empty") return false;
  const ref = req.headers.get("referer");
  if (ref) {
    try { if (new URL(ref).host !== new URL(req.url).host) return false; } catch { return false; }
  }
  return true;
}
