"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "./Icon";
import type { GuideSection } from "@/lib/guide";

/** Searchable "How Nearest works" guide: sections of tap-to-open questions. */
export function GuideView({ sections, intro }: { sections: GuideSection[]; intro?: string }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const shown = useMemo(() => {
    if (!term) return sections;
    return sections
      .map((s) => ({ ...s, topics: s.topics.filter((t) => [s.title, t.q, ...t.a, ...(t.steps ?? [])].join(" ").toLowerCase().includes(term)) }))
      .filter((s) => s.topics.length > 0);
  }, [sections, term]);

  return (
    <div className="col guide" style={{ gap: 14 }}>
      {intro && <p className="small muted p">{intro}</p>}
      <div className="field">
        <label htmlFor="guide-q" className="sr-only">Search the guide</label>
        <div className="guide-search">
          <Icon name="search" size="s" />
          <input id="guide-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search — e.g. cancel, check in, payouts" autoComplete="off" />
          {q && <button type="button" className="guide-x" onClick={() => setQ("")} aria-label="Clear search"><Icon name="x" size="s" /></button>}
        </div>
      </div>
      {!term && (
        <nav className="chips" aria-label="Guide sections">
          {sections.map((s) => <a key={s.id} className="chip" href={`#g-${s.id}`}><Icon name={s.icon} size="s" />{s.title}</a>)}
        </nav>
      )}
      {shown.length === 0 && <div className="card small"><span>Nothing matches &ldquo;{q}&rdquo;.</span><span className="muted">Try another word, or email <a className="link" href="mailto:support@usenearest.com">support@usenearest.com</a>.</span></div>}
      {shown.map((s) => (
        <section key={s.id} id={`g-${s.id}`} className="col" style={{ gap: 8, scrollMarginTop: 80 }}>
          <h2 className="eyebrow p row" style={{ gap: 6 }}><Icon name={s.icon} size="s" />{s.title}</h2>
          {s.topics.map((t) => (
            <details key={t.q} className="guide-item" open={Boolean(term)}>
              <summary><span className="grow">{t.q}</span><Icon name="down" size="s" /></summary>
              <div className="guide-body">
                {t.a.map((p, i) => <p key={i} className="small p">{p}</p>)}
                {t.steps && <ol className="small guide-steps">{t.steps.map((st, i) => <li key={i}>{st}</li>)}</ol>}
                {t.link && <Link className="btn sm ghost" href={t.link.href} style={{ alignSelf: "flex-start" }}>{t.link.label}<Icon name="right" size="s" /></Link>}
              </div>
            </details>
          ))}
        </section>
      ))}
      <div className="card small" style={{ marginTop: 6 }}>
        <span className="b">Still need help?</span>
        <span className="muted">Email <a className="link" href="mailto:support@usenearest.com">support@usenearest.com</a> — a real person reads every message.</span>
      </div>
    </div>
  );
}
