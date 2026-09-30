import { asc, desc, eq } from "drizzle-orm";
import { db, portfolioItems, proServices } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { Icon } from "@/components/Icon";
import { addPortfolio, addPortfolioVideo, finishPortfolio } from "@/app/pro/actions";
import { VideoUploader } from "@/components/VideoUploader";
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_SECONDS } from "@/lib/portfolio-limits";

export const metadata = { title: "Portfolio" };

export default async function PortfolioStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, items, services] = await Promise.all([
    setupSteps(user.id),
    db.select().from(portfolioItems).where(eq(portfolioItems.userId, user.id)).orderBy(desc(portfolioItems.featured), asc(portfolioItems.sort)),
    db.select({ id: proServices.id, name: proServices.name }).from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
  ]);
  const MAX = MAX_PHOTOS;
  const photoCount = items.filter((i) => i.kind !== "video").length;
  const videoCount = items.filter((i) => i.kind === "video").length;
  return (
    <SetupShell steps={steps} current="portfolio" title="Show people what you do" edit={edit}>
      <div className="row between" style={{ flexWrap: "wrap", gap: 6 }}>
        <span className="small b">Your work</span>
        <span className="row" style={{ gap: 6 }}>
          <span className={`tag ${photoCount >= MAX ? "warn" : ""}`}>{photoCount} of {MAX} photos</span>
          <span className={`tag ${videoCount >= MAX_VIDEOS ? "warn" : ""}`}>{videoCount} of {MAX_VIDEOS} videos</span>
        </span>
      </div>
      {photoCount < MAX
        ? <Uploader userId={user.id} folder="portfolio" save={addPortfolio} label={`Upload photos of your work (up to ${MAX - photoCount} more)`} />
        : <p className="small muted p">You&apos;re showing the full {MAX} photos. Remove one to add a different one.</p>}
      {videoCount < MAX_VIDEOS
        ? <VideoUploader userId={user.id} save={addPortfolioVideo} label={`Upload a video (${MAX_VIDEO_SECONDS} seconds max)`} />
        : <p className="small muted p">You&apos;re showing the full {MAX_VIDEOS} videos. Remove one to add a different one.</p>}
      <p className="xs muted p">Videos can be up to {MAX_VIDEO_SECONDS} seconds — MP4, or straight from your phone&apos;s camera. Star up to 3 favorites to show first. Pick the service each photo or video shows so students can tap it and <span className="b">Book this look</span>.</p>
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
