import Link from "next/link";
import { AdminHead } from "@/components/AdminHead";
import { LearnClassForm } from "@/components/LearnClassForm";
import { requireAdmin } from "@/lib/admin";
import { allClasses, LEARN_STATUS } from "@/lib/learn";

export const metadata = { title: "Learn at Nearest" };

/** Owners: the Learn at Nearest class library (coming soon for professionals). */
export default async function LearnAdmin() {
  const { user, role } = await requireAdmin();
  const classes = await allClasses().catch(() => []);
  return (
    <>
      <AdminHead eyebrow="Professionals only • Coming soon" title="Learn at Nearest" />
      <div className="card warn small" style={{ gap: 6 }}>
        <span className="b">Nothing is sold yet.</span>
        <span>Professionals see classes you mark &ldquo;Show to professionals&rdquo; as covers and titles labeled Coming soon. Only admins can play the videos. Videos and covers are private and only open inside Nearest.</span>
      </div>
      <div className="acols">
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Classes ({classes.length})</span>
          {classes.length === 0 && <span className="small muted">No classes yet. Add the first one.</span>}
          <div className="col" style={{ gap: 10 }}>
            {classes.map((c) => (
              <Link key={c.id} href={`/admin/learn/${c.id}`} className="row" style={{ gap: 14, textDecoration: "none", color: "inherit" }}>
                {c.coverUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={`/api/learn/${c.id}/cover`} alt="" style={{ width: 64, aspectRatio: "9 / 16", objectFit: "cover", borderRadius: 10, flex: "none" }} />
                  : <div style={{ width: 64, aspectRatio: "9 / 16", borderRadius: 10, background: "#1C1C1F", flex: "none" }} />}
                <div className="col g4" style={{ minWidth: 0 }}>
                  <span className="b">{c.title}</span>
                  <span className="small muted">by {c.educatorName}{c.category ? ` • ${c.category}` : ""}</span>
                  <span className={`tag ${c.status === "published" ? "ok" : c.status === "hidden" ? "bad" : ""}`} style={{ alignSelf: "flex-start" }}>{LEARN_STATUS[c.status] ?? c.status}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
        <div className="card" style={{ gap: 12 }}>
          <span className="eyebrow">Add a class</span>
          {role === "OWNER" ? <LearnClassForm userId={user.id} /> : <span className="small muted">Only owners can add classes.</span>}
        </div>
      </div>
    </>
  );
}
