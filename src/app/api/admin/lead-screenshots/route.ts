import { and, eq } from "drizzle-orm";
import { db, prospectDrafts } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { sniffImage, storeEvidence } from "@/lib/campaign-storage";
import { FIELD_LABEL } from "@/lib/lead-parse";
import { EMPTY_FIELDS, MAX_SCREENSHOTS, MAX_SCREENSHOT_BYTES, canSeeDraft, cleanFields, fillCounty, type DraftFields } from "@/lib/screenshot-leads";

export const maxDuration = 60;

const clip = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
/** For comparing details: ignores case, punctuation and "Texas" vs "TX". */
const same = (v: unknown) => String(v).toLowerCase().replace(/\btexas\b/g, "tx").replace(/[^a-z0-9]/g, "");
function json<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (typeof raw !== "string" || !raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/**
 * Admin: upload 1–5 screenshots of ONE professional. The browser has already read their text (self-hosted OCR, no AI
 * service) and sent the details it found as "fields". Screenshots are checked from their bytes and stored privately;
 * the details go into a draft in the screenshot review queue. Nothing becomes a prospect until it's approved.
 * With "draftId", the screenshots are added to that draft: only empty fields are filled — anything already there
 * (including a person's corrections) is kept, and a different value is noted for review instead.
 */
export async function POST(req: Request) {
  const { user } = await requireAdmin();
  let f: FormData;
  try { f = await req.formData(); } catch { return Response.json({ error: "Couldn't read the upload. Try again." }, { status: 400 }); }
  const files = f.getAll("shots").filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return Response.json({ error: "Choose at least one screenshot." }, { status: 400 });

  const draftId = clip(f.get("draftId"), 40);
  const existing = draftId ? await db.query.prospectDrafts.findFirst({ where: eq(prospectDrafts.id, draftId) }) : null;
  if (draftId && (!existing || existing.status !== "review" || !(await canSeeDraft(user.id, existing.recruiterId)))) return Response.json({ error: "That draft isn't open for review any more." }, { status: 404 });
  const already = existing ? (existing.images as unknown[]).length : 0;
  if (already + files.length > MAX_SCREENSHOTS) return Response.json({ error: `Up to ${MAX_SCREENSHOTS} screenshots of one professional${already ? ` (this draft has ${already})` : ""}.` }, { status: 400 });
  const total = files.reduce((t, x) => t + x.size, 0);
  if (total > MAX_SCREENSHOT_BYTES) return Response.json({ error: "Those screenshots are too large together. Upload fewer at a time." }, { status: 413 });
  const imgs: { data: Buffer; mime: string }[] = [];
  for (const file of files) {
    const data = Buffer.from(await file.arrayBuffer());
    const mime = sniffImage(data);
    if (!mime) return Response.json({ error: "Only JPG, PNG or WebP screenshots, please." }, { status: 400 });
    imgs.push({ data, mime });
  }
  const stored = [];
  for (const im of imgs) {
    const s = await storeEvidence(`lead-screenshots/${user.id}/shot.${im.mime.split("/")[1]}`, im.data, im.mime);
    stored.push({ ...s, mime: im.mime });
  }

  // What the browser read. Anything it couldn't read is simply left empty — nothing is guessed here.
  const raw = json<Record<string, unknown>>(f.get("fields"), {});
  const conflicts = json<unknown[]>(f.get("conflicts"), []).map((c) => clip(c, 200)).filter(Boolean).slice(0, 12);
  const readError = clip(f.get("readError"), 300);
  const read = await cleanFields({ ...raw, state: raw.state || (raw.city ? "TX" : "") });
  const readSomething = Object.entries(read).some(([k, v]) => k !== "state" && v);

  const notes: string[] = [];
  if (readError) notes.push(`${readError} Fill in the details from the screenshots.`);
  else if (!readSomething) notes.push("No details could be read from these screenshots. Fill them in from the screenshots.");
  const disagree = conflicts.filter((c) => / vs /.test(c)), confirm = conflicts.filter((c) => !/ vs /.test(c));
  if (disagree.length) notes.push(`The screenshots don't agree — check: ${disagree.join("; ")}.`);
  if (confirm.length) notes.push(`Check: ${confirm.join("; ")}.`);

  if (existing) {
    const cur = existing.fields as DraftFields;
    const merged = { ...cur } as Record<keyof DraftFields, unknown>;
    const differ: string[] = [];
    for (const k of Object.keys(read) as (keyof DraftFields)[]) {
      const v = read[k];
      if (!v || k === "notes" || (k === "state" && cur.state)) continue;
      if (!cur[k]) merged[k] = v; // fill blanks only
      else if (k !== "otherServices" && same(cur[k]) !== same(v)) differ.push(`${k === "categoryId" ? "Category" : FIELD_LABEL[k as keyof typeof FIELD_LABEL] ?? k}: kept "${cur[k]}", new screenshot shows "${v}"`);
    }
    if (differ.length) notes.push(`New screenshots show different details — ${differ.join("; ")}.`);
    const filled = await fillCounty(merged as DraftFields);
    if (filled.from) notes.push(`County filled in from the ${filled.from === "zip" ? `ZIP ${filled.fields.zip}` : "city"} — confirm it.`);
    const aiNote = [existing.aiNote, ...notes].filter(Boolean).join(" ").slice(0, 2000) || null;
    await db.update(prospectDrafts).set({ images: [...(existing.images as unknown[]), ...stored], fields: filled.fields, aiNote, updatedAt: new Date() })
      .where(and(eq(prospectDrafts.id, existing.id), eq(prospectDrafts.status, "review")));
    return Response.json({ ok: true, id: existing.id });
  }

  const filled = await fillCounty({ ...EMPTY_FIELDS, ...read, state: read.state || "TX" });
  if (filled.from) notes.push(`County filled in from the ${filled.from === "zip" ? `ZIP ${filled.fields.zip}` : "city"} — confirm it.`);
  const [row] = await db.insert(prospectDrafts).values({ recruiterId: user.id, createdBy: user.id, images: stored, fields: filled.fields, aiNote: notes.join(" ") || null }).returning();
  return Response.json({ ok: true, id: row.id });
}
