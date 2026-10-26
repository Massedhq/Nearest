"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";

type FormState = { error?: string; ok?: string };

/** Owner: fingerprint waiting portfolio photos now instead of waiting for the 15-minute run. */
export async function indexLooksNow(_: FormState): Promise<FormState> {
  const { user } = await requireAdmin({ owner: true });
  const { indexPendingLooks } = await import("@/lib/look-match");
  try {
    const r = await indexPendingLooks(45_000, 80);
    await logActivity({ actorUserId: user.id, action: "look_match.index_now", targetType: "portfolio_items", after: r });
    revalidatePath("/admin/photo-match");
    return { ok: `Added ${r.indexed} photo${r.indexed === 1 ? "" : "s"} to matching${r.failed ? ` • ${r.failed} couldn't be read` : ""}${r.left ? ` • ${r.left} still waiting (run again, or they'll be added automatically)` : ""}.` };
  } catch (e) {
    console.error("index now", e);
    return { error: "Matching couldn't start. Try again in a minute." };
  }
}
