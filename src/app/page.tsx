import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { SupporterAvatar } from "@/components/SupporterAvatar";
import { previewPlaceholders, publishedSupporters } from "@/lib/supporters";

export default async function Welcome() {
  const { userId } = await auth();
  if (userId) redirect("/go");
  // Educator endorsements: only real, published supporters on the live site. None published → the section is hidden.
  // Development / preview builds show labeled initials placeholders so the layout can be checked.
  const real = await publishedSupporters().catch(() => []);
  const circles = (real.length ? real : previewPlaceholders()).slice(0, 5);
  const sample = !real.length && circles.length > 0;
  return (
    <div className="scr">
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 22px" }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={380} height={253} priority style={{ width: "100%", maxWidth: 380, height: "auto" }} />
        <p className="disp" style={{ fontSize: 24, textAlign: "center", margin: "-8px 0 0", fontStyle: "italic" }}>Find who&apos;s available near you.</p>
        <p className="muted small" style={{ textAlign: "center", margin: "14px 0 0", maxWidth: 290 }}>
          Book, pay and finish your appointment in one place.
        </p>
      </div>
      <div className="body" style={{ flex: "none", gap: 12 }}>
        <Link className="btn" href="/sign-up">Create account</Link>
        <Link className="btn ghost" href="/sign-in">Sign in</Link>
        {circles.length > 0 && (
          <section aria-label="Why educators support Nearest" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, margin: "18px 0 6px" }}>
            <h2 className="disp" style={{ fontSize: 22, textAlign: "center" }}>Why educators support Nearest</h2>
            <div className="row" style={{ gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {circles.map((c) => (
                <Link key={c.id} href={`/supporters#s-${c.id}`} aria-label={`${c.name} — read their statement`} style={{ textDecoration: "none" }}>
                  <SupporterAvatar id={c.id} portrait={c.portrait} initials={c.initials} size={58} />
                </Link>
              ))}
            </div>
            <Link className="small" href="/supporters" style={{ color: "#C9C4BA", textDecoration: "none" }}>Meet our supporters <span aria-hidden="true">→</span></Link>
            {sample && <span className="xs muted">Sample profiles · Concept only</span>}
          </section>
        )}
        <p className="xs muted" style={{ textAlign: "center", margin: "6px 0 0" }}>By continuing you agree to the Nearest <Link className="link" href="/terms" style={{ fontSize: "inherit" }}>Terms</Link> and <Link className="link" href="/privacy" style={{ fontSize: "inherit" }}>Privacy Policy</Link>.</p>
      </div>
    </div>
  );
}
