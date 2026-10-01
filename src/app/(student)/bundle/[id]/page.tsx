import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireVerifiedStudent } from "@/lib/student";
import { isAdult } from "@/lib/age";
import { bundleDays, categoryCandidates, categoryCap, expireBundles, firstOpenDay, loadBundle } from "@/lib/bundles";
import { fmtDate, money } from "@/lib/time";
import { TopBar } from "@/components/TopBar";
import { Tabs } from "@/components/Tabs";
import { Icon } from "@/components/Icon";
import { saveBundlePro, removeBundlePro, deleteBundle } from "@/app/bundle-actions";

export const metadata = { title: "Your bundle" };

const dayLabel = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

/** Build a bundle: for each category, one recommended professional at a time — save them or see the next person. */
export default async function BuildBundle({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cat?: string; i?: string }> }) {
  const { user, area } = await requireVerifiedStudent();
  await expireBundles();
  const { id } = await params;
  const sp = await searchParams;
  const loaded = await loadBundle(id, user.id);
  if (!loaded) notFound();
  const { bundle, items, cats } = loaded;
  if (bundle.status === "expired") {
    return (
      <div className="scr"><TopBar title="Your bundle" back="/bundle" /><div className="body">
        <div className="card warn small"><span>This bundle expired — unbooked bundles are kept for 2 weeks. Start a new one anytime.</span><Link className="btn sm" href="/bundle/new">Start a new bundle</Link></div>
      </div></div>
    );
  }
  const days = bundleDays(bundle);
  const saved = items.map((x) => ({ categoryId: x.item.categoryId, priceCents: x.item.priceCents, item: x.item }));
  const savedTotal = saved.reduce((t, s) => t + s.priceCents, 0);
  const adult = isAdult(user.dateOfBirth);

  // Lowest price in every category (to keep room in the budget for categories still to fill).
  const all = await Promise.all(cats.map(async (c) => ({ cat: c, list: await categoryCandidates(area, c.id, adult) })));
  const minBy = new Map(all.map((a) => [a.cat.id, a.list[0]?.priceCents ?? 0]));
  const firstUnsaved = cats.find((c) => !saved.some((s) => s.categoryId === c.id));
  const current = cats.find((c) => String(c.id) === sp.cat) ?? firstUnsaved ?? cats[0];
  const mine = saved.find((s) => s.categoryId === current.id);
  const cap = categoryCap(bundle.budgetCents, current.id, saved, minBy, bundle.categoryIds);
  const pool = (all.find((a) => a.cat.id === current.id)?.list ?? []).filter((c) => c.priceCents <= cap && c.proId !== mine?.item.proId);
  pool.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.priceCents - b.priceCents);

  // The i-th professional who fits the budget AND has an opening that week.
  const want = Math.max(0, Number(sp.i) || 0);
  let shown: (typeof pool)[number] & { firstOpenDay: string } | null = null;
  let seen = 0;
  let checked = 0;
  for (const c of pool) {
    if (checked++ > 30) break;
    const d = await firstOpenDay(c.proId, c.durationMin, days);
    if (!d) continue;
    if (seen++ === want) { shown = { ...c, firstOpenDay: d }; break; }
  }
  const ready = cats.every((c) => saved.some((s) => s.categoryId === c.id));

  return (
    <div className="scr">
      <TopBar title="Your bundle" back="/bundle" />
      <div className="body">
        <div className="card" style={{ gap: 6 }}>
          <div className="row between"><span className="b">Week of {dayLabel(bundle.startDate)}</span><span className="small">{money(savedTotal)} of {money(bundle.budgetCents)}</span></div>
          <div className="bar"><i style={{ width: `${Math.min(100, Math.round((savedTotal / bundle.budgetCents) * 100))}%` }} /></div>
          <span className="xs muted">Saved until {fmtDate(bundle.expiresAt, { month: "short", day: "numeric" })} • {days.length ? `${dayLabel(days[0])} – ${dayLabel(bundle.endDate)}` : "This week has passed"}</span>
        </div>

        <div className="chips">
          {cats.map((c) => {
            const s = saved.find((x) => x.categoryId === c.id);
            return <Link key={c.id} href={`/bundle/${bundle.id}?cat=${c.id}`} className={`chip${c.id === current.id ? " on" : ""}`}>{s ? <Icon name="check" size="s" /> : null}{c.name}{s ? ` ${money(s.priceCents)}` : ""}</Link>;
          })}
        </div>

        {mine && (
          <div className="card ok" style={{ gap: 6 }}>
            <span className="eyebrow">Saved for {current.name}</span>
            <span className="small"><span className="b">{money(mine.priceCents)}</span> — saved to your bundle.</span>
            <div className="row" style={{ gap: 8 }}>
              <Link className="btn ghost sm" href={`/p/${mine.item.proId}`}>View their work</Link>
              <form action={removeBundlePro}><input type="hidden" name="bundleId" value={bundle.id} /><input type="hidden" name="categoryId" value={current.id} /><button className="btn ghost sm" type="submit"><Icon name="trash" size="s" /> Remove from bundle</button></form>
            </div>
          </div>
        )}

        <span className="eyebrow p">{mine ? `Other ${current.name.toLowerCase()} professionals` : `Recommended for ${current.name.toLowerCase()}`} • up to {money(Math.max(0, cap))}</span>

        {cap <= 0 ? (
          <div className="card warn small"><span>Your budget doesn&apos;t leave room for {current.name.toLowerCase()} yet. Remove a saved professional or start a bundle with a higher budget.</span></div>
        ) : !shown ? (
          <div className="card small"><span>{want > 0 ? "That's everyone who fits your budget and has openings that week." : `No ${current.name.toLowerCase()} professionals near you have openings that week within ${money(cap)}.`}</span>{want > 0 && <Link className="link small" href={`/bundle/${bundle.id}?cat=${current.id}`}>Start over from the first</Link>}</div>
        ) : (
          <div className="card" style={{ gap: 10 }}>
            <div className="row">
              {shown.photoUrl
                ? <Image src={shown.photoUrl} alt="" width={56} height={56} style={{ borderRadius: 28, objectFit: "cover" }} />
                : <div className="avatar">{shown.businessName.slice(0, 1)}</div>}
              <div className="col g4 grow">
                <span className="b">{shown.businessName}</span>
                <span className="xs muted">{shown.city ?? ""}{shown.rating ? ` • ★ ${shown.rating.toFixed(1)} (${shown.reviews})` : " • New"}</span>
              </div>
            </div>
            <div className="row between"><span className="small">{shown.serviceName}</span><span className="b">{money(shown.priceCents)}</span></div>
            <span className="xs muted">First opening that week: {dayLabel(shown.firstOpenDay)}</span>
            <Link className="btn ghost sm" href={`/p/${shown.proId}`}>View their work</Link>
            <div className="grid2" style={{ gap: 8 }}>
              <form action={saveBundlePro}>
                <input type="hidden" name="bundleId" value={bundle.id} /><input type="hidden" name="categoryId" value={current.id} /><input type="hidden" name="serviceId" value={shown.serviceId} />
                <button className="btn" type="submit" style={{ width: "100%" }}>{mine ? "Save instead" : "Save to bundle"}</button>
              </form>
              <Link className="btn ghost" href={`/bundle/${bundle.id}?cat=${current.id}&i=${want + 1}`}>Next person</Link>
            </div>
          </div>
        )}

        {ready
          ? <Link className="btn" href={`/bundle/${bundle.id}/book`}>Your bundle is ready — book it</Link>
          : <span className="xs muted p">Save one professional for each category, then book them all for your week. You can leave and finish later — your bundle is saved until {fmtDate(bundle.expiresAt, { month: "short", day: "numeric" })}.</span>}

        <form action={deleteBundle}><input type="hidden" name="bundleId" value={bundle.id} /><button className="link xs" type="submit">Delete this bundle</button></form>
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
