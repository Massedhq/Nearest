/**
 * Photos and videos a professional adds to a client's review (their own shots from that appointment).
 * Public only when the client has a visible review AND has agreed: either they already allowed their photo to be
 * shared at finish, or they approve when Nearest asks them. Limits are shared by the screens and the server.
 */
export const REVIEW_MEDIA_MAX = 4;          // photos + videos per review
export const REVIEW_VIDEO_MAX = 2;          // videos per review
export const REVIEW_VIDEO_SECONDS = 60;
export const REVIEW_VIDEO_MB = 100;

export type ReviewMediaItem = { id: string; kind: "image" | "video"; url: string; durationSec?: number };

/** What the public may see: the list when the client agreed, else nothing. */
export function publicReviewMedia(items: ReviewMediaItem[] | null | undefined, consent: string | null | undefined) {
  return consent === "approved" ? (items ?? []) : [];
}

export const reviewMediaFolder = (proId: string, bookingId: string, kind: "image" | "video") => `pros/${proId}/review-${kind === "video" ? "video" : "photo"}/${bookingId}/`;
