import { AdminHead } from "@/components/AdminHead";
import { CopyText } from "@/components/CopyText";
import { requireAdmin } from "@/lib/admin";
import { demandByCity, recruitLine } from "@/lib/demand";

export const metadata = { title: "Student demand" };
export const dynamic = "force-dynamic";

/**
 * Student demand — what students picked at sign-up ("What are you most interested in?"), by their school's city, next to
 * how many live professionals offer it there. Counts only, never names. "Needs a pro" rows are where to recruit first.
 */
export default async function Demand({ searchParams }: { searchParams: Promise<{ show?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const show = sp.show === "all" ? "all" : "needs";
  const q = (sp.q ?? "").trim().toLowerCase();
  const all = await demandByCity();
  const rows = all.filter((r) => (show === "all" || r.pros === 0) && (!q || r.city.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)));
  const waiting = all.filter((r) => r.pros === 0).reduce((n, r) => n + r.students, 0);
  const cities = new Set(all.filter((r) => r.pros === 0).map((r) => r.city)).size;
  return (
    <>
      <AdminHead eyebrow="Overview" title="Student demand" />
      <div className="kpis k4">
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Student picks with no pro yet</span><span className="stat">{waiting.toLocaleString()}</span></div>
        <div className="card" style={{ gap: 4 }}><span className="xs muted">Cities waiting on a service</span><span className="stat">{cities}</span></div>
      </div>
      <form className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="show" defaultValue={show} style={{ borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 }} aria-label="Show">
          <option value="needs">Needs a professional</option>
          <option value="all">Everything</option>
        </select>
        <input name="q" defaultValue={sp.q ?? ""} placeholder="City or service" style={{ borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40, flex: 1 }} aria-label="Search" />
        <button className="btn sm" type="submit" style={{ width: "auto" }}>Show</button>
      </form>
      <div className="card" style={{ gap: 10 }}>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl">
            <thead><tr><th>City</th><th>Service</th><th className="num">Students interested</th><th className="num">Verified</th><th className="num">Live pros</th><th>For your recruiters</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td className="empty" colSpan={6}>{all.length ? "Nothing matches." : "No student interests yet. They show up here as students sign up."}</td></tr>}
              {rows.slice(0, 300).map((r) => (
                <tr key={`${r.cityId}-${r.category}`}>
                  <td className="b">{r.city}</td><td>{r.category}</td>
                  <td className="num b">{r.students}</td><td className="num">{r.verified}</td>
                  <td className="num">{r.pros === 0 ? <span className="tag warn">Needs a pro</span> : r.pros}</td>
                  <td><div className="row" style={{ gap: 6 }}><span className="xs muted">{recruitLine(r)}</span><CopyText text={recruitLine(r)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <span className="xs muted">From the &quot;What are you most interested in?&quot; step every student completes at sign-up, counted by their school&apos;s city. When the first professional for a service goes live in a city, every student there who picked it gets an app notice and an email (once). Never shows student names.</span>
      </div>
    </>
  );
}
