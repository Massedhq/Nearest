import Link from "next/link";
import { TopBar } from "./TopBar";

export type LegalSection = { h: string; p: (string | string[])[] };

/** Shared layout for Terms and Privacy. A string[] inside a section renders as a bulleted list. */
export function LegalPage({ title, updated, intro, sections, other }: { title: string; updated: string; intro: string[]; sections: LegalSection[]; other: { href: string; label: string } }) {
  return (
    <div className="scr">
      <TopBar title={title} back="/" />
      <div className="body" style={{ gap: 14 }}>
        <h1 className="disp h1">{title}</h1>
        <p className="xs muted p">Last updated {updated}</p>
        {intro.map((t, i) => <p key={i} className="small p" style={{ color: "#D8D2C6" }}>{t}</p>)}
        <nav className="card small" aria-label="Contents" style={{ gap: 4 }}>
          <span className="eyebrow">Contents</span>
          {sections.map((s, i) => <a key={s.h} className="link small" href={`#s${i + 1}`} style={{ textDecoration: "none" }}>{s.h}</a>)}
        </nav>
        {sections.map((s, i) => (
          <section key={s.h} id={`s${i + 1}`} className="col" style={{ gap: 8, scrollMarginTop: 80 }}>
            <h2 className="h3" style={{ fontSize: 17 }}>{s.h}</h2>
            {s.p.map((t, j) =>
              Array.isArray(t) ? (
                <ul key={j} className="small" style={{ color: "#D8D2C6", margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                  {t.map((li, k) => <li key={k}>{li}</li>)}
                </ul>
              ) : (
                <p key={j} className="small p" style={{ color: "#D8D2C6" }}>{t}</p>
              ),
            )}
          </section>
        ))}
        <p className="xs muted p">Questions: hello@usenearest.com • <Link className="link small" href={other.href}>{other.label}</Link></p>
      </div>
    </div>
  );
}
