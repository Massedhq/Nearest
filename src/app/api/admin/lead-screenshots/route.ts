import { db, prospectDrafts } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { sniffImage, storeEvidence } from "@/lib/campaign-storage";
import { EMPTY_FIELDS, MAX_SCREENSHOTS, MAX_SCREENSHOT_BYTES, cleanFields, fillCounty, readScreenshots } from "@/lib/screenshot-leads";

export const maxDuration = 90;

/**
 * Admin: upload 1–5 screenshots of ONE professional. They're checked from their bytes, stored privately, read by AI
 * into a draft, and the draft goes to the screenshot review queue. Nothing becomes a prospect until it's approved.
 */
export async function POST(req: Request) {
  const { user } = await requireAdmin();
  let f: FormData;
  try { f = await req.formData(); } catch { return Response.json({ error: "Couldn't read the upload. Try again." }, { status: 400 }); }
  const files = f.getAll("shots").filter((x): x is File => x instanceof File && x.size > 0);
  if (!files.length) return Response.json({ error: "Choose at least one screenshot." }, { status: 400 });
  if (files.length > MAX_SCREENSHOTS) return Response.json({ error: `Up to ${MAX_SCREENSHOTS} screenshots of one professional at a time.` }, { status: 400 });
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
  const read = await readScreenshots(imgs);
  let fields = { ...EMPTY_FIELDS };
  let aiNote: string | null = null;
  if ("error" in read) aiNote = read.error;
  else {
    const filled = await fillCounty(await cleanFields(read.fields));
    fields = filled.fields;
    const notes = [read.unsure && `Check: ${read.unsure}`, filled.from === "zip" && `County looked up from ZIP ${fields.zip} — confirm it.`, filled.from === "city" && "County filled in from the city — confirm it."].filter(Boolean);
    aiNote = notes.length ? notes.join(" ") : null;
  }
  const [row] = await db.insert(prospectDrafts).values({ recruiterId: user.id, createdBy: user.id, images: stored, fields, aiNote }).returning();
  return Response.json({ ok: true, id: row.id });
}
