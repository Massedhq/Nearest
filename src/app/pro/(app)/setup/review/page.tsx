import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db, proServices, portfolioItems, cities } from "@/db";
import { requirePro, setupSteps, setupComplete } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { ProCard } from "@/components/ProCard";
import { Icon } from "@/components/Icon";
import { submitForReview } from "@/app/pro/actions";

export const metadata = { title: "Preview" };

export default async function ReviewStep() {
  const { user, profile: p } = await requirePro();
  const [steps, services, photos, city] = await Promise.all([
    setupSteps(user.id),
    db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
    db.select({ url: portfolioItems.url }).from(portfolioItems).where(eq(portfolioItems.userId, user.id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)).limit(3),
    p.cityId ? db.query.cities.findFirst({ where: eq(cities.id, p.cityId) }) : null,
  ]);
  const ready = setupComplete(steps);
  return (
    <div className="scr">
      <TopBar title="Preview" back="/pro/home" />
      <div className="body">
        <h1 className="disp h2">This is how customers see you.</h1>
        <ProCard p={p} services={services} photos={photos.map((x) => x.url)} city={city?.name ?? null} />
        <div className="card">
          <span className="eyebrow">Ready to go live</span>
          {steps.map((s) => (
            <Link key={s.key} href={s.href} className="row small" style={{ textDecoration: "none" }}>
              <Icon name={s.done ? "check" : "clock"} size="s" />
              <span className="grow">{s.label}</span>
              <span className={`tag ${s.done ? "ok" : s.optional ? "" : "warn"}`}>{s.done ? "Done" : s.optional ? "Optional" : "To do"}</span>
            </Link>
          ))}
          <div className="row small"><Icon name="shield" size="s" /><span className="grow">Identity verification</span><span className="tag">Phase 3</span></div>
          <div className="row small"><Icon name="card" size="s" /><span className="grow">Membership (30 days free)</span><span className="tag">Phase 3</span></div>
        </div>
        {p.reviewStatus === "submitted" && <div className="card ok small"><span className="b">Submitted — Nearest is reviewing your profile.</span><span className="muted">We&apos;ll let you know when you&apos;re approved.</span></div>}
        {p.reviewStatus === "approved" && <div className="card ok small"><span className="b">You&apos;re approved.</span></div>}
        {p.reviewStatus === "rejected" && <div className="card bad small"><span className="b">Changes needed</span><span>{p.reviewNote}</span></div>}
        {(p.reviewStatus === "draft" || p.reviewStatus === "rejected") && (
          <ActionForm action={submitForReview} submitLabel={ready ? "Submit for review" : "Finish setup first"}>
            <span />
          </ActionForm>
        )}
      </div>
    </div>
  );
}
