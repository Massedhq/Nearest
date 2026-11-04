import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, learnClasses } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { LearnClassForm } from "@/components/LearnClassForm";
import { LearnPlayer } from "@/components/LearnPlayer";
import { requireAdmin } from "@/lib/admin";
import { LEARN_STATUS, publishProblems } from "@/lib/learn";
import { setLearnStatus, deleteLearnClass } from "@/app/admin/learn-actions";

export const metadata = { title: "Learn at Nearest — class" };

export default async function LearnClass({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ added?: string; blocked?: string }> }) {
  const { user, role } = await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const c = await db.query.learnClasses.findFirst({ where: eq(learnClasses.id, id) });
  if (!c) notFound();
  const problems = publishProblems(c);
  const isOwner = role === "OWNER";
  const viewerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Nearest";
  return (
    <>
      <AdminHead eyebrow="Learn at Nearest" title={c.title} />
      <Link className="link small" href="/admin/learn">← All classes</Link>
      {sp.added && <div className="card ok small">Class added. Check the preview, then show it to professionals when it&apos;s ready.</div>}
      {sp.blocked && problems.length > 0 && <div className="card warn small">Before professionals can see this class, add {problems.join(", ")}.</div>}
      <div className="acols">
        <div className="col g16">
          <div className="card" style={{ gap: 12 }}>
            <div className="row between"><span className="eyebrow">Preview (admins only)</span><span className={`tag ${c.status === "published" ? "ok" : c.status === "hidden" ? "bad" : ""}`}>{LEARN_STATUS[c.status] ?? c.status}</span></div>
            {c.videoUrl ? <LearnPlayer id={c.id} title={c.title} watermark={viewerName} /> : <span className="small muted">No video yet.</span>}
            <span className="small">by <span className="b">{c.educatorName}</span>{c.educatorLink && <> • <a className="link" href={c.educatorLink} target="_blank" rel="noopener noreferrer">their page</a></>}</span>
            {c.description && <p className="small p" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.description}</p>}
            {isOwner && (
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                {c.status !== "published" && <form action={setLearnStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="published" /><button className="btn sm" type="submit" disabled={problems.length > 0}>Show to professionals (Coming soon)</button></form>}
                {c.status === "published" && <form action={setLearnStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="hidden" /><button className="btn ghost sm" type="submit">Hide from professionals</button></form>}
                <form action={deleteLearnClass}><input type="hidden" name="id" value={c.id} /><button className="link small" type="submit" style={{ color: "#F2A38F" }}>Delete class</button></form>
              </div>
            )}
            {problems.length > 0 && <span className="xs muted">Still needed before professionals can see it: {problems.join(", ")}.</span>}
          </div>
        </div>
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Edit</span>
          {isOwner ? <LearnClassForm userId={user.id} c={c} /> : <span className="small muted">Only owners can edit classes.</span>}
        </div>
      </div>
    </>
  );
}
