import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, partnerApplications, proServices, users } from "@/db";
import { requirePro } from "@/lib/pro";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { TopBar } from "@/components/TopBar";
import { savePartnerPage } from "@/app/pro/partner-actions";
import { normEmail, partnerPageFor, partnerPageLink, partnerPagePath, PARTNER_APPLY_PATH, PARTNER_DEMO_PATH, PARTNER_LIMITS } from "@/lib/partners";
import { ensureProSlug } from "@/lib/connections";
import { money } from "@/lib/time";
import { SITE_URL } from "@/lib/public/site";

export const metadata = { title: "Partner page" };
export const dynamic = "force-dynamic";

/** Business → Partner page: the link-in-bio page approved Nearest Partners share (usenearest.com/link/<slug>). */
export default async function PartnerEditor({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { user, profile } = await requirePro();
  const welcome = (await searchParams).welcome === "1";
  const page = await partnerPageFor(user.id);

  if (!page) redirect("/pro/business"); // partner accounts are switched on by Nearest — nothing to apply for here

  const [services, slug] = await Promise.all([
    db.select().from(proServices).where(and(eq(proServices.userId, user.id), eq(proServices.active, true))).orderBy(asc(proServices.sort)),
    ensureProSlug(user.id),
  ]);
  const link = slug ? partnerPageLink(slug) : null;
  const linkRows = [...page.links, ...Array.from({ length: Math.max(2, Math.min(3, PARTNER_LIMITS.links - page.links.length)) }, () => null)].slice(0, PARTNER_LIMITS.links);
  const videoRows = [...page.videos, ...Array.from({ length: Math.max(2, Math.min(3, PARTNER_LIMITS.videos - page.videos.length)) }, () => null)].slice(0, PARTNER_LIMITS.videos);
  const live = page.published && !page.pausedAt && profile.reviewStatus === "approved";

  return (
    <div className="scr">
      <TopBar title="Partner page" back="/pro/business" />
      <div className="body" style={{ gap: 16 }}>
        {welcome && link && (
          <div className="card" style={{ gap: 10, borderColor: "#E8C4C0" }}>
            <span className="disp h2">You&apos;re live.</span>
            <span className="small">Your link to share — put it in your Instagram and TikTok bio:</span>
            <span className="b" style={{ wordBreak: "break-all" }}>{link}</span>
            <div className="row" style={{ gap: 16 }}><CopyButton text={link} /><Link className="link small" href={partnerPagePath(slug!)} target="_blank">Open my page</Link></div>
            <span className="small">Sign in any time at <span className="b">{SITE_URL.replace(/^https?:\/\//, "")}/pro/sign-in</span> with your email and password, or have a sign-in code emailed to you. Forgot your password? Tap Forgot password there to set a new one.</span>
            <CopyButton text={`${SITE_URL}/pro/sign-in`} label="Copy sign-in link" />
            {profile.identityStatus !== "verified" && <Link className="btn sm" href="/pro/setup/identity?welcome=1">Verify your ID so clients can book you</Link>}
          </div>
        )}
        <div className="card" style={{ gap: 10 }}>
          <div className="row between"><span className="b">Your link</span><span className={`tag ${live ? "ok" : "warn"}`}>{page.pausedAt ? "Paused by Nearest" : live ? "Live" : page.published ? "Live after your profile is approved" : "Hidden"}</span></div>
          {link ? <span className="small" style={{ wordBreak: "break-all" }}>{link}</span> : <span className="small muted">Your link is created once your business name is saved.</span>}
          {link && <div className="row" style={{ gap: 16 }}><CopyButton text={link} /><Link className="link small" href={partnerPagePath(slug!)} target="_blank">Open my page</Link></div>}
          <span className="small muted">Put it in your Instagram and TikTok bio. Your photo, name, rating, social links and services come from your profile — edit those in Business.</span>
        </div>

        <div className="card" style={{ gap: 8 }}>
          <span className="b">My shop</span>
          <span className="small muted">Sell digital downloads (like a workbook — delivered the moment they pay) and physical products (shampoo, tools, lash kits) right on your page.</span>
          <div className="row" style={{ gap: 16 }}><Link className="link small" href="/pro/partner/shop">Products</Link><Link className="link small" href="/pro/partner/orders">Orders</Link></div>
        </div>

        <ActionForm action={savePartnerPage} submitLabel="Save my page" className="col g16">
          <div className="col g8">
            <span className="lbl">Name on my partner page</span>
            <label className="check small" style={{ alignItems: "flex-start" }}><input type="radio" name="nameChoice" value="own" defaultChecked={!page.useAlias} /><span>Show my name{profile.displayName || user.firstName ? ` (${profile.displayName || user.firstName})` : ""}</span></label>
            <label className="check small" style={{ alignItems: "flex-start" }}><input type="radio" name="nameChoice" value="alias" defaultChecked={page.useAlias} /><span>Show a different name — a nickname, alias or brand name</span></label>
            <div className="field"><label htmlFor="pp-alias">Different name (used only if you pick it above)</label><input id="pp-alias" name="alias" maxLength={60} defaultValue={page.alias ?? ""} placeholder="e.g. Lashes by Kay" /></div>
            <span className="xs muted">This changes the name on your partner page and partner bookings only. Your student-side profile and your legal name don&apos;t change.</span>
          </div>
          <div className="field"><label htmlFor="pp-head">Headline (under your name)</label><input id="pp-head" name="headline" maxLength={PARTNER_LIMITS.headline} defaultValue={page.headline ?? ""} placeholder="Beauty educator · Brows, lashes & glam" /></div>

          <div className="col g8">
            <span className="eyebrow">Top services (up to {PARTNER_LIMITS.top})</span>
            {services.length === 0 && <span className="small muted">Add services in Business → Services &amp; prices first.</span>}
            {services.map((s) => (
              <label key={s.id} className="row small" style={{ gap: 10 }}>
                <input type="checkbox" name="top" value={s.id} defaultChecked={page.topServiceIds.includes(s.id)} />
                <span className="grow">{s.name}</span><span className="muted">{money(s.priceCents)} · {s.durationMin} min</span>
              </label>
            ))}
            <span className="small muted">None picked? Your first four services show.</span>
          </div>

          <div className="col g8">
            <span className="eyebrow">Shop &amp; links</span>
            {linkRows.map((l, i) => (
              <div key={l?.id ?? `n${i}`} className="card" style={{ gap: 8, padding: 12 }}>
                <div className="field"><label htmlFor={`lt${i}`}>Link {i + 1} title</label><input id={`lt${i}`} name="link_title" maxLength={PARTNER_LIMITS.title} defaultValue={l?.title ?? ""} placeholder="Shop my brow stain line" /></div>
                <div className="field"><label htmlFor={`lu${i}`}>Web address</label><input id={`lu${i}`} name="link_url" inputMode="url" maxLength={500} defaultValue={l?.url ?? ""} placeholder="https://" /></div>
                <div className="field"><label htmlFor={`ln${i}`}>Short note (optional)</label><input id={`ln${i}`} name="link_note" maxLength={80} defaultValue={l?.note ?? ""} placeholder="The tools I use every day" /></div>
              </div>
            ))}
            <span className="small muted">Clear a title and address to remove a link. Save to get more empty rows (up to {PARTNER_LIMITS.links}). Links show in this order.</span>
          </div>

          <div className="col g8">
            <span className="eyebrow">Learn with me videos</span>
            {videoRows.map((v, i) => (
              <div key={v?.id ?? `v${i}`} className="card" style={{ gap: 8, padding: 12 }}>
                <div className="field"><label htmlFor={`vt${i}`}>Video {i + 1} title</label><input id={`vt${i}`} name="video_title" maxLength={PARTNER_LIMITS.title} defaultValue={v?.title ?? ""} placeholder="Fuller brows in 60 seconds" /></div>
                <div className="field"><label htmlFor={`vu${i}`}>Video link</label><input id={`vu${i}`} name="video_url" inputMode="url" maxLength={500} defaultValue={v?.url ?? ""} placeholder="YouTube, TikTok, Instagram or Vimeo link" /></div>
              </div>
            ))}
          </div>

          <label className="row" style={{ gap: 10 }}><input type="checkbox" name="published" defaultChecked={page.published} /><span><b>Page is live</b><br /><span className="small muted">Anyone with your link can see it. Turn off to hide it.</span></span></label>
        </ActionForm>

        <div className="card" style={{ gap: 8 }}>
          <span className="b">Save to their phone</span>
          <span className="small muted">Your page has a Save to my phone button. Clients who tap it get your page on their home screen like an app, with your photo as the icon.</span>
        </div>
      </div>
    </div>
  );
}
