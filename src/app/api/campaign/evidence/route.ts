import { and, eq, ne, notInArray, sql } from "drizzle-orm";
import { db, campaignEntries, campaignEvidence, studentProfiles } from "@/db";
import { getViewer } from "@/lib/viewer";
import {
  CAMPAIGN_KEY, EVIDENCE_MAX_BYTES, MAX_UPLOADS_PER_WINDOW, campaignEligibility, entryFor, fmtWhen, getCampaign, parseProfileUrl, recordEvent,
} from "@/lib/campaign";
import { deleteEvidence, sniffImage, storeEvidence } from "@/lib/campaign-storage";

export const maxDuration = 30;
const fail = (error: string, status = 400) => Response.json({ error }, { status });

/**
 * A student sends a campaign screenshot. The SERVER decides the time and the window:
 *  - first upload (with the profile link) starts the 168-hour clock at the server's time;
 *  - later uploads count toward the daily window the server is in now (1–7), or the final proof after 168 hours.
 */
export async function POST(req: Request) {
  const viewer = await getViewer();
  const user = viewer?.user;
  if (!user || (user.accountType !== "student" && viewer?.admin?.role !== "OWNER")) return fail("Sign in to your student account.", 401);
  const entry = await entryFor(user.id);
  if (!entry) return fail("Join the launch campaign first.", 404);

  let form: FormData;
  try { form = await req.formData(); } catch { return fail("That upload didn't come through. Try again."); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Choose a screenshot.");
  if (file.size > EVIDENCE_MAX_BYTES) return fail("That screenshot is over 4 MB. Try a smaller one.");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffImage(buf);
  if (!mime) return fail("Screenshots must be JPG, PNG or WebP images.");
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const path = `campaign/${CAMPAIGN_KEY}/${entry.id}/${Date.now()}.${ext}`;

  // ---- Start: profile link + starting screenshot → the clock starts now (server time) ----
  if (entry.status === "reserved") {
    const profile = await db.query.studentProfiles.findFirst({ where: eq(studentProfiles.userId, user.id) });
    const el = await campaignEligibility(user, profile, await getCampaign());
    if (el.state !== "eligible") return fail("Your account isn't eligible to start right now. Open your campaign page for details.", 403);
    const link = parseProfileUrl(String(form.get("profileUrl") ?? ""));
    if ("error" in link) return fail(link.error);
    const taken = await db.select({ id: campaignEntries.id }).from(campaignEntries)
      .where(and(eq(campaignEntries.profileUrlNorm, link.norm), ne(campaignEntries.id, entry.id), notInArray(campaignEntries.status, ["cancelled", "rejected"]))).limit(1);
    if (taken.length) {
      await recordEvent(entry.id, user.id, "flagged", `Tried to start with a profile already used by another participant: ${link.url}`);
      return fail("That social profile is already part of the campaign. If it's yours, contact support@usenearest.com.", 409);
    }
    const stored = await storeEvidence(path, buf, mime);
    const started = await db.execute<{ started_at: Date; completes_at: Date }>(sql`
      update campaign_entries set status = 'in_progress', started_at = now(), completes_at = now() + interval '168 hours',
        platform = ${link.platform}, profile_url = ${link.url}, profile_url_norm = ${link.norm}, version = version + 1
      where id = ${entry.id}::uuid and student_id = ${user.id}::uuid and status = 'reserved' and started_at is null
      returning started_at, completes_at`);
    const row = started.rows[0];
    if (!row) { await deleteEvidence(stored.url); return fail("Your campaign already started. Refresh the page.", 409); }
    const startedAt = new Date(row.started_at), completesAt = new Date(row.completes_at);
    await db.insert(campaignEvidence).values({ entryId: entry.id, studentId: user.id, kind: "start", windowIndex: 1, storageUrl: stored.url, storageAccess: stored.access, mime, bytes: buf.length, uploadedAt: startedAt });
    await recordEvent(entry.id, user.id, "started", `Profile link ${link.url} and starting screenshot accepted. Seven days complete ${fmtWhen(completesAt)}.`);
    const { notifyOnce } = await import("@/lib/campaign-notify");
    await notifyOnce(`started:${entry.id}`, user.id, {
      title: "Your seven days have started",
      body: `Started ${fmtWhen(startedAt)}. Complete ${fmtWhen(completesAt)}. Upload one screenshot in each daily window.`,
      href: "/campaign",
      email: { subject: "Your Nearest launch campaign clock has started", heading: "Your seven days have started.", lines: [`Started: ${fmtWhen(startedAt)}`, `Seven full days complete: ${fmtWhen(completesAt)}`, "Upload one screenshot of your profile in each daily window on your campaign page, then a final screenshot after the seven days."], button: "Open my campaign" },
    });
    return Response.json({ ok: true, startedAt, completesAt });
  }

  // ---- Daily evidence or final proof: the window comes from the server clock ----
  if (!["in_progress", "ready_for_review", "needs_correction"].includes(entry.status) || !entry.startedAt) {
    return fail("Uploads aren't open for your campaign right now.", 409);
  }
  const stored = await storeEvidence(path, buf, mime);
  const win = sql`(case when now() >= e.completes_at then 8 else floor(extract(epoch from (now() - e.started_at)) / 86400)::int + 1 end)`;
  const ins = await db.execute<{ id: string; window_index: number; kind: string; uploaded_at: Date }>(sql`
    insert into campaign_evidence (entry_id, student_id, kind, window_index, storage_url, storage_access, mime, bytes)
    select e.id, e.student_id, case when now() >= e.completes_at then 'final' else 'daily' end, ${win},
      ${stored.url}, ${stored.access}, ${mime}, ${buf.length}
    from campaign_entries e
    where e.id = ${entry.id}::uuid and e.student_id = ${user.id}::uuid and e.started_at is not null
      and e.status in ('in_progress','ready_for_review','needs_correction')
      and (select count(*) from campaign_evidence x where x.entry_id = e.id and x.window_index = ${win}) < ${MAX_UPLOADS_PER_WINDOW}
    returning id, window_index, kind, uploaded_at`);
  const ev = ins.rows[0];
  if (!ev) { await deleteEvidence(stored.url); return fail(`You've already sent ${MAX_UPLOADS_PER_WINDOW} screenshots for this window.`, 409); }
  const uploadedAt = new Date(ev.uploaded_at);
  if (ev.kind === "final") {
    await db.update(campaignEntries).set({ finalProofAt: sql`coalesce(${campaignEntries.finalProofAt}, ${uploadedAt.toISOString()}::timestamptz)`, version: sql`${campaignEntries.version} + 1` }).where(eq(campaignEntries.id, entry.id));
    await recordEvent(entry.id, user.id, "final_proof", "Final screenshot sent — ready for Nearest's final review.");
  }
  return Response.json({ ok: true, window: ev.window_index, kind: ev.kind, uploadedAt });
}
