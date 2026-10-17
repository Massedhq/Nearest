import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users, professionalProfiles } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { OutreachNav } from "@/components/OutreachNav";
import { ActionForm } from "@/components/ActionForm";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { outreachScope } from "@/lib/outreach";
import { setupSteps } from "@/lib/pro";
import { enrollmentQuote } from "@/lib/enroll";
import { buildStatus } from "@/lib/build-status";
import { editBuiltProfile, sendClaimLink } from "@/app/admin/build-actions";

export const metadata = { title: "Built profile" };
export const dynamic = "force-dynamic";

const day = (d: Date | null) => d ? d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "—";

export default async function BuiltProfile({ params }: { params: Promise<{ id: string }> }) {
  const { user, role } = await requireAdmin();
  const { id } = await params;
  if (role !== "OWNER" || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const row = (await db.select({ p: professionalProfiles, u: users }).from(professionalProfiles).innerJoin(users, eq(users.id, professionalProfiles.userId)).where(eq(professionalProfiles.userId, id)).limit(1))[0];
  if (!row?.p.builtBy) notFound();
  const { isMain } = await outreachScope(user.id);
  if (!isMain && row.p.builtBy !== user.id) notFound();
  const { p, u } = row;
  const open = !p.claimedAt && !p.entryPaidAt; // still Nearest's to edit
  const [steps, quote, builder] = await Promise.all([
    setupSteps(id),
    open ? enrollmentQuote(p) : null,
    db.query.users.findFirst({ where: eq(users.id, p.builtBy!), columns: { firstName: true } }),
  ]);
  const left = steps.filter((s) => !s.done && !s.optional && s.key !== "identity");
  const s = buildStatus(p);
  const stepForm = (key: string, label: string) => (
    <form action={editBuiltProfile}><input type="hidden" name="userId" value={id} /><input type="hidden" name="step" value={key} /><button type="submit" className="link small">{label}</button></form>
  );
  return (
    <>
      <AdminHead eyebrow="Build a profile" title={[u.firstName, u.lastName].filter(Boolean).join(" ") || "Professional"} />
      <OutreachNav at="build" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className={`tag ${s.tone}`}>{s.label}</span>
        <span className="small muted">{u.email}{u.phone ? ` • ${u.phone}` : ""} • Built by {builder?.firstName ?? "—"} {day(p.builtAt)}</span>
        <Link className="link small" href="/admin/outreach/build">← All built profiles</Link>
      </div>

      {open ? (
        <>
          <div className="card" style={{ gap: 8, maxWidth: 720 }}>
            <span className="eyebrow">Their profile</span>
            {steps.map((st) => (
              <div key={st.key} className="row small" style={{ gap: 8 }}>
                <Icon name={st.done ? "check" : "clock"} size="s" />
                <span className="grow">{st.label}{st.key === "identity" ? " — they do this after claiming" : ""}</span>
                {st.key !== "identity" && stepForm(st.key, st.done ? "Edit" : "Fill in")}
                <span className={`tag ${st.done ? "ok" : st.optional || st.key === "identity" ? "" : "warn"}`}>{st.done ? "Done" : st.optional ? "Optional" : st.key === "identity" ? "Theirs" : "To do"}</span>
              </div>
            ))}
            <form action={editBuiltProfile}><input type="hidden" name="userId" value={id} /><input type="hidden" name="step" value={left[0]?.key ?? "profile"} /><button className="btn" type="submit">{left.length ? "Continue building" : "Open their profile"}</button></form>
          </div>
          {quote && !quote.ok && <div className="card warn small" style={{ maxWidth: 720 }}><span className="b">Check their city before sending the link</span><span>{quote.reason.replace(/^Your city/, "Their city")}</span></div>}
          <div className="card" style={{ gap: 8, maxWidth: 720 }}>
            <span className="eyebrow">Claim link</span>
            <span className="small">They get an email with a button to create their password. Then they accept the Professional Terms and their profile goes live (students see them once their ID is verified). The link works once and lasts 14 days; sending again replaces it.</span>
            {p.claimSentAt && <span className="xs muted">Last sent {day(p.claimSentAt)}{p.claimExpiresAt ? ` • expires ${day(p.claimExpiresAt)}` : ""}</span>}
            {left.length > 0 ? <span className="small muted">Finish {left.map((x) => x.label).join(", ")} first.</span> : (
              <ActionForm action={sendClaimLink} submitLabel={p.claimSentAt ? "Send a new link" : `Email the link to ${u.email}`}>
                <input type="hidden" name="userId" value={id} />
              </ActionForm>
            )}
          </div>
        </>
      ) : (
        <div className="card small" style={{ gap: 6, maxWidth: 720 }}>
          <span>{p.entryPaidAt ? `They accepted the Professional Terms ${day(p.proTermsAcceptedAt)}. It's their account now — they edit it themselves.` : `They set their password ${day(p.claimedAt)}. Next they accept the Terms (shown the moment they sign in).`}</span>
          <Link className="link small" href={`/admin/professionals/${id}`}>Open their Nearest account →</Link>
        </div>
      )}
    </>
  );
}
