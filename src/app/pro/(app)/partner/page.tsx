import Link from "next/link";
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

export const metadata = { title: "Partner page" };
export const dynamic = "force-dynamic";

/** Business → Partner page: the link-in-bio page approved Nearest Partners share (usenearest.com/link/<slug>). */
export default async function PartnerEditor() {
  const { user, profile } = await requirePro();
  const page = await partnerPageFor(user.id);

  if (!page) {
    const u = await db.query.users.findFirst({ where: eq(users.id, user.id), columns: { email: true } });
    const app = u?.email ? (await db.select().from(partnerApplications).where(eq(partnerApplications.email, normEmail(u.email))).orderBy(desc(partnerApplications.createdAt)).limit(1))[0] : undefined;
    return (
      <div className="scr">
        <TopBar title="Partner page" back="/pro/business" />
        <div className="body">
          <div className="card" style={{ gap: 10 }}>
            <span className="disp h2">Nearest Partner</span>
            <span className="small">A link-in-bio page with your services, Model Calls, videos and shop links — booking happens on Nearest. For beauty educators and creators.</span>
            {app?.status === "new" && <span className="tag warn" style={{ alignSelf: "flex-start" }}>Application in review</span>}
            {app?.status === "declined" && <span className="small muted">Your last application wasn&apos;t approved{app.note ? `: ${app.note}` : "."}</span>}
            {app?.status !== "new" && <Link className="btn" href={`${PARTNER_APPLY_PATH}#apply`}>Apply to become a partner</Link>}
            <Link className="btn ghost" href={PARTNER_DEMO_PATH}>See the demo</Link>
            <span className="small muted">Apply with the email you use to sign in ({u?.email}).</span>
          </div>
        </div>
      </div>
    );
  }

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
