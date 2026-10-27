"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";

type FormState = { error?: string; ok?: string };

/** Owner: tell Bing & co. about every public page right now (IndexNow). */
export async function sendIndexNowNow(_: FormState): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const { pingSitemap } = await import("@/lib/indexnow");
  const r = await pingSitemap({ force: true, by: user.id });
  await logActivity({ actorUserId: user.id, action: "seo.indexnow_sent", targetType: "site", after: r });
  revalidatePath("/admin/launch");
  if (typeof r.status === "number" && r.status >= 200 && r.status < 300) return { ok: `Sent ${r.sent} pages to Bing, Yahoo, DuckDuckGo and other IndexNow search engines.` };
  return { error: `Not sent — ${r.status}. ${r.status === 403 || r.status === 422 ? "The search engine couldn't confirm the key yet; try again after the latest version is deployed." : "Try again later."}` };
}
