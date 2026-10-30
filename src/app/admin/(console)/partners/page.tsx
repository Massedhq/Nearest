import Link from "next/link";
import { asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, partnerApplications, partnerOrders, partnerPages, professionalProfiles, users, categories, cities } from "@/db";
import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { BuildProfileForm } from "@/components/BuildProfileForm";
import { requireAdmin } from "@/lib/admin";
import { fmtDate, money } from "@/lib/time";
import { personName } from "@/lib/pro-name";
import { setupSteps } from "@/lib/pro";
import { HANDOFF, HANDOFF_MODES, type HandoffMode } from "@/lib/partner-handoff";
import { partnerApplyLink, partnerDemoLink, partnerSetupDemoLink, partnerPageLink, partnerPagePath, PARTNER_DEMO_PATH, PARTNER_SETUP_DEMO_PATH, PARTNER_APPLY_PATH } from "@/lib/partners";
import { LinkSender } from "@/components/LinkSender";
import { decidePartnerApplication, setPartnerPagePaused, refundPartnerOrder, sendPartnerLink } from "@/app/admin/partner-actions";
import { editBuiltProfile } from "@/app/admin/build-actions";
import { sellerAmount } from "@/lib/shop";
import { SITE_URL } from "@/lib/public/site";

export const metadata = { title: "Partner pages" };
export const dynamic = "force-dynamic";

const VIEWS = [["added", "Partners you added"], ["applications", "Applications"], ["pages", "All partner pages"], ["orders", "Shop orders"], ["links", "Links & demos"]] as const;
const APP_TABS = [["new", "New"], ["approved", "Approved"], ["declined", "Declined"]] as const;
type View = (typeof VIEWS)[number][0];

/**
 * Owner: everything about Nearest Partners in one place, separate from Outreach and sales reps — partners you added
 * yourself (build their profile, send their setup / finish / approve link), applications, every partner page, shop
 * orders, and the links and demos to share.
 */
export default async function PartnersAdmin({ searchParams }: { searchParams: Promise<{ show?: string; view?: string; app?: string }> }) {
  await requireAdmin({ owner: true });
  const sp = await searchParams;
  const view: View = (VIEWS.some(([k]) => k === sp.view) ? sp.view : sp.show === "added" ? "added" : sp.show && APP_TABS.some(([k]) => k === sp.show) ? "applications" : "added") as View;
  const appTab = APP_TABS.some(([k]) => k === (sp.app ?? sp.show)) ? (sp.app ?? sp.show)! : "new";
  const [counts, addedCount] = await Promise.all([
    db.select({ status: partnerApplications.status, n: sql<number>`count(*)::int` }).from(partnerApplications).groupBy(partnerApplications.status),
    db.select({ n: sql<number>`count(*)::int` }).from(partnerPages).where(isNotNull(partnerPages.addedBy)),
  ]);
  const count = (k: string) => counts.find((c) => c.status === k)?.n ?? 0;

  return (
    <>
      <AdminHead eyebrow="Owner only · separate from Outreach and sales reps" title="Partner pages" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {VIEWS.map(([k, l]) => <a key={k} className={`chip${view === k ? " on" : ""}`} href={`/admin/partners?view=${k}`}>{l}{k === "added" ? ` (${addedCount[0]?.n ?? 0})` : k === "applications" && count("new") ? ` (${count("new")} new)` : ""}</a>)}
      </div>
      {view === "added" && <Added />}
      {view === "applications" && <Applications tab={appTab} count={count} />}
      {view === "pages" && <Pages />}
      {view === "orders" && <Orders />}
      {view === "links" && <Links />}
    </>
  );
}

/** Partners an owner added: add one, build their profile, and send one of the three links. */
async function Added() {
  const [cats, cityList, rows] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select({ id: cities.id, name: cities.name, state: cities.state }).from(cities).where(eq(cities.active, true)).orderBy(asc(cities.state), asc(cities.name)),
    db.select({ page: partnerPages, p: professionalProfiles, u: users }).from(partnerPages)
      .innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerPages.userId)).innerJoin(users, eq(users.id, partnerPages.userId))
      .where(isNotNull(partnerPages.addedBy)).orderBy(desc(partnerPages.approvedAt)).limit(200),
  ]);
  const left = new Map(await Promise.all(rows.map(async (r) => [r.u.id, (await setupSteps(r.u.id)).filter((s) => !s.done && !s.optional && s.key !== "identity")] as const)));
  const day = (d: Date | null) => (d ? fmtDate(d, { month: "short", day: "numeric" }) : "");

  return (
    <>
      <div className="card" style={{ gap: 6, maxWidth: 760 }}>
        <span className="b">Found someone on Instagram? Add them here.</span>
        <span className="small">They&apos;re approved as a partner right away. Then pick how their profile gets done:</span>
        <ul className="small" style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6 }}>
          <li><b>They set up everything themselves</b> — their setup link is emailed now.</li>
          <li><b>You start it, they finish</b> — build what you can, then send the finish link.</li>
          <li><b>You finish it, they approve</b> — build all of it, then send the approve link. They look it over, tap Approve, and their page goes live with their link to share.</li>
        </ul>
        <span className="xs muted">Every link is one-time and lasts 14 days. They create a password with it; after that they sign in at {SITE_URL.replace(/^https?:\/\//, "")}/pro/sign-in (Forgot password resets it). Partners you add here never show in Outreach.</span>
      </div>
      <details className="card" style={{ maxWidth: 760 }}>
        <summary className="b" style={{ cursor: "pointer" }}>+ Add a partner</summary>
        <div style={{ paddingTop: 12 }}>
          <BuildProfileForm partner categories={cats} cities={cityList} initial={{ firstName: "", lastName: "", email: "", phone: "", businessName: "", categoryId: null, cityId: null, prospectId: null }} />
        </div>
      </details>

      {rows.length === 0 && <div className="card"><span className="small muted">No partners added yet.</span></div>}
      {rows.map(({ page, p, u }) => {
        const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
        const steps = left.get(u.id) ?? [];
        const claimed = Boolean(p.claimedAt) || !p.builtBy; // their own account (signed up themselves, or switched from Ambassador)
        const mode = (page.handoff ?? null) as HandoffMode | null;
        const expired = !claimed && p.claimExpiresAt && p.claimExpiresAt.getTime() < Date.now();
        const live = p.reviewStatus === "approved" && page.published && !page.pausedAt;
        const status: [string, string] =
          live ? [p.identityStatus === "verified" ? "Live" : "Live — waiting on their ID so clients can book", p.identityStatus === "verified" ? "ok" : "warn"]
          : p.entryPaidAt && p.reviewStatus === "submitted" ? ["Submitted — review it in Verification Queue", "warn"]
          : claimed && mode === "approve" ? ["Password set — hasn't approved yet", "warn"]
          : claimed ? [`Setting up their profile${steps.length ? ` — ${steps.length} step${steps.length === 1 ? "" : "s"} left` : " — ready to submit"}`, "warn"]
          : expired ? ["Link expired — send a new one", "bad"]
          : mode ? [`Link sent ${day(page.handoffSentAt)} — ${HANDOFF[mode].admin.toLowerCase()}`, "warn"]
          : [steps.length ? `You're building it — ${steps.length} step${steps.length === 1 ? "" : "s"} left` : "Built — send the approve link", ""];
        return (
          <div key={u.id} id={`p-${u.id}`} className="card" style={{ gap: 10 }}>
            <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
              <span className="col g4"><span className="b">{name}{p.businessName ? <span className="muted small"> · {p.businessName}</span> : null}</span><span className="xs muted">{u.email}{p.instagram ? ` · @${p.instagram}` : ""} · added {day(page.approvedAt)}</span></span>
              <span className={`tag ${status[1]}`}>{status[0]}</span>
            </div>
            {!claimed && steps.length > 0 && <span className="xs muted">Left to do: {steps.map((s) => s.label).join(", ")}</span>}
            {!claimed && (
              <div className="col g8">
                <form action={editBuiltProfile}><input type="hidden" name="userId" value={u.id} /><input type="hidden" name="step" value={steps[0]?.key ?? "profile"} /><button className="btn ghost sm" type="submit">{steps.length ? "Build their profile" : "Open their profile"}</button></form>
                <span className="xs muted">Partner page, links, videos and shop are under Business → Partner page while you&apos;re building.</span>
                <div className="col g12">
                  {HANDOFF_MODES.map((m) => (
                    <div key={m} className="col g4">
                      <span className="small b">{HANDOFF[m].button.replace(/^Send link: /, "Link: ")}</span>
                      <LinkSender action={sendPartnerLink} fields={{ userId: u.id, mode: m }} primary={m === "approve" && !steps.length} emailLabel="Email it" copyLabel="Copy link to text or DM" />
                    </div>
                  ))}
                </div>
                <span className="xs muted">Each tap makes a new link and the old one stops working. Copy puts the link on your clipboard so you can paste it in a text or DM.</span>
              </div>
            )}
            {claimed && (
              <div className="col g4">
                <span className="small">They sign in at <b>{SITE_URL.replace(/^https?:\/\//, "")}/pro/sign-in</b> (Forgot password lets them set a new one).</span>
                {live && p.slug && <div className="row" style={{ gap: 14, flexWrap: "wrap" }}><span className="small" style={{ wordBreak: "break-all" }}>{partnerPageLink(p.slug)}</span><CopyButton text={partnerPageLink(p.slug)} /><Link className="link small" href={partnerPagePath(p.slug)} target="_blank">Open</Link></div>}
                <Link className="link small" href={`/admin/professionals/${u.id}`}>Review account</Link>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

async function Applications({ tab, count }: { tab: string; count: (k: string) => number }) {
  const apps = await db.select().from(partnerApplications).where(eq(partnerApplications.status, tab)).orderBy(desc(partnerApplications.createdAt)).limit(200);
  return (
    <>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {APP_TABS.map(([k, l]) => <a key={k} className={`chip${tab === k ? " on" : ""}`} href={`/admin/partners?view=applications&app=${k}`}>{l} ({count(k)})</a>)}
      </div>
      <span className="xs muted">People who applied at {SITE_URL.replace(/^https?:\/\//, "")}/partners. Partners you add yourself are under Partners you added.</span>
      {apps.length === 0 && <div className="card"><span className="small muted">Nothing here yet.</span></div>}
      {apps.map((a) => (
        <div key={a.id} id={`a-${a.id}`} className="card" style={{ gap: 10 }}>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="b">{a.name}</span><span className="xs muted">{fmtDate(a.createdAt, { month: "short", day: "numeric", year: "numeric" })}</span></div>
          <span className="small">{a.specialty} · {a.city}{a.state ? `, ${a.state}` : ""}{a.instagram ? <> · <a className="link" href={`https://www.instagram.com/${encodeURIComponent(a.instagram)}/`} target="_blank" rel="noopener noreferrer">@{a.instagram}</a></> : null}</span>
          <span className="small">{a.email}</span>
          {a.about && <span className="small muted">{a.about}</span>}
          {a.note && <span className="small"><span className="muted">Note:</span> {a.note}</span>}
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
            {a.status !== "approved" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Approve" buttonClass="btn sm" className="col g4">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="approved" />
              </ActionForm>
            )}
            {a.status !== "declined" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Decline" buttonClass="btn ghost sm" className="row g8">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="declined" />
                <div className="field" style={{ minWidth: 200 }}><label htmlFor={`n-${a.id}`}>Note to them (optional)</label><input id={`n-${a.id}`} name="note" maxLength={500} /></div>
              </ActionForm>
            )}
            {a.status !== "new" && (
              <ActionForm action={decidePartnerApplication} submitLabel="Move back to New" buttonClass="btn ghost sm" className="col g4">
                <input type="hidden" name="id" value={a.id} /><input type="hidden" name="to" value="new" />
              </ActionForm>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

async function Pages() {
  const pages = await db.select({ page: partnerPages, slug: professionalProfiles.slug, displayName: professionalProfiles.displayName, business: professionalProfiles.businessName, review: professionalProfiles.reviewStatus, first: users.firstName, last: users.lastName, email: users.email })
    .from(partnerPages).innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerPages.userId)).innerJoin(users, eq(users.id, partnerPages.userId))
    .orderBy(desc(partnerPages.approvedAt));
  return (
    <>
      {pages.length === 0 && <div className="card"><span className="small muted">Partners with a professional account show here.</span></div>}
      {pages.map((r) => {
        const name = personName(r.displayName, r.first, r.last);
        const state = r.page.pausedAt ? ["Paused", "bad"] : !r.page.published ? ["Hidden by them", ""] : r.review !== "approved" ? ["Waiting for profile approval", "warn"] : ["Live", "ok"];
        return (
          <div key={r.page.userId} className="card" style={{ gap: 8 }}>
            <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}>
              <Link className="b" href={`/admin/professionals/${r.page.userId}`}>{name}{r.business ? <span className="muted small"> · {r.business}</span> : null}</Link>
              <span className="row" style={{ gap: 6 }}>{r.page.addedBy && <span className="tag">Added by you</span>}<span className={`tag ${state[1]}`}>{state[0]}</span></span>
            </div>
            <span className="small muted">{r.email} · {r.page.links.length} links · {r.page.videos.length} videos</span>
            {r.slug && <div className="row" style={{ gap: 14, flexWrap: "wrap" }}><span className="small" style={{ wordBreak: "break-all" }}>{partnerPageLink(r.slug)}</span><CopyButton text={partnerPageLink(r.slug)} /><Link className="link small" href={partnerPagePath(r.slug)} target="_blank">Open</Link></div>}
            <ActionForm action={setPartnerPagePaused} submitLabel={r.page.pausedAt ? "Resume page" : "Pause page"} buttonClass="btn ghost sm" className="col g4">
              <input type="hidden" name="userId" value={r.page.userId} /><input type="hidden" name="pause" value={r.page.pausedAt ? "0" : "1"} />
            </ActionForm>
          </div>
        );
      })}
    </>
  );
}

async function Orders() {
  const orders = await db.select({ o: partnerOrders, business: professionalProfiles.businessName, displayName: professionalProfiles.displayName })
    .from(partnerOrders).innerJoin(professionalProfiles, eq(professionalProfiles.userId, partnerOrders.sellerId))
    .where(inArray(partnerOrders.status, ["paid", "shipped", "refunded"])).orderBy(desc(partnerOrders.paidAt)).limit(50);
  const sales = orders.filter((r) => r.o.status !== "refunded").reduce((n, r) => n + r.o.totalCents, 0);
  const fees = orders.filter((r) => r.o.status !== "refunded").reduce((n, r) => n + r.o.feeCents, 0);
  return (
    <>
      <div className="card" style={{ gap: 6 }}>
        <span className="small">Last {orders.length} orders: {money(sales)} sold{fees ? ` · ${money(fees)} Nearest order fees` : ""}. Set the order fee and download limits in Rules &amp; Settings → Partner shop.</span>
      </div>
      {orders.map(({ o, business, displayName }) => (
        <div key={o.id} className="card" style={{ gap: 6 }}>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="b">{o.qty > 1 ? `${o.qty} × ` : ""}{o.title}</span><span className={`tag ${o.status === "refunded" ? "" : "ok"}`}>{o.status === "paid" && o.kind === "physical" ? "Paid — not shipped" : o.status}</span></div>
          <span className="small muted">#{String(o.number).padStart(5, "0")} · {business ?? displayName} · {o.kind} · {o.paidAt ? fmtDate(o.paidAt, { month: "short", day: "numeric" }) : ""} · buyer {o.buyerEmail}</span>
          <span className="small">Paid {money(o.totalCents)} · seller {money(sellerAmount(o))} · payout {o.payoutStatus}</span>
          {o.status !== "refunded" && o.payoutStatus !== "sent" && (
            <ActionForm action={refundPartnerOrder} submitLabel="Refund buyer" buttonClass="btn ghost sm" className="col g4"><input type="hidden" name="id" value={o.id} /></ActionForm>
          )}
        </div>
      ))}
    </>
  );
}

function Links() {
  const share: [string, string, string, string][] = [
    ["Partner link (apply)", partnerApplyLink(), PARTNER_APPLY_PATH, "What the partner program is, both demos, and the application form."],
    ["Partner sign-in", `${SITE_URL}/pro/sign-in`, "/pro/sign-in", "Where partners sign in after they've created their password (Forgot password resets it)."],
    ["Demo: what clients see", partnerDemoLink(), PARTNER_DEMO_PATH, "Link page, booking profile, booking, Bundle my booking, Model Calls, shop, save to phone."],
    ["Demo: how setup works", partnerSetupDemoLink(), PARTNER_SETUP_DEMO_PATH, "Apply, sign in, page & links, services, portfolio, travel & hours, shop, share."],
  ];
  return (
    <div className="card" style={{ gap: 12 }}>
      <span className="b">Links to share</span>
      {share.map(([label, url, path, note]) => (
        <div key={url} className="col g4" style={{ borderTop: "1px solid #1C1C1F", paddingTop: 10 }}>
          <span className="small b">{label}</span>
          <div className="row between" style={{ gap: 8, flexWrap: "wrap" }}><span className="small" style={{ wordBreak: "break-all" }}>{url}</span><span className="row" style={{ gap: 14 }}><CopyButton text={url} /><Link className="link small" href={path} target="_blank">Open</Link></span></div>
          <span className="xs muted">{note}</span>
        </div>
      ))}
      <span className="xs muted">The demos use sample data and fit any phone or computer screen. Each partner&apos;s personal setup, finish or approve link is sent from Partners you added.</span>
    </div>
  );
}
