import { ActionForm } from "./ActionForm";
import { LearnUpload } from "./LearnUpload";
import { saveLearnClass } from "@/app/admin/learn-actions";
import type { learnClasses } from "@/db";

const CATS = ["Hair Styling", "Nail Services", "Lash Extensions", "Makeup Artistry", "Brows", "Barbering", "Braiding", "Locs", "Facials", "Skincare", "Massage Therapy", "Fitness & Recovery"];

/** Owners: the class form (title, educator credit, category, description, cover, video, written-license confirmation). */
export function LearnClassForm({ userId, c }: { userId: string; c?: typeof learnClasses.$inferSelect | null }) {
  return (
    <ActionForm action={saveLearnClass} submitLabel={c ? "Save changes" : "Add class"}>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="field"><label htmlFor="lc-title">Title</label><input id="lc-title" name="title" required maxLength={120} defaultValue={c?.title ?? ""} placeholder="The Viral Barbie Ponytail" /></div>
      <div className="field"><label htmlFor="lc-edu">Educator (gets the credit)</label><input id="lc-edu" name="educator" required maxLength={80} defaultValue={c?.educatorName ?? ""} placeholder="Their name or business" /></div>
      <div className="field"><label htmlFor="lc-link">Educator&apos;s link (optional)</label><input id="lc-link" name="educatorLink" maxLength={300} defaultValue={c?.educatorLink ?? ""} placeholder="instagram.com/theirname" /></div>
      <div className="field"><label htmlFor="lc-cat">Category</label><input id="lc-cat" name="category" list="lc-cats" maxLength={60} defaultValue={c?.category ?? ""} placeholder="Hair Styling" /><datalist id="lc-cats">{CATS.map((x) => <option key={x} value={x} />)}</datalist></div>
      <div className="field"><label htmlFor="lc-price">Price for 30 days of access</label><input id="lc-price" name="price" inputMode="decimal" maxLength={10} defaultValue={c?.priceCents != null ? (c.priceCents / 100).toFixed(c.priceCents % 100 ? 2 : 0) : ""} placeholder="$45" /><span className="xs muted">What a professional will pay to watch this class for 30 days. Shown to professionals now; nothing can be bought until classes open.</span></div>
      <div className="field"><label htmlFor="lc-desc">What they&apos;ll learn (optional)</label><textarea id="lc-desc" name="description" rows={4} maxLength={2000} defaultValue={c?.description ?? ""} /></div>
      <div className="col" style={{ gap: 6 }}><span className="small b">Cover</span><span className="xs muted">A tall picture works best (like a phone screen).</span><LearnUpload userId={userId} kind="cover" has={c?.coverUrl} /></div>
      <div className="col" style={{ gap: 6 }}><span className="small b">Class video</span><span className="xs muted">Stored private. It only plays inside Nearest — never a link that can be shared or downloaded.</span><LearnUpload userId={userId} kind="video" has={c?.videoUrl} />{c?.videoName && <span className="xs muted">Current video: {c.videoName}{c.videoSize ? ` (${Math.round(c.videoSize / 1048576)} MB)` : ""}</span>}</div>
      <label className="row small" style={{ gap: 10, alignItems: "flex-start" }}>
        <input type="checkbox" name="license" defaultChecked={Boolean(c?.licenseConfirmedAt)} style={{ marginTop: 3 }} />
        <span>I have a <span className="b">written agreement</span> with this educator that lets Nearest host this class and sell access to professionals. (Buying a class for yourself isn&apos;t enough.)</span>
      </label>
    </ActionForm>
  );
}
