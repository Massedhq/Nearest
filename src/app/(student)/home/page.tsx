import Image from "next/image";
import Link from "next/link";
import { marketName } from "@/lib/markets";
import { asc, eq } from "drizzle-orm";
import { db, categories, searchLog, favorites } from "@/db";
import { NearMe } from "@/components/NearMe";
import { Bell } from "@/components/Inbox";
import { nearPoint, miles } from "@/lib/near";
import { unreadCount } from "@/lib/inbox";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { ProResult } from "@/components/ProResult";
import { requireVerifiedStudent } from "@/lib/student";
import { searchPros, type Filters } from "@/lib/search";
import { studentSuspendedUntil, SUSPENSION_TEXT } from "@/lib/enforcement";
import { fmtDate } from "@/lib/time";

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
  const [cats, found, favRows, unread, here] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    searchPros(f, area),
    db.select({ proId: favorites.proId }).from(favorites).where(eq(favorites.studentId, user.id)),
    unreadCount(user.id),
    nearPoint(),
  ]);
  const favSet = new Set(favRows.map((r) => r.proId));
  const pros = found.map((p) => ({ ...p, miles: here ? miles(here, p) : null }));
  if (f.sort === "near" && here) pros.sort((a, b) => (a.miles ?? 9999) - (b.miles ?? 9999));
  if (f.q || f.cat || f.today || f.after || f.under || f.asl) {
    const { q, area: _a, ...rest } = f;
    void _a;
    db.insert(searchLog).values({ studentId: user.id, query: q?.slice(0, 80) ?? null, filters: JSON.stringify(rest), cityId: area?.cityId ?? null, results: pros.length }).catch(() => {});
  }
  const href = (patch: Partial<Filters>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/home?${s}` : "/home";
  };
  const areaMode = f.area ?? "county";
  const areaLabel = areaMode === "city" ? area?.city : areaMode === "all" ? `All ${marketName(area?.market) || "areas"}` : `${area?.city ?? "My"} area`;
  const nextArea = areaMode === "county" ? "city" : areaMode === "city" ? "all" : "county";

  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        <Link className="chip" href={href({ area: nextArea === "county" ? undefined : nextArea })} aria-label="Change area"><Icon name="pin" size="s" /> {areaLabel} <Icon name="down" size="s" /></Link>
        <Bell href="/notifications" unread={unread} />
      </div>
      <div className="body">
        <p className="eyebrow p">Hi, {user.firstName}</p>
        <h1 className="disp h1">What do you need?</h1>
        <form action="/home" className="search" role="search">
          <Icon name="search" />
          <input name="q" defaultValue={f.q ?? ""} placeholder="Search services" aria-label="Search services" />
          {Object.entries(f).filter(([k, v]) => k !== "q" && v).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>
        <Link className="card pearl" href={`/model-calls${f.area ? `?area=${f.area}` : ""}`} style={{ textDecoration: "none", padding: 22, gap: 6 }}>
          <div className="row between"><span className="disp h1">Model Calls</span><Icon name="right" /></div>
          <span className="small b">Model Calls near me</span>
        </Link>
        <div className="scrollx" style={{ flexWrap: "wrap", marginRight: 0 }}>
          <Link className={`chip${!f.cat ? " on" : ""}`} href={href({ cat: undefined })}>All</Link>
          {cats.map((c) => <Link key={c.id} className={`chip${f.cat === String(c.id) ? " on" : ""}`} href={href({ cat: f.cat === String(c.id) ? undefined : String(c.id) })}>{c.name}</Link>)}
        </div>
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
          const on = [f.cat && cats.find((c) => String(c.id) === f.cat)?.name, f.today && "Available Today", f.after && "After School", f.under && "Under $25", f.asl && "communicates in ASL", f.q && `“${f.q}”`].filter(Boolean) as string[];
          const title = pros.length ? (f.asl ? "ASL professionals near you" : "Near you") : on.length ? "No matches for these filters" : "No professionals here yet";
          return (
            <>
              <div className="row between"><h2 className="disp h2">{title}</h2><span className="xs muted">{pros.length} professional{pros.length === 1 ? "" : "s"}</span></div>
              {on.length > 0 && <div className="row" style={{ gap: 8, flexWrap: "wrap" }}><span className="xs muted">Filters on: {on.join(" • ")}</span><Link className="link xs" href="/home">Clear all</Link></div>}
              {pros.length === 0 && (
                <p className="small muted p">
                  {f.asl && on.length === 1
                    ? `No professionals who communicate in ASL are listed in ${marketName(area?.market) || "your area"} yet. They'll show up here as they join.`
                    : on.length
                      ? `Nobody matches all of these right now. Try turning a filter off, or choose All ${marketName(area?.market) || "areas"}.`
                      : `No professionals are live in ${marketName(area?.market) || "your area"} yet. New professionals join every week.`}
                </p>
              )}
            </>
          );
        })()}
        {pros.map((p) => <ProResult key={p.userId} p={p} fav={favSet.has(p.userId)} />)}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
