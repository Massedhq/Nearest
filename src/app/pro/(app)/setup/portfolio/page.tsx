import { asc, desc, eq } from "drizzle-orm";
import { db, portfolioItems } from "@/db";
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
  const [steps, items] = await Promise.all([
    setupSteps(user.id),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, user.id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)),
  ]);
  return (
    <SetupShell steps={steps} current="portfolio" title="Show people what you do" edit={edit}>
      <Uploader userId={user.id} folder="portfolio" save={addPortfolio} label="Upload photos of your work" />
      <p className="xs muted p">Star up to 3 favorites to feature first. Instagram and TikTok import is coming later.</p>
      <PortfolioGrid items={items} />
      {!edit && (
        <ActionForm action={finishPortfolio} submitLabel={items.length ? "Continue" : "Skip for now"}>
          <span />
        </ActionForm>
      )}
      {edit && <a className="btn ghost" href="/pro/business"><Icon name="back" /> Done</a>}
    </SetupShell>
  );
}
