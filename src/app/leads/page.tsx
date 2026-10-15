import Image from "next/image";
import { headers } from "next/headers";
import { SignOutButton } from "@clerk/nextjs";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, categories, leadInvites } from "@/db";
import { getViewer } from "@/lib/viewer";
import { contributorForUser, LEAD_LINK_DAYS, LEAD_SOURCES } from "@/lib/lead-contributors";
import { fmtDate } from "@/lib/time";
import { ActionForm } from "@/components/ActionForm";
import { CopyText } from "@/components/CopyText";
import { LeadEntryForm } from "@/components/LeadEntryForm";
import { addLead, createLeadLink, revokeLeadLink } from "./actions";

export const metadata = { title: "Professional Prospect Entry", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PROBLEMS: Record<string, string> = {
  invalid: "That invitation link isn't valid. Ask Nearest for a new one.",
  email: "You're signed in with a different email than the one your invitation was made for. Sign out, then sign in or create your login with the invited email.",
  removed: "This Lead Contributor access is no longer active.",
  expired: "This invitation has expired. Ask Nearest for a new one.",
  account: "This email already has another kind of Nearest account. Ask Nearest to invite a different email.",
};

/**
 * The Lead Contributor workspace — the only page they can use. It shows the entry form, the invitation-link form and
 * their own links. No prospect lists, recruiting outcomes or other contributors' activity.
 */
export default async function LeadWorkspace({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  const viewer = await getViewer();
  const contributor = await contributorForUser(viewer?.user?.id);
  if (!viewer?.user || !contributor) {
    return (
      <div className="scr" style={{ justifyContent: "center" }}>
        <div className="body" style={{ flex: "none", alignItems: "center" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={72} height={72} />
          <h1 className="disp h2">Professional Prospect Entry</h1>
          <div className="card warn" style={{ width: "100%", maxWidth: 420 }}>
            <span className="small">{PROBLEMS[e ?? ""] ?? "This page is for Nearest Lead Contributors. Open the invitation link Nearest sent you to get started."}</span>
            {viewer && <SignOutButton redirectUrl="/"><button className="btn ghost" type="button">Sign out</button></SignOutButton>}
          </div>
        </div>
      </div>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const [cats, links] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select().from(leadInvites).where(and(eq(leadInvites.contributorId, contributor.id))).orderBy(desc(leadInvites.createdAt)).limit(50),
  ]);
  const now = Date.now();
  const linkState = (l: typeof links[number]) => l.status === "submitted" ? "Submission received" : l.status === "revoked" ? "Turned off" : l.expiresAt.getTime() <= now ? "Expired" : "Waiting";

  return (
    <div className="scr">
      <div className="body" style={{ maxWidth: 760, margin: "0 auto", width: "100%", gap: 20 }}>
        <div className="row between">
          <Image src="/brand/nearest-monogram.png" alt="Nearest" width={44} height={44} />
          <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button">Sign out</button></SignOutButton>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Signed in as {contributor.name}</span>
          <h1 className="disp h1" style={{ margin: 0 }}>Professional Prospect Entry</h1>
          <p className="small muted p" style={{ margin: 0 }}>Add beauty and wellness professionals you&apos;ve found, or send them a link to share their own details. Nearest reviews every lead and handles all contact — nothing is sent to them automatically.</p>
        </div>

        <section className="card" style={{ gap: 16 }} aria-labelledby="add-h">
          <div className="col" style={{ gap: 4 }}>
            <h2 id="add-h" className="disp h2" style={{ margin: 0 }}>Add a prospect</h2>
            <span className="small muted">Required: name, service category, city, county and state, and at least one way to reach them.</span>
          </div>
          <LeadEntryForm action={addLead} categories={cats} sources={LEAD_SOURCES} />
        </section>

        <section className="card" style={{ gap: 16 }} aria-labelledby="link-h">
          <div className="col" style={{ gap: 4 }}>
            <h2 id="link-h" className="disp h2" style={{ margin: 0 }}>Create an invitation link</h2>
            <span className="small muted">Each link is for one professional. It opens a short Nearest interest form — they don&apos;t need an account. Copy the link and send it to them yourself.</span>
          </div>
          <ActionForm action={createLeadLink} submitLabel="Create link" className="col g16">
            <div className="field"><label htmlFor="lk-label">Who it&apos;s for (only you see this)</label><input id="lk-label" name="label" maxLength={120} placeholder="e.g. Jas — nail tech on Main St" /></div>
            <div className="field"><label htmlFor="lk-src">Where you found them</label><select id="lk-src" name="source" defaultValue=""><option value="">Choose a source</option>{LEAD_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
            <div className="field"><label htmlFor="lk-days">Link works for</label><select id="lk-days" name="days" defaultValue="14">{LEAD_LINK_DAYS.map((d) => <option key={d} value={d}>{d} days</option>)}</select></div>
          </ActionForm>

          <div className="col" style={{ gap: 8 }}>
            <span className="eyebrow">Your invitation links</span>
            {links.length === 0 && <span className="small muted">No links yet.</span>}
            {links.map((l) => {
              const usable = l.status === "active" && l.expiresAt.getTime() > now;
              return (
                <div key={l.id} className="card small" style={{ gap: 6 }}>
                  <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
                    <span className="b">{l.label || "Invitation link"}</span>
                    <span className={`tag${l.status === "submitted" ? " ok" : usable ? "" : " bad"}`}>{linkState(l)}</span>
                  </div>
                  <span className="xs muted">Created {fmtDate(l.createdAt, { month: "short", day: "numeric" })} • {l.status === "submitted" && l.submittedAt ? `received ${fmtDate(l.submittedAt, { month: "short", day: "numeric" })}` : `works until ${fmtDate(l.expiresAt, { month: "short", day: "numeric" })}`}{l.source ? ` • ${l.source}` : ""}</span>
                  {usable && (
                    <div className="col" style={{ gap: 8 }}>
                      <input readOnly value={`${origin}/leads/i/${l.token}`} className="ainput" aria-label="Invitation link" style={{ width: "100%" }} />
                      <div className="row" style={{ gap: 12, alignItems: "center" }}>
                        <CopyText text={`${origin}/leads/i/${l.token}`} label="Copy link" />
                        <form action={revokeLeadLink}><input type="hidden" name="id" value={l.id} /><button className="link xs" type="submit">Turn off this link</button></form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
