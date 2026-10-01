import { REP_AGREEMENT, REP_AGREEMENT_TITLE, REP_AGREEMENT_VERSION } from "@/lib/rep-agreement";

/** The full Sales Ambassador Agreement text. */
export function RepAgreementText() {
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="col g4"><span className="b">{REP_AGREEMENT_TITLE}</span><span className="xs muted">Version {REP_AGREEMENT_VERSION}</span></div>
      {REP_AGREEMENT.map((s) => (
        <section key={s.title} className="col" style={{ gap: 6 }}>
          <span className="small b">{s.title}</span>
          {s.body.map((p, i) => <p key={i} className="small p" style={{ margin: 0 }}>{p}</p>)}
        </section>
      ))}
    </div>
  );
}
