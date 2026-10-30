"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { requirePro } from "@/lib/pro";
import { REVIEW_MEDIA_MAX, REVIEW_VIDEO_MAX, REVIEW_VIDEO_SECONDS, reviewMediaFolder, type ReviewMediaItem } from "@/lib/review-media";

const rid = () => Math.random().toString(36).slice(2, 10);

function ownUrl(url: string, folder: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith(`/${folder}`);
  } catch { return false; }
}

async function mine(bookingId: string) {
  const { user } = await requirePro();
  if (!/^[0-9a-f-]{36}$/.test(bookingId)) return null;
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, bookingId), eq(bookings.proId, user.id)) });
  if (!b || !b.finishedAt || !["confirmed", "completed"].includes(b.status)) return null;
  return { user, b };
}

async function discard(url: string) { try { const { del } = await import("@vercel/blob"); await del(url); } catch (e) { console.error(e); } }

/** After adding: ask the client once (unless they already allowed sharing at finish). */
async function afterAdd(b: typeof bookings.$inferSelect, items: ReviewMediaItem[], proName: string) {
  let consent = b.reviewMediaConsent;
  if (!consent) consent = b.photoForPortfolio ? "approved" : "asked";
  await db.update(bookings).set({ reviewMedia: items, reviewMediaConsent: consent, ...(consent === "asked" && !b.reviewMediaAskedAt ? { reviewMediaAskedAt: new Date() } : {}) }).where(eq(bookings.id, b.id));
  if (consent === "asked" && !b.reviewMediaAskedAt) {
    try {
      const { inbox } = await import("@/lib/inbox");
      await inbox(b.studentId, { kind: "review_media", title: `${proName} added photos from your appointment`, body: "They'd like to show them with your review. Nothing is shown unless you approve.", href: `/bookings/${b.id}` });
      const u = await db.query.users.findFirst({ where: (t, { eq: e }) => e(t.id, b.studentId), columns: { email: true } });
      const { sendEmail } = await import("@/lib/email");
      const base = process.env.APP_URL || "https://www.usenearest.com";
      await sendEmail({ to: u?.email, subject: `${proName} added photos from your appointment`, eyebrow: "Your review", heading: "Okay to show these with your review?", lines: [`${proName} added photos or a video from your ${b.serviceName} appointment and would like to show them with your review.`, "Nothing is shown unless you approve. You can change your mind anytime."], button: { label: "See them and decide", url: `${base}/bookings/${b.id}` } });
    } catch (e) { console.error("review media ask", e); }
  }
  revalidatePath(`/pro/appointments/${b.id}`);
  revalidatePath(`/p/${b.proId}`);
}

/** Pro: add photos (already uploaded to their review-photo folder) to this client's review. */
export async function addReviewPhotos(bookingId: string, urls: string[]): Promise<{ error?: string }> {
  const m = await mine(bookingId);
  if (!m) return { error: "You can add photos once you've finished this appointment." };
  const folder = reviewMediaFolder(m.user.id, m.b.id, "image");
  const valid = urls.filter((u) => ownUrl(u, folder));
  const items = [...(m.b.reviewMedia ?? [])];
  const room = REVIEW_MEDIA_MAX - items.length;
  if (room <= 0) { await Promise.all(valid.map(discard)); return { error: `A review can show up to ${REVIEW_MEDIA_MAX} photos and videos. Remove one first.` }; }
  for (const url of valid.slice(0, room)) items.push({ id: rid(), kind: "image", url });
  await Promise.all(valid.slice(room).map(discard));
  const p = await db.query.professionalProfiles.findFirst({ where: (t, { eq: e }) => e(t.userId, m.user.id), columns: { businessName: true } });
  await afterAdd(m.b, items, p?.businessName ?? "Your professional");
  return valid.length > room ? { error: `Added ${room}. A review can show up to ${REVIEW_MEDIA_MAX} photos and videos.` } : {};
}

/** Pro: add one video (length read from the file on the server — over the limit is deleted and refused). */
export async function addReviewVideo(bookingId: string, url: string): Promise<{ error?: string }> {
  const m = await mine(bookingId);
  if (!m) return { error: "You can add a video once you've finished this appointment." };
  if (!ownUrl(url, reviewMediaFolder(m.user.id, m.b.id, "video"))) return { error: "Upload didn't complete. Try again." };
  const items = [...(m.b.reviewMedia ?? [])];
  if (items.length >= REVIEW_MEDIA_MAX) { await discard(url); return { error: `A review can show up to ${REVIEW_MEDIA_MAX} photos and videos. Remove one first.` }; }
  if (items.filter((x) => x.kind === "video").length >= REVIEW_VIDEO_MAX) { await discard(url); return { error: `A review can show up to ${REVIEW_VIDEO_MAX} videos.` }; }
  const { videoSeconds } = await import("@/lib/video-length");
  const secs = await videoSeconds(url);
  if (secs === null) { await discard(url); return { error: "We couldn't read this video. Try an MP4 or a video straight from your phone's camera." }; }
  if (secs > REVIEW_VIDEO_SECONDS + 0.5) { await discard(url); return { error: `This video is ${Math.round(secs)} seconds. Review videos can be up to ${REVIEW_VIDEO_SECONDS} seconds — trim it and try again.` }; }
  items.push({ id: rid(), kind: "video", url, durationSec: Math.round(secs * 10) / 10 });
  const p = await db.query.professionalProfiles.findFirst({ where: (t, { eq: e }) => e(t.userId, m.user.id), columns: { businessName: true } });
  await afterAdd(m.b, items, p?.businessName ?? "Your professional");
  return {};
}

/** Pro: take one photo/video off the review (the file is deleted). */
export async function removeReviewMedia(form: FormData) {
  const m = await mine(String(form.get("bookingId") ?? ""));
  if (!m) return;
  const id = String(form.get("mediaId") ?? "");
  const gone = (m.b.reviewMedia ?? []).find((x) => x.id === id);
  if (!gone) return;
  await db.update(bookings).set({ reviewMedia: (m.b.reviewMedia ?? []).filter((x) => x.id !== id) }).where(eq(bookings.id, m.b.id));
  await discard(gone.url);
  revalidatePath(`/pro/appointments/${m.b.id}`);
  revalidatePath(`/p/${m.b.proId}`);
}

