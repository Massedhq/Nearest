import { and, eq, gte, sql } from "drizzle-orm";
import { db, outreachMeetings } from "@/db";
import { deleteEvidence, sniffImage, storeEvidence } from "@/lib/campaign-storage";
import { announceMeeting, createMeeting, type BookInput } from "@/lib/meet";

export const maxDuration = 30;
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * Public: book a meeting with the Director of Outreach. Photos (the professional's and a friend's) are sniffed,
 * stored privately and shown only to owners. The booking rules live in src/lib/meet.ts.
 */
export async function POST(req: Request) {
  let form: FormData;
  try { form = await req.formData(); } catch { return fail("That didn't come through. Try again."); }
  if (String(form.get("website") ?? "")) return Response.json({ ok: true, id: "x" }); // bots fill the hidden field
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 64) || null;
  if (ip) {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(outreachMeetings).where(and(eq(outreachMeetings.ip, ip), gte(outreachMeetings.createdAt, new Date(Date.now() - 3600 * 1000))));
    if (n >= 5) return fail("Too many bookings from this connection. Try again later.", 429);
  }
  let data: Omit<BookInput, "photo" | "friend" | "ip"> & { friend?: Omit<NonNullable<BookInput["friend"]>, "photo"> | null };
  try { data = JSON.parse(String(form.get("data") ?? "")); } catch { return fail("Something was missing. Please start again."); }

  const readPhoto = async (key: string) => {
    const f = form.get(key);
    if (!(f instanceof File) || f.size === 0) return null;
    if (f.size > 8 * 1024 * 1024) return "big" as const;
    const buf = Buffer.from(await f.arrayBuffer());
    const mime = sniffImage(buf);
    return mime ? { buf, mime } : ("bad" as const);
  };
  const mine = await readPhoto("photo");
  if (!mine) return fail("Upload a photo of yourself so I know who I'm meeting.");
  if (mine === "big" || mine === "bad") return fail("Your photo must be a JPG, PNG or WebP under 8 MB.");
  let theirs: Awaited<ReturnType<typeof readPhoto>> = null;
  if (data.friend) {
    theirs = await readPhoto("friendPhoto");
    if (!theirs) return fail("Upload a photo of your friend too.");
    if (theirs === "big" || theirs === "bad") return fail("Your friend's photo must be a JPG, PNG or WebP under 8 MB.");
  }
  const day = new Date().toISOString().slice(0, 10);
  const ext = (m: string) => (m === "image/png" ? "png" : m === "image/webp" ? "webp" : "jpg");
  const photo = await storeEvidence(`meet/${day}/pro.${ext(mine.mime)}`, mine.buf, mine.mime);
  const friendPhoto = theirs && typeof theirs === "object" ? await storeEvidence(`meet/${day}/friend.${ext(theirs.mime)}`, theirs.buf, theirs.mime) : null;

  const res = await createMeeting({
    ...data, photo, friend: data.friend && friendPhoto ? { ...data.friend, photo: friendPhoto } : null, ip,
  } as BookInput);
  if (!res.ok) {
    await deleteEvidence(photo.url);
    if (friendPhoto) await deleteEvidence(friendPhoto.url);
    return fail(res.error, 409);
  }
  await announceMeeting(res.id);
  return Response.json({ ok: true, id: res.id });
}
