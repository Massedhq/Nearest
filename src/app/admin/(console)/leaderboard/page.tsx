import Link from "next/link";
import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { proLeaderboard, studentLeaderboard, top, type Range, type ProRow, type StudentRow } from "@/lib/leaderboard";
import { money } from "@/lib/time";

export const metadata = { title: "Leaderboard" };
export const dynamic = "force-dynamic";

function Board<T>({ title, note, rows, cols, empty }: { title: string; note?: string; rows: T[]; cols: [string, (r: T) => React.ReactNode][]; empty: string }) {
  return (
    <div className="card" style={{ gap: 8, overflowX: "auto" }}>
      <span className="eyebrow">{title}</span>
      {note && <span className="xs muted">{note}</span>}
      {rows.length === 0 ? <span className="small muted">{empty}</span> : (
        <table className="tbl">
          <thead><tr><th>#</th>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}><td className="b">{i + 1}</td>{cols.map(([h, f]) => <td key={h}>{f(r)}</td>)}</tr>)}</tbody>
        </table>
      )}
    </div>
  );
}

const proName = (r: ProRow) => <Link href={`/admin/professionals/${r.userId}`} style={{ color: "inherit" }} className="b">{r.business ?? "Professional"}</Link>;
const stars = (a: number | null) => (a == null ? "—" : `★ ${a.toFixed(2)}`);

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ range?: string; who?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const range: Range = sp.range === "30" || sp.range === "90" ? sp.range : "all";
  const who = sp.who === "students" ? "students" : "pros";
  const q = (o: Record<string, string>) => `/admin/leaderboard?${new URLSearchParams({ range, who, ...o })}`;
  const pros = who === "pros" ? await proLeaderboard(range) : [];
  const students = who === "students" ? await studentLeaderboard(range) : [];
  const empty = "No activity in this period yet.";
  return (
    <>
      <AdminHead eyebrow="Who's performing best" title="Leaderboard" />
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <Link className={`chip${who === "pros" ? " on" : ""}`} href={q({ who: "pros" })}>Professionals</Link>
        <Link className={`chip${who === "students" ? " on" : ""}`} href={q({ who: "students" })}>Students</Link>
        <span style={{ width: 16 }} />
        {(["30", "90", "all"] as const).map((r) => <Link key={r} className={`chip${range === r ? " on" : ""}`} href={q({ range: r })}>{r === "all" ? "All time" : `Last ${r} days`}</Link>)}
      </div>

      {who === "pros" ? (
        <>
          <Board<ProRow> title="Overall top performers" rows={top(pros, (r) => r.score, 10, -9999).filter((r) => r.completed + r.reviews + r.favorites + r.shares > 0)} empty={empty}
            note="Score = 3 × completed bookings + 2 × reviews + favorites + 2 × times shared + 20 × (fair rating − 4) − 5 × pro cancellations. “Fair rating” pulls pros with only a few reviews toward 4.5, so one 5★ review can't top the chart."
            cols={[["Professional", proName], ["City", (r) => r.city ?? "—"], ["Score", (r) => <span className="b">{r.score}</span>], ["Bookings", (r) => r.completed], ["Rating", (r) => stars(r.avg)], ["Reviews", (r) => r.reviews], ["Favorites", (r) => r.favorites], ["Shared", (r) => r.shares]]} />
          <div className="acols even">
            <Board<ProRow> title="Most bookings" rows={top(pros, (r) => r.completed)} empty={empty} cols={[["Professional", proName], ["Completed", (r) => r.completed], ["Earned", (r) => money(r.earnedCents)]]} />
            <Board<ProRow> title="Highest rated" note="At least 3 reviews in this period." rows={top(pros.filter((r) => r.reviews >= 3), (r) => (r.avg ?? 0) * 1000 + r.reviews)} empty="No one has 3+ reviews in this period yet." cols={[["Professional", proName], ["Rating", (r) => stars(r.avg)], ["Reviews", (r) => r.reviews]]} />
          </div>
          <div className="acols even">
            <Board<ProRow> title="Most reviewed" rows={top(pros, (r) => r.reviews)} empty={empty} cols={[["Professional", proName], ["Reviews", (r) => r.reviews], ["Rating", (r) => stars(r.avg)]]} />
            <Board<ProRow> title="Most favorited" rows={top(pros, (r) => r.favorites)} empty={empty} cols={[["Professional", proName], ["Saved by", (r) => `${r.favorites} students`]]} />
          </div>
          <Board<ProRow> title="Most shared" note="Times students sent them to a connection with Share with a Connection." rows={top(pros, (r) => r.shares)} empty={empty} cols={[["Professional", proName], ["Shared", (r) => `${r.shares} times`], ["Bookings", (r) => r.completed]]} />
        </>
      ) : (
        <>
          <div className="acols even">
            <Board<StudentRow> title="Top contributors" note="Total spent on completed appointments." rows={top(students, (r) => r.spentCents)} empty={empty} cols={[["Student", (r) => <span className="b">{r.name}</span>], ["School", (r) => r.school ?? "—"], ["Spent", (r) => money(r.spentCents)], ["Appointments", (r) => r.completed]]} />
            <Board<StudentRow> title="Books the most" rows={top(students, (r) => r.completed)} empty={empty} cols={[["Student", (r) => <span className="b">{r.name}</span>], ["Completed", (r) => r.completed], ["Spent", (r) => money(r.spentCents)]]} />
          </div>
          <div className="acols even">
            <Board<StudentRow> title="Writes the most reviews" rows={top(students, (r) => r.reviews)} empty={empty} cols={[["Student", (r) => <span className="b">{r.name}</span>], ["Reviews", (r) => r.reviews], ["Average given", (r) => stars(r.avgGiven)]]} />
            <Board<StudentRow> title="Shares the most" note="Professionals sent to their connections — your word-of-mouth champions." rows={top(students, (r) => r.sharesSent)} empty={empty} cols={[["Student", (r) => <span className="b">{r.name}</span>], ["Shares sent", (r) => r.sharesSent]]} />
          </div>
        </>
      )}
      <p className="xs muted p">Want to see what a fully built-out profile looks like? <Link className="link xs" href="/admin/examples">Profile examples</Link></p>
    </>
  );
}
