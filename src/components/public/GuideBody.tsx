import Link from "next/link";
import type { Block } from "@/content/guides";

/** Renders a guide's content blocks as plain semantic HTML. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        if (typeof b === "string") return <p key={i}>{b}</p>;
        if ("ul" in b) return <ul key={i}>{b.ul.map((x, j) => <li key={j}>{x}</li>)}</ul>;
        if ("ol" in b) return <ol key={i}>{b.ol.map((x, j) => <li key={j}>{x}</li>)}</ol>;
        if ("note" in b) return <p key={i} className="pub-box note">{b.note}</p>;
        if ("cta" in b) return (
          <aside key={i} className="pub-cta" aria-label={b.title} style={{ margin: "24px 0" }}>
            <h3 style={{ marginTop: 0 }}>{b.title}</h3>
            <p>{b.text}</p>
            <div className="pub-cta-row">
              {b.cta === "pro" && <><Link className="pub-btn" href="/pro/sign-up">Join Nearest free</Link><Link className="pub-btn ghost" href="/locations#check">Is my city open?</Link></>}
              {b.cta === "student" && <><Link className="pub-btn" href="/sign-up">Create a student account</Link><Link className="pub-btn ghost" href="/locations#check">Check your city</Link></>}
              {b.cta === "interest" && <Link className="pub-btn" href="/locations#check">Check your city</Link>}
            </div>
          </aside>
        );
        if ("copy" in b) return (
          <figure key={i} style={{ margin: 0 }}>
            {b.label && <figcaption className="pub-muted">{b.label}</figcaption>}
            <pre className="pub-copy">{b.copy}</pre>
          </figure>
        );
        return (
          <div key={i} className="pub-table-wrap">
            <table>
              {b.table.caption && <caption className="pub-muted" style={{ textAlign: "left", captionSide: "bottom", paddingTop: 6 }}>{b.table.caption}</caption>}
              <thead><tr>{b.table.head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{b.table.rows.map((r, j) => <tr key={j}>{r.map((c, k) => (k === 0 ? <th key={k} scope="row">{c}</th> : <td key={k}>{c}</td>))}</tr>)}</tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
