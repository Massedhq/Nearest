import Image from "next/image";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { Icon } from "@/components/Icon";
import { Tabs } from "@/components/Tabs";
import { ProResult } from "@/components/ProResult";
import { requireVerifiedStudent } from "@/lib/student";
import { searchPros, type Filters } from "@/lib/search";

export const metadata = { title: "Explore" };

const QUICK: [keyof Filters, string, string][] = [["today", "bolt", "Available Today"], ["after", "school", "After School"], ["under", "dollar", "Under $25"], ["asl", "hand", "ASL"]];

export default async function Home({ searchParams }: { searchParams: Promise<Filters> }) {
  const { user, area } = await requireVerifiedStudent();
  const f = await searchParams;
  const [cats, pros] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    searchPros(f, area),
  ]);
  const href = (patch: Partial<Filters>) => {
    const p = new URLSearchParams(Object.entries({ ...f, ...patch }).filter(([, v]) => v) as [string, string][]);
    const s = p.toString();
    return s ? `/home?${s}` : "/home";
  };
  const areaMode = f.area ?? "county";
  const areaLabel = areaMode === "city" ? area?.city : areaMode === "all" ? "All DFW" : `${area?.city ?? "My"} area`;
  const nextArea = areaMode === "county" ? "city" : areaMode === "city" ? "all" : "county";

  return (
    <div className="scr">
      <div className="top" style={{ justifyContent: "space-between" }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={48} height={48} />
        <Link className="chip" href={href({ area: nextArea === "county" ? undefined : nextArea })} aria-label="Change area"><Icon name="pin" size="s" /> {areaLabel} <Icon name="down" size="s" /></Link>
        <span className="iconbtn" aria-label="Notifications"><Icon name="bell" /></span>
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
          {QUICK.map(([key, icon, label]) => (
            <Link key={key} className={`card${f[key] ? " pearl" : ""}`} href={href({ [key]: f[key] ? undefined : "1" })} style={{ textDecoration: "none", gap: 6 }} aria-pressed={!!f[key]}>
              <Icon name={icon} /><span className="b">{label}</span>
            </Link>
          ))}
        </div>
        <div className="row between"><h2 className="disp h2">{pros.length ? "Near you" : "No matches yet"}</h2><span className="xs muted">{pros.length} professional{pros.length === 1 ? "" : "s"}</span></div>
        {pros.length === 0 && <p className="small muted p">Try removing a filter or choosing All DFW. New professionals join every week.</p>}
        {pros.map((p) => <ProResult key={p.userId} p={p} />)}
      </div>
      <Tabs kind="student" active="Explore" />
    </div>
  );
}
