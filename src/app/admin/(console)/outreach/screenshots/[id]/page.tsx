import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, prospectDrafts, categories } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { requireAdmin } from "@/lib/admin";
import { canSeeDraft, draftDuplicate, draftProblems, EMPTY_FIELDS, MAX_SCREENSHOTS, SCREENSHOT_SOURCES, type DraftFields } from "@/lib/screenshot-leads";
import { discardScreenshotDraft, saveScreenshotDraft } from "@/app/admin/screenshot-lead-actions";
import { ScreenshotLeadUpload } from "@/components/ScreenshotLeadUpload";

export const metadata = { title: "Check screenshot lead" };
export const dynamic = "force-dynamic";

/** Screenshots on one side, the details read from them (in the browser) on the other. Fix anything, then approve into a prospect. */
export default async function ScreenshotDraft({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const d = await db.query.prospectDrafts.findFirst({ where: eq(prospectDrafts.id, id) });
  if (!d || !(await canSeeDraft(user.id, d.recruiterId))) notFound();
  const f = { ...EMPTY_FIELDS, ...(d.fields as Partial<DraftFields>) }; // drafts saved before newer fields existed
  const [cats, dup] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name)),
    d.status === "review" ? draftDuplicate(f) : null,
  ]);
  const missing = draftProblems(f);
  const images = d.images as unknown[];
  const field = (k: keyof DraftFields, label: string, extra: Record<string, unknown> = {}) => (
    <div className="field"><label htmlFor={`sd-${k}`}>{label}</label><input id={`sd-${k}`} name={k} defaultValue={String(f[k] ?? "")} {...extra} /></div>
  );
  return (
    <>
      <AdminHead eyebrow="Add from screenshots" title={f.name || f.business || "Screenshot lead"} />
      <OutreachNav at="screenshots" />
      <Link className="link small" href="/admin/outreach/screenshots">← Back to the review queue</Link>
      {d.status !== "review" ? (
        <div className="card small"><span>{d.status === "approved" ? <>Approved — <Link className="link" href={`/admin/outreach/prospects/${d.prospectId}`}>open the prospect</Link>.</> : "This draft was discarded."}</span></div>
      ) : (
        <div className="acols">
          <div className="card" style={{ gap: 10 }}>
            <span className="eyebrow">Screenshots</span>
            {images.length === 0 && <span className="small muted">No screenshots.</span>}
            {images.map((_, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={i} href={`/api/admin/lead-screenshots/${d.id}/${i}`} target="_blank" rel="noreferrer"><img src={`/api/admin/lead-screenshots/${d.id}/${i}`} alt={`Screenshot ${i + 1}`} style={{ width: "100%", borderRadius: 10, border: "1px solid #2A2A2D" }} /></a>
            ))}
            <span className="xs muted">Tap a screenshot to open it full size.</span>
            <ScreenshotLeadUpload draftId={d.id} room={MAX_SCREENSHOTS - images.length} />
          </div>

          <div className="card" style={{ gap: 12 }}>
            <span className="eyebrow">Details read from the screenshots</span>
            {d.aiNote && <div className="card warn small"><span>{d.aiNote}</span></div>}
            {dup && (
              <div className="card warn small" style={{ gap: 4 }}>
                <span className="b">{dup.kind === "prospect" ? "Already in Outreach" : dup.kind === "professional" ? "Already a Nearest professional" : "On the do-not-contact list"}</span>
                {dup.kind === "prospect" && <span>{dup.name}{dup.owner ? ` (with ${dup.owner})` : ""} — <Link className="link" href={`/admin/outreach/prospects/${dup.id}`}>open it</Link>. This draft can&apos;t be approved; discard it.</span>}
                {dup.kind === "professional" && <span><Link className="link" href={`/admin/professionals/${dup.id}`}>Open their account</Link>. No need to recruit them — discard this draft.</span>}
                {dup.kind === "suppressed" && <span>They asked not to be contacted, so they can&apos;t be added.</span>}
              </div>
            )}
            <div className={`card small${missing.length ? " warn" : " ok"}`}><span>{missing.length ? <>Still needed before approving: <span className="b">{missing.join(", ")}</span>.</> : "Everything required is filled in. Check each detail against the screenshots, then approve."}</span></div>

            <ActionForm action={saveScreenshotDraft} submitLabel="Save changes" buttonClass="btn ghost" className="col g16">
              <input type="hidden" name="id" value={d.id} />
              <span className="eyebrow" style={{ marginBottom: -6 }}>Professional</span>
              {field("name", "Professional or contact name *", { maxLength: 120 })}
              {field("business", "Business name", { maxLength: 120 })}
              <div className="field"><label htmlFor="sd-cat">Main service category *</label>
                <select id="sd-cat" name="categoryId" defaultValue={f.categoryId ?? ""}><option value="">Choose a category</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              {field("otherServices", "Other services they offer", { maxLength: 300 })}
              {field("credentials", "Credentials as they state them (not verified)", { maxLength: 200, placeholder: "e.g. Licensed Esthetician" })}

              <span className="eyebrow" style={{ marginBottom: -6 }}>Location</span>
              {field("address", "Street address", { maxLength: 200 })}
              <div className="grid2">
                {field("city", "City *", { maxLength: 80 })}
                {field("county", "County *", { maxLength: 80 })}
              </div>
              <div className="grid2">
                {field("state", "State *", { maxLength: 2, style: { textTransform: "uppercase" } })}
                {field("zip", "ZIP", { maxLength: 10, inputMode: "numeric" })}
              </div>

              <span className="eyebrow" style={{ marginBottom: -6 }}>Contact — at least one *</span>
              {field("email", "Email", { type: "email", maxLength: 160 })}
              {field("phone", "Phone", { type: "tel", maxLength: 30 })}
              {field("instagram", "Instagram handle (without @)", { maxLength: 80 })}
              {field("facebook", "Facebook page", { maxLength: 120 })}
              {field("profileLink", "Profile link", { maxLength: 200 })}
              {field("website", "Website or link in bio", { maxLength: 200 })}
              {field("bookingLink", "Booking link", { maxLength: 200 })}
              <span className="xs muted" style={{ marginTop: -8 }}>Without an email, the prospect is saved as &ldquo;Needs information&rdquo; and isn&apos;t used for email outreach.</span>

              <span className="eyebrow" style={{ marginBottom: -6 }}>More</span>
              <div className="field"><label htmlFor="sd-src">Where the screenshots are from</label>
                <select id="sd-src" name="source" defaultValue={f.source}><option value="">Not sure — choose where they were found</option>{SCREENSHOT_SOURCES.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
              {field("hours", "Business hours", { maxLength: 300 })}
              {field("prices", "Listed service prices", { maxLength: 500, placeholder: "e.g. Classic full set $85; Brow lamination $60" })}
              {field("deposit", "Deposit (kept separate from service prices)", { maxLength: 60, placeholder: "e.g. $25" })}
              <div className="field"><label htmlFor="sd-notes">Notes</label><textarea id="sd-notes" name="notes" defaultValue={f.notes} maxLength={1500} rows={3} /></div>
              {!dup && <button className="btn" type="submit" name="approve" value="1">Approve and add to my prospects</button>}
            </ActionForm>
            <form action={discardScreenshotDraft}><input type="hidden" name="id" value={d.id} /><button className="link xs" type="submit" style={{ color: "#E08A8A" }}>Discard — not a lead (removes the screenshots)</button></form>
          </div>
        </div>
      )}
    </>
  );
}
