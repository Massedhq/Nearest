import Image from "next/image";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, educatorContracts } from "@/db";
import { AGREEMENT_FIELDS, AGREEMENT_SECTIONS, EDUCATOR_AGREEMENT_TITLE, NEAREST_PARTY } from "@/lib/educator-agreement";
import { AgreementSign, EducatorUpload } from "@/components/field/AgreementSign";

export const metadata = { title: "Training video agreement · Nearest", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const when = (d: Date) => d.toLocaleString("en-US", { timeZone: "America/Chicago", dateStyle: "medium", timeStyle: "short" }) + " CT";

/**
 * Public: a video educator opens the agreement from their email (no account, no outside signing service). Before
 * signing: read, fill/correct their part, agree, type their name. After: the signed copy + the video upload.
 */
export default async function AgreementPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const c = /^[0-9a-f]{48}$/.test(token) ? await db.query.educatorContracts.findFirst({ where: eq(educatorContracts.tokenHash, createHash("sha256").update(token).digest("hex")) }) : null;
  const ok = c && c.status !== "cancelled";
  return (
    <main className="agree" style={{ minHeight: "100dvh", padding: "28px 18px 60px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={52} height={52} style={{ filter: "invert(1)", borderRadius: 12 }} />
        {!ok ? <p>This link isn&apos;t valid anymore. Reply to the email you got from Nearest and we&apos;ll send a new one.</p> : (
          <>
            <h1 style={{ fontSize: 26, margin: 0 }}>{EDUCATOR_AGREEMENT_TITLE}</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#6B665E" }}>Version {c.version}</p>
            <p style={{ margin: 0 }}><b>Nearest:</b> {NEAREST_PARTY.name}, {NEAREST_PARTY.address}</p>
            {c.status !== "sent" && (
              <div style={{ border: "1px solid #E6E1D8", borderRadius: 12, padding: 14 }}>
                {AGREEMENT_FIELDS.map((f) => <div key={f.key} style={{ fontSize: 14 }}><b>{f.label}:</b> {c.fields[f.key] || "—"}</div>)}
              </div>
            )}
            {AGREEMENT_SECTIONS.map((s) => (<section key={s.title}><h2>{s.title}</h2>{s.body.map((p, i) => <p key={i} style={{ margin: "0 0 8px" }}>{p}</p>)}</section>))}
            <section style={{ borderTop: "1.5px solid #141414", paddingTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
              <div><div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B665E" }}>Signed for Nearest</div>
                <div style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 26 }}>{c.nearestSigner}</div>
                <div style={{ fontSize: 14 }}>{c.nearestSigner}, {c.nearestTitle}</div><div style={{ fontSize: 13 }}>Authorized to sign for {NEAREST_PARTY.name} · {when(c.nearestSignedAt)}</div></div>
              <div><div style={{ fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "#6B665E" }}>Creator</div>
                {c.creatorName ? <><div style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 26 }}>{c.creatorName}</div><div style={{ fontSize: 13 }}>{when(c.creatorSignedAt!)}</div></> : <div style={{ fontSize: 14 }}>Waiting for your signature</div>}</div>
            </section>
            {c.status === "sent" && <AgreementSign token={token} fields={AGREEMENT_FIELDS.map((f) => ({ key: f.key, label: f.label, required: f.required, hint: "hint" in f ? f.hint : undefined }))} values={c.fields} />}
            {c.status === "signed" && (<section><h2>Upload your video</h2><p style={{ margin: "0 0 10px" }}>When your video is ready, upload it here with your product list. Keep this link — it works until you upload.</p><EducatorUpload token={token} contractId={c.id} /></section>)}
            {c.status === "uploaded" && <p><b>Your video is with Nearest.</b> We&apos;ll review it within 10 business days. Thank you!</p>}
          </>
        )}
      </div>
    </main>
  );
}
