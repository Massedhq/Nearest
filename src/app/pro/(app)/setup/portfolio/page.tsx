import { asc, desc, eq } from "drizzle-orm";
import { db, portfolioItems, proServices } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { Icon } from "@/components/Icon";
import { addPortfolio, finishPortfolio } from "@/app/pro/actions";

export const metadata = { title: "Portfolio" };

export default async function PortfolioStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, items, services] = await Promise.all([
    setupSteps(user.id),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, user.id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)),
    db.select({ id: proServices.id, name: proServices.name }).from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
  ]);
  const MAX = 10;
  return (
    <SetupShell steps={steps} current="portfolio" title="Show people what you do" edit={edit}>
      <div className="row between"><span className="small b">Your work</span><span className={`tag ${items.length >= MAX ? "warn" : ""}`}>{items.length} of {MAX} photos</span></div>
      {items.length < MAX
        ? <Uploader userId={user.id} folder="portfolio" save={addPortfolio} label={`Upload photos of your work (up to ${MAX - items.length} more)`} />
        : <p className="small muted p">You&apos;re showing the full {MAX}. Remove a photo to add a different one.</p>}
      <p className="xs muted p">Star up to 3 favorites to show first. Pick the service each photo shows so students can tap it and <span className="b">Book this look</span>.</p>
      <PortfolioGrid items={items} services={services} />
      {!edit && (
        <ActionForm action={finishPortfolio} submitLabel={items.length ? "Continue" : "Skip for now"}>
          <span />
        </ActionForm>
      )}
      {edit && <a className="btn ghost" href="/pro/business"><Icon name="back" /> Done</a>}
    </SetupShell>
  );
}
