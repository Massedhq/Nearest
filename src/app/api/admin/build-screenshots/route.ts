import { and, desc, eq } from "drizzle-orm";
import { db, prospects, prospectDrafts, professionalProfiles } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { sniffImage, storeEvidence } from "@/lib/campaign-storage";
import { MAX_SCREENSHOTS, MAX_SCREENSHOT_BYTES, cleanFields } from "@/lib/screenshot-leads";
import { mainOwnerId } from "@/lib/partner";

export const maxDuration = 60;

/**
 * Build a profile: keeps the screenshots used to build a professional's profile with their Outreach record, exactly
 * like an approved Add from screenshots lead (private; shown only in Admin). Optional — a profile never needs them.
 */
export async function POST(req: Request) {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") return Response.json({ error: "Only owners can build profiles." }, { status: 403 });
  let f: FormData;
  try { f = await req.formData(); } catch { return Response.json({ error: "Couldn't read the upload." }, { status: 400 }); }
  const userId = String(f.get("userId") ?? "");
  const p = /^[0-9a-f-]{36}$/.test(userId) ? await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) }) : null;
  if (!p?.builtBy || (p.builtBy !== user.id && (await mainOwnerId()) !== user.id)) return Response.json({ error: "Not found." }, { status: 404 });
  const files = f.getAll("shots").filter((x): x is File => x instanceof File && x.size > 0).slice(0, MAX_SCREENSHOTS);
  if (!files.length) return Response.json({ ok: true });
  if (files.reduce((t, x) => t + x.size, 0) > MAX_SCREENSHOT_BYTES) return Response.json({ error: "Those screenshots are too large together." }, { status: 413 });
  const imgs: { data: Buffer; mime: string }[] = [];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(data);
    if (!mime) return Response.json({ error: "Only JPG, PNG or WebP screenshots, please." }, { status: 400 });
    imgs.push({ data, mime });
  }
  let raw: Record<string, unknown> = {};
  try { raw = JSON.parse(String(f.get("fields") ?? "{}")); } catch { raw = {}; }
  const fields = await cleanFields(raw);
  const pr = (await db.select().from(prospects).where(eq(prospects.registeredUserId, userId)).orderBy(desc(prospects.updatedAt)).limit(1))[0];
  if (!pr) return Response.json({ error: "Their Outreach record wasn't found." }, { status: 404 });
  const images = [];
  for (const im of imgs) images.push({ ...(await storeEvidence(`lead-screenshots/${user.id}/shot.${im.mime.split("/")[1]}`, im.data, im.mime)), mime: im.mime });
  // One screenshot record per professional: add to it if there is one already.
  const existing = await db.query.prospectDrafts.findFirst({ where: and(eq(prospectDrafts.prospectId, pr.id), eq(prospectDrafts.status, "approved")) });
  if (existing) await db.update(prospectDrafts).set({ images: [...(existing.images as unknown[]), ...images].slice(0, 10), updatedAt: new Date() }).where(eq(prospectDrafts.id, existing.id));
  else await db.insert(prospectDrafts).values({ recruiterId: user.id, createdBy: user.id, images, fields, status: "approved", prospectId: pr.id, decidedBy: user.id, decidedAt: new Date() });
  return Response.json({ ok: true });
}
