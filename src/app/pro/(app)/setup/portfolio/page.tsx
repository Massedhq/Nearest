import { asc, desc, eq } from "drizzle-orm";
import { db, portfolioItems, proServices } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { PortfolioGrid } from "@/components/PortfolioGrid";
import { Icon } from "@/components/Icon";
import { addPortfolio, addPortfolioVideo, finishPortfolio, addLookPhotos, removeLookPhoto, addLookVideo, removeLookVideo } from "@/app/pro/actions";
import { VideoUploader } from "@/components/VideoUploader";
import { MAX_PHOTOS, MAX_VIDEOS, MAX_VIDEO_SECONDS, LOOK_MAX_PHOTOS, LOOK_VIDEO_SECONDS, LOOK_VIDEO_MB } from "@/lib/portfolio-limits";

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
      {items.some((i) => i.kind !== "video") && (
        <div id="whole-look" className="col" style={{ gap: 10 }}>
          <div className="col" style={{ gap: 2 }}>
            <span className="small b">Add more photos &amp; a 360° video to each look</span>
            <span className="xs muted">Every photo below can have up to {LOOK_MAX_PHOTOS - 1} more photos of the same look (front, side, back) and one 360° video (up to {LOOK_VIDEO_SECONDS} seconds, MP4 or straight from your phone&apos;s camera). Clients see them when they tap the photo — the video opens from <span className="b">See video of this look</span>.</span>
          </div>
          {items.filter((i) => i.kind !== "video").map((it, n) => (
            <div key={it.id} id={`look-${it.id}`} className="card" style={{ gap: 10, padding: 12 }}>
              <div className="row" style={{ gap: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt="" width={56} height={56} style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flex: "none" }} />
                <span className="grow small"><span className="b">Look {n + 1}{it.serviceId ? ` · ${services.find((x) => x.id === it.serviceId)?.name ?? ""}` : ""}</span><br /><span className="xs muted">{1 + it.lookPhotos.length} of {LOOK_MAX_PHOTOS} photos · {it.lookVideoUrl ? `360° video added (${Math.round(it.lookVideoSec ?? 0)}s)` : "no video yet"}</span></span>
              </div>
              {it.lookPhotos.length > 0 && (
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  {it.lookPhotos.map((u) => (
                    <form key={u} action={removeLookPhoto} style={{ position: "relative" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt="" width={64} height={64} style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover" }} />
                      <input type="hidden" name="id" value={it.id} /><input type="hidden" name="url" value={u} />
                      <button type="submit" className="iconbtn" aria-label="Remove this photo" style={{ position: "absolute", top: 2, right: 2, width: 24, height: 24 }}><Icon name="trash" size="s" /></button>
                    </form>
                  ))}
                </div>
              )}
              {1 + it.lookPhotos.length < LOOK_MAX_PHOTOS
                ? <Uploader userId={user.id} folder="look-photo" save={addLookPhotos.bind(null, it.id)} label={`Add more photos of this look (up to ${LOOK_MAX_PHOTOS - 1 - it.lookPhotos.length} more)`} />
                : <span className="xs muted">This look has the full {LOOK_MAX_PHOTOS} photos.</span>}
              {it.lookVideoUrl && (
                <div className="col" style={{ gap: 6 }}>
                  <video src={`${it.lookVideoUrl}#t=0.1`} controls playsInline preload="metadata" style={{ width: "100%", maxHeight: 280, borderRadius: 10, background: "#111" }} />
                  <form action={removeLookVideo}><input type="hidden" name="id" value={it.id} /><button type="submit" className="btn ghost sm">Remove video</button></form>
                </div>
              )}
              <VideoUploader userId={user.id} folder="look-video" maxSeconds={LOOK_VIDEO_SECONDS} maxMb={LOOK_VIDEO_MB} save={addLookVideo.bind(null, it.id)} label={it.lookVideoUrl ? "Replace the 360° video" : `Upload a 360° video of this look (up to ${LOOK_VIDEO_SECONDS} sec)`} />
            </div>
          ))}
        </div>
      )}
      {!edit && (
        <ActionForm action={finishPortfolio} submitLabel={items.length ? "Continue" : "Skip for now"} laterLabel="Save & finish later">
          <span />
        </ActionForm>
      )}
      {edit && <a className="btn ghost" href="/pro/business"><Icon name="back" /> Done</a>}
    </SetupShell>
  );
}
