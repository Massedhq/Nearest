import Image from "next/image";
import Link from "next/link";
import { marketName } from "@/lib/markets";
import { asc, eq } from "drizzle-orm";
import { db, categories, catalogServices, searchLog, favorites } from "@/db";
import { NearMe } from "@/components/NearMe";
import { ExploreFilters } from "@/components/ExploreFilters";
import { Bell } from "@/components/Inbox";
import { nearPoint, miles } from "@/lib/near";
import { unreadCount } from "@/lib/inbox";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { ProResult } from "@/components/ProResult";
import { requireVerifiedStudent } from "@/lib/student";
import { searchPros, resolvePlace, countOpenModelCalls, ZIP_RADIUS_MI, type Filters } from "@/lib/search";
import { proTitle } from "@/lib/pro-titles";
import { studentSuspendedUntil, SUSPENSION_TEXT } from "@/lib/enforcement";
import { fmtDate } from "@/lib/time";
import { getViewer } from "@/lib/viewer";
import { hiddenPros } from "@/lib/live-check";

export const metadata = { title: "Explore" };

const QUICK: [keyof Filters, string, string][] = [["today", "bolt", "Available Today"], ["after", "school", "After School"], ["under", "dollar", "Under $25"]];

export default async function Home({ searchParams }: { searchParams: Promise<Filters> }) {
  const { user, area, profile } = await requireVerifiedStudent();
  const until = studentSuspendedUntil(profile);
  if (until) {
    return (
      <div className="scr">
        <div className="top"><span className="sp" /><div className="t">Explore</div><span className="sp" /></div>
        <div className="body">
          <div className="card bad" style={{ padding: 22, gap: 12 }}>
            <span className="iconbtn" style={{ borderColor: "#6A2F26", color: "#F2A38F" }}><Icon name="lock" /></span>
            <h1 className="disp h2">Booking temporarily unavailable</h1>
            <p className="p muted">{SUSPENSION_TEXT[profile.suspensionReason ?? "admin"]}</p>
            <div className="row between"><span className="small muted">Booking available again</span><span className="b">{fmtDate(until, { month: "long", day: "numeric", year: "numeric" })}</span></div>
          </div>
          <div className="card small"><span className="eyebrow">You can still</span><div className="row"><Icon name="check" size="s" /> View your account and past bookings</div><div className="row"><Icon name="check" size="s" /> Read messages</div><div className="row"><Icon name="check" size="s" /> Keep your credits — they don&apos;t expire</div></div>
          <Link className="btn ghost" href="/appeal">Request review</Link>
        </div>
        <Tabs kind="student" active="Explore" />
      </div>
    );
  }
  const f = await searchParams;
  const place = f.area === "place" ? await resolvePlace(f.loc) : null;
  const [cats, catalog, found, favRows, unread, here, callCount] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    db.select({ id: catalogServices.id, categoryId: catalogServices.categoryId, name: catalogServices.name }).from(catalogServices).orderBy(asc(catalogServices.sort), asc(catalogServices.name)),
    searchPros(f, area, place),
    db.select({ proId: favorites.proId }).from(favorites).where(eq(favorites.studentId, user.id)),
    unreadCount(user.id),
    nearPoint(),
    countOpenModelCalls(area),
  ]);
  const favSet = new Set(favRows.map((r) => r.proId));
  // Owners browsing as a customer: when nobody shows, explain exactly which pros are hidden and why.
  const isOwner = found.length === 0 && (await getViewer())?.admin?.role === "OWNER";
  const hidden = isOwner ? await hiddenPros() : [];
  // Searching a ZIP: distances are measured from that ZIP and the closest come first.
  const from = place?.kind === "zip" ? { lat: place.lat, lng: place.lng } : here;
  const pros = found.map((p) => ({ ...p, miles: from ? miles(from, p) : null }));
  if (place?.kind === "zip") pros.sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999));
  else if (f.sort === "near" && here) pros.sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999));

  // Nothing matched: name what's missing ("No lash artists in your area yet"), then offer the closest
  // professionals Nearest has for that category or search anywhere — service first, then the whole category.
  const catRow = f.cat && f.cat !== "other" ? cats.find((c) => String(c.id) === f.cat) : undefined;
  const svcName = f.svc ? catalog.find((c) => String(c.id) === f.svc)?.name : undefined;
  const lookingFor = catRow || f.q;
  let closest: typeof pros = [];
  let closestLabel = "";
  if (pros.length === 0 && lookingFor) {
    const tries: Filters[] = catRow
      ? [...(f.svc ? [{ cat: f.cat, svc: f.svc } as Filters] : []), { cat: f.cat } as Filters]
      : [{ q: f.q } as Filters];
    for (const t of tries) {
      const got = await searchPros(t, null, null); // no area limit: anywhere on Nearest
      if (got.length) {
        closest = got.map((p) => ({ ...p, miles: from ? miles(from, p) : null })).sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999)).slice(0, 6);
        closestLabel = catRow
          ? t.svc && svcName ? `Closest ${proTitle(catRow.name)} offering ${svcName}` : `Closest ${proTitle(catRow.name)} on Nearest`
          : `Closest matches for “${f.q}” on Nearest`;
        break;
      }
    }
  }
  const whereText = place?.kind === "zip" ? `within ${ZIP_RADIUS_MI} miles of ${place.label}` : place?.kind === "city" ? `in ${place.label}` : f.area === "all" ? `in ${marketName(area?.market) || "your area"}` : "in your area";
  const missingTitle = catRow
    ? svcName ? `No one offering ${svcName} ${whereText} yet` : `No ${proTitle(catRow.name)} ${whereText} yet`
    : f.q ? `No results for “${f.q}” ${whereText}` : null;
  const extraFilters = Boolean(f.today || f.after || f.under || f.asl);

  if (f.q || f.cat || f.svc || f.loc || f.today || f.after || f.under || f.asl) {
    const { q, area: _a, ...rest } = f;
    void _a;
    db.insert(searchLog).values({ studentId: user.id, query: q?.slice(0, 80) ?? null, filters: JSON.stringify(rest), cityId: area?.cityId ?? null, results: pros.length }).catch(() => {});
  }
  const href = (patch: Partial<Filters>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/home?${s}` : "/home";
  };
  const areaOptions = [
    ...(area
      ? [{ value: "county", label: `${area.city} area` }, { value: "city", label: `${area.city} only` }, { value: "all", label: `All ${marketName(area.market) || "areas"}` }]
      : [{ value: "county", label: "Everywhere" }]),
    { value: "place", label: "Another city or ZIP code…" },
  ];
  // "Other" is typed in, so the stored "Other" category isn't listed separately.
  const listCats = cats.filter((c) => c.name.trim().toLowerCase() !== "other");

  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        <Bell href="/notifications" unread={unread} />
      </div>
      <div className="body">
        <p className="eyebrow p">Hi, {user.firstName}</p>
        <h1 className="disp h1">What do you need?</h1>
        <Link className="card pearl" href="/model-calls?area=all" style={{ textDecoration: "none", padding: 22, gap: 6 }}>
          <div className="row between"><span className="disp h1">Model Calls</span><Icon name="right" /></div>
          <span className="small b">{callCount > 0 ? `${callCount} Model Call${callCount === 1 ? "" : "s"} open in all areas` : "No open Model Calls right now — check back soon"}</span>
        </Link>
        <Link className="card" href="/bundle" style={{ textDecoration: "none", color: "inherit", gap: 4 }}>
          <div className="row between"><span className="b">Bundle my booking</span><Icon name="right" /></div>
          <span className="small muted">Hair, lashes, nails, makeup and more for the same week — matched to your budget.</span>
        </Link>
        <ExploreFilters
          key={`${f.cat ?? ""}|${f.svc ?? ""}|${f.q ?? ""}|${f.area ?? ""}|${f.loc ?? ""}`}
          cats={listCats}
          services={catalog}
          cat={f.cat}
          svc={f.svc}
          q={f.q}
          area={f.area}
          loc={f.loc}
          areaOptions={areaOptions}
          keep={{ today: f.today, after: f.after, under: f.under, asl: f.asl, sort: f.sort }}
        />
        <div className="grid2">
          <NearMe active={f.sort === "near" && !!here} href={href({})} />
          {QUICK.map(([key, icon, label]) => (
            <Link key={key} className={`card${f[key] ? " pearl" : ""}`} href={href({ [key]: f[key] ? undefined : "1" })} style={{ textDecoration: "none", gap: 6 }} aria-pressed={!!f[key]}>
              <Icon name={icon} /><span className="b">{label}</span>
            </Link>
          ))}
        </div>
        <Link className={`card${f.asl ? " pearl" : ""}`} href={href({ asl: f.asl ? undefined : "1" })} style={{ textDecoration: "none", gap: 4 }} aria-pressed={!!f.asl}>
          <div className="row"><Icon name="hand" /><span className="b grow">Professionals who communicate in ASL</span>{f.asl ? <Icon name="check" /> : <Icon name="right" />}</div>
          {f.asl && <span className="xs">Showing only professionals who communicate in ASL — tap to show everyone</span>}
        </Link>
        {(() => {
          const on = [f.cat && f.cat !== "other" && [cats.find((c) => String(c.id) === f.cat)?.name, f.svc && catalog.find((c) => String(c.id) === f.svc)?.name].filter(Boolean).join(" › "), place && (place.kind === "zip" ? `within ${ZIP_RADIUS_MI} mi of ${place.label}` : `in ${place.label}`), f.today && "Available Today", f.after && "After School", f.under && "Under $25", f.asl && "communicates in ASL", f.q && `“${f.q}”`].filter(Boolean) as string[];
          const title = pros.length
            ? (f.asl ? "ASL professionals near you" : "Near you")
            : missingTitle && place?.kind !== "none" ? `${missingTitle}${extraFilters ? " with these filters" : ""}` : on.length ? "No matches for these filters" : "No professionals here yet";
          return (
            <>
              <div id="results" className="row between" style={{ scrollMarginTop: 16 }}><h2 className="disp h2">{title}</h2><span className="xs muted">{pros.length} professional{pros.length === 1 ? "" : "s"}</span></div>
              {on.length > 0 && <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><span className="xs muted">Filters on: {on.join(" • ")}</span><Link className="link xs" href="/home">Clear all</Link></div>}
              {pros.length === 0 && (
                <p className="small muted p">
                  {place?.kind === "none"
                    ? `We couldn't find "${place.label}". Check the spelling, or try a 5-digit ZIP code.`
                    : place && on.length === 1
                    ? `No professionals are live ${place.kind === "zip" ? `within ${ZIP_RADIUS_MI} miles of ${place.label}` : `in ${place.label}`} yet. Try a nearby city or ZIP.`
                    : f.asl && on.length === 1
                    ? `No professionals who communicate in ASL are listed in ${marketName(area?.market) || "your area"} yet. They'll show up here as they join.`
                    : missingTitle
                      ? closest.length
                        ? `New professionals join every week. Until then, here are the closest ones Nearest has${extraFilters ? " (without your other filters)" : ""}.`
                        : `Nearest doesn't have any yet — new professionals join every week. Check back soon.`
                    : on.length
                      ? `Nobody matches all of these right now. Try turning a filter off, or choose All ${marketName(area?.market) || "areas"}.`
                      : `No professionals are live in ${marketName(area?.market) || "your area"} yet. New professionals join every week.`}
                </p>
              )}
            </>
          );
        })()}
        {isOwner && hidden.length > 0 && (
          <div className="card warn" style={{ gap: 10 }}>
            <span className="eyebrow">Owner view — only you see this</span>
            <span className="small">These professionals can&apos;t be booked yet because something still needs to be finished:</span>
            {hidden.map((h) => (
              <div key={h.userId} className="card" style={{ gap: 6 }}>
                <div className="row between"><span className="b">{h.name}</span><Link className="link xs" href={`/admin/professionals/${h.userId}`}>Review account →</Link></div>
                {h.blockers.map((b) => <span key={b} className="xs">• {b}</span>)}
              </div>
            ))}
          </div>
        )}
        {pros.map((p) => <ProResult key={p.userId} p={p} fav={favSet.has(p.userId)} />)}
        {closest.length > 0 && (
          <>
            <h3 className="disp h3" style={{ marginTop: 6 }}>{closestLabel}</h3>
            {closest.map((p) => <ProResult key={p.userId} p={p} fav={favSet.has(p.userId)} />)}
          </>
        )}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
