import { eq } from "drizzle-orm";
import { db, studentProfiles } from "@/db";
import { getViewer } from "@/lib/viewer";
import { schoolArea } from "@/lib/student";
import { studentSuspendedUntil } from "@/lib/enforcement";
import { sniffImage } from "@/lib/campaign-storage";
import { findLookMatches } from "@/lib/look-match";
import { nearPoint, miles } from "@/lib/near";

export const maxDuration = 60;
const fail = (error: string, status = 400) => Response.json({ ok: false, error }, { status });

/**
 * Find by photo: the student's inspo photo comes in (already shrunk on the phone), is compared with professionals'
 * portfolio photos, and is thrown away — it is never saved anywhere.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  const user = viewer?.user;
  if (!user || (user.accountType !== "student" && viewer?.admin?.role !== "OWNER")) return fail("Sign in to your student account.", 401);
  const profile = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, user.id) });
  if (profile && studentSuspendedUntil(profile)) return fail("Booking is temporarily unavailable on your account.", 403);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("That photo didn't come through. Try again."); }
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a photo.");
  if (file.size > 8 * 1024 * 1024) return fail("That photo is too large. Try a smaller one.");
  const image = Buffer.from(await file.arrayBuffer());
  if (!sniffImage(image)) return fail("Photos must be JPG, PNG or WebP.");
  const cat = String(form.get("category") ?? "");
  const categoryId = /^\d+$/.test(cat) ? Number(cat) : null;

  const area = profile?.schoolId ? await schoolArea(profile.schoolId) : null;
  const res = await findLookMatches({ studentId: user.id, area, image, categoryId });
  if (!res.ok) return fail(res.error, 429);
  const here = await nearPoint();
  return Response.json({
    ...res,
    matches: res.matches.map(({ lat, lng, ...m }) => ({ ...m, miles: here ? miles(here, { lat, lng }) : null })),
  });
}
