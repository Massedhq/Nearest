import Image from "next/image";
import Link from "next/link";
import { SupporterAvatar } from "@/components/SupporterAvatar";
import { Stars } from "@/components/Stars";
import { PERSONAL_DISCLAIMER, previewPlaceholders, publishedSupporters } from "@/lib/supporters";

export const metadata = { title: "Meet our supporters", description: "Why educators support Nearest." };
export const dynamic = "force-dynamic";

/** Public: published supporter statements only (each shown within its permissions). Placeholders appear in development/preview only. */
export default async function Supporters() {
  const real = await publishedSupporters();
  const list = real.length ? real : previewPlaceholders();
  const sample = !real.length && list.length > 0;
  return (
    <div className="scr">
      <div className="body" style={{ gap: 22 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={200} height={133} style={{ alignSelf: "center", height: "auto" }} />
        <Link className="row small" href="/" style={{ textDecoration: "none", color: "#ECE8E1", gap: 10 }}><span aria-hidden="true" style={{ fontSize: 20 }}>←</span> Back to home</Link>
        <div>
          <h1 className="disp" style={{ fontSize: 40, lineHeight: 1.05 }}>Meet our supporters</h1>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 17 }}>Hear why educators support Nearest.</p>
        </div>
        {(() => { const rated = real.filter((x) => x.rating); if (rated.length < 1) return null; const avg = rated.reduce((a, x) => a + (x.rating ?? 0), 0) / rated.length;
          return <div className="row" style={{ gap: 10, alignItems: "center" }}><Stars value={Math.round(avg)} size={20} /><span className="small">{avg.toFixed(1)} average from {rated.length} supporter{rated.length === 1 ? "" : "s"}</span></div>; })()}
        {list.length === 0 && <p className="small muted">Supporter statements will appear here once they&apos;re published.</p>}
        {sample && <p className="xs muted" style={{ margin: 0 }}>Sample profiles · Concept only (development preview — never shown on the live site)</p>}
        {list.map((s, i) => (
          <section key={s.id} id={`s-${s.id}`} style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 22, borderBottom: i < list.length - 1 ? "1px solid #3A3A3D" : "none", scrollMarginTop: 24 }}>
            <div className="row" style={{ gap: 18, alignItems: "center" }}>
              <SupporterAvatar id={s.id} portrait={s.portrait} initials={s.initials} size={104} />
              <div className="col" style={{ gap: 6, minWidth: 0 }}>
                <span className="disp" style={{ fontSize: 24, lineHeight: 1.1 }}>{s.name}</span>
                <span className="muted small">{s.affiliation}</span>
                <span style={{ alignSelf: "flex-start", border: "1px solid #ECE8E1", borderRadius: 999, padding: "3px 12px", fontSize: 12 }}>{s.label}</span>
              </div>
            </div>
            {s.rating && <Stars value={s.rating} size={18} />}
            <blockquote className="disp" style={{ margin: 0, fontStyle: "italic", fontSize: 22, lineHeight: 1.3 }}>&ldquo;{s.statement}&rdquo;</blockquote>
            <span className="xs muted">{s.experience}</span>
            {s.disclosure && <span className="xs muted">{s.disclosure}</span>}
          </section>
        ))}
        <p className="xs muted" style={{ textAlign: "center", margin: 0 }}>{PERSONAL_DISCLAIMER}</p>
        <Link className="btn" href="/sign-up">Create account</Link>
      </div>
    </div>
  );
}
