import Image from "next/image";
import { asc, eq } from "drizzle-orm";
import { db, categories } from "@/db";
import { ActionForm } from "@/components/ActionForm";
import { openLeadInvite } from "@/lib/lead-contributors";
import { submitInterest } from "./actions";

export const metadata = { title: "Professional interest — Nearest", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Public: a professional shares their interest in Nearest. No account. Never shows who sent the link or any notes. */
export default async function ProfessionalInterest({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const open = await openLeadInvite(token);
  const cats = "invite" in open ? await db.select({ id: categories.id, name: categories.name }).from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort), asc(categories.name)) : [];
  return (
    <div className="scr">
      <div className="body" style={{ maxWidth: 560, margin: "0 auto", width: "100%", gap: 18 }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={170} height={114} style={{ alignSelf: "center", height: "auto" }} />
        <h1 className="disp h1" style={{ margin: 0 }}>Interested in Nearest?</h1>
        {"done" in open ? (
          <div className="card ok small"><span>Thanks — we already received your information. Someone from Nearest may reach out to you.</span></div>
        ) : "error" in open ? (
          <div className="card warn small"><span>{open.error} If you&apos;re a professional interested in Nearest, ask the person who sent it for a new link.</span></div>
        ) : (
          <>
            <p className="small muted p" style={{ margin: 0 }}>Nearest connects verified students with beauty and wellness professionals near them. Share a few details and someone from Nearest may reach out.</p>
            <div className="card small" style={{ gap: 6 }}>
              <span className="b">What this form does</span>
              <span>It only lets Nearest know you&apos;re interested. It does <span className="b">not</span> create a professional account, start or activate a membership, or reserve a spot in your city. You&apos;re not agreeing to anything by sending it.</span>
            </div>
            <ActionForm action={submitInterest} submitLabel="Send my information" className="col g16">
              <input type="hidden" name="token" value={token} />
              <div style={{ position: "absolute", left: -10000, width: 1, height: 1, overflow: "hidden" }} aria-hidden="true"><label>Website<input name="website_url" tabIndex={-1} autoComplete="off" /></label></div>
              <div className="field"><label htmlFor="pi-name">Your name *</label><input id="pi-name" name="name" maxLength={120} required autoComplete="name" /></div>
              <div className="field"><label htmlFor="pi-bus">Business name (if any)</label><input id="pi-bus" name="business" maxLength={120} autoComplete="organization" /></div>
              <div className="field"><label htmlFor="pi-cat">Main service *</label>
                <select id="pi-cat" name="categoryId" required defaultValue=""><option value="" disabled>Choose one</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </div>
              <div className="grid3">
                <div className="field"><label htmlFor="pi-city">City *</label><input id="pi-city" name="city" maxLength={80} required autoComplete="address-level2" /></div>
                <div className="field"><label htmlFor="pi-county">County *</label><input id="pi-county" name="county" maxLength={80} required /></div>
                <div className="field"><label htmlFor="pi-state">State *</label><input id="pi-state" name="state" maxLength={2} defaultValue="TX" required style={{ textTransform: "uppercase" }} /></div>
              </div>
              <div className="grid2">
                <div className="field"><label htmlFor="pi-email">Email</label><input id="pi-email" name="email" type="email" maxLength={160} autoComplete="email" /></div>
                <div className="field"><label htmlFor="pi-phone">Phone</label><input id="pi-phone" name="phone" type="tel" maxLength={30} autoComplete="tel" /></div>
              </div>
              <span className="xs muted" style={{ marginTop: -8 }}>Add at least an email or a phone number.</span>
              <div className="field"><label htmlFor="pi-social">Social profile or business website</label><input id="pi-social" name="social" maxLength={300} placeholder="instagram.com/yourbusiness or @handle" /></div>
              <div className="field"><label htmlFor="pi-msg">Anything you&apos;d like us to know (optional)</label><textarea id="pi-msg" name="message" maxLength={1000} rows={3} /></div>
              <label className="check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="understand" required /><span>I understand this only shares my interest — it doesn&apos;t create an account, activate a membership, or reserve a spot.</span></label>
            </ActionForm>
            <p className="xs muted p" style={{ margin: 0 }}>Nearest uses these details only to contact you about joining Nearest. See our <a className="link" href="/privacy">Privacy Policy</a>.</p>
          </>
        )}
      </div>
    </div>
  );
}
