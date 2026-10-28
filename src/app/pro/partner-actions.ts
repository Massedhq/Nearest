"use server";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db, partnerPages, proServices } from "@/db";
import { requirePro } from "@/lib/pro";
import { cleanLinkRows, cleanVideoRows, partnerPageFor, partnerPagePath, PARTNER_LIMITS } from "@/lib/partners";
import { ensureProSlug } from "@/lib/connections";

type FormState = { error?: string; ok?: string };
const all = (f: FormData, k: string) => f.getAll(k).map((v) => String(v));

/** Partner saves their link page: headline, links, videos, top services, live or hidden. */
export async function savePartnerPage(_: FormState, form: FormData): Promise<FormState> {
  const { user } = await requirePro();
  const page = await partnerPageFor(user.id);
  if (!page) return { error: "Your partner page isn't approved yet." };
  if (page.pausedAt) return { error: "Nearest paused your partner page. Contact support to turn it back on." };
  const headline = String(form.get("headline") ?? "").trim().slice(0, PARTNER_LIMITS.headline) || null;
  const links = cleanLinkRows(all(form, "link_title"), all(form, "link_url"), all(form, "link_note"));
  if (links.error) return { error: links.error };
  const videos = cleanVideoRows(all(form, "video_title"), all(form, "video_url"));
  if (videos.error) return { error: videos.error };
  const picked = [...new Set(all(form, "top").filter((id) => /^[0-9a-f-]{36}$/.test(id)))];
  if (picked.length > PARTNER_LIMITS.top) return { error: `Pick up to ${PARTNER_LIMITS.top} top services.` };
  const mine = picked.length ? (await db.select({ id: proServices.id }).from(proServices).where(and(eq(proServices.userId, user.id), inArray(proServices.id, picked)))).map((r) => r.id) : [];
  const topServiceIds = picked.filter((id) => mine.includes(id));
  const published = form.get("published") === "on";
  const slug = await ensureProSlug(user.id);
  await db.update(partnerPages).set({
    headline, links: links.rows, videos: videos.rows, topServiceIds, published,
    publishedAt: published && !page.published ? new Date() : page.publishedAt, updatedAt: new Date(),
  }).where(eq(partnerPages.userId, user.id));
  revalidatePath("/pro/partner");
  if (slug) revalidatePath(partnerPagePath(slug));
  return { ok: published ? "Saved — your page is updated." : "Saved. Your page is hidden until you turn on Page is live." };
}
