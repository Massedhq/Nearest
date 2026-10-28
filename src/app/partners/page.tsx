import Link from "next/link";
import Image from "next/image";
import { ActionForm } from "@/components/ActionForm";
import { applyPartner } from "@/app/partner-actions";
import { PARTNER_DEMO_PATH, PARTNER_SETUP_DEMO_PATH } from "@/lib/partners";

export const metadata = {
  title: "Become a Nearest Partner",
  description: "A free link-in-bio page for beauty educators and creators — your services, Model Calls, videos and shop links, with booking on Nearest.",
  alternates: { canonical: "/partners" },
};

const POINTS = [
  ["One link for your bio", "Your photo, top services, Model Calls, videos and shop links on one page — it replaces your Linktree."],
  ["Booking built in", "Followers tap Book and go straight into Nearest booking: services, add-ons, travel, day and time, and secure payment."],
  ["Bundle my booking & Model Calls", "Let clients book several services in one visit, and post discounted Model Calls when you're practicing or filming."],
  ["Saves to their phone like an app", "Clients can save your page to their home screen. It opens right to you, with your photo as the icon."],
  ["You stay in control", "Change your photo, prices, links and videos any time from the Nearest pro app. Free to set up — no monthly fee."],
] as const;

/** Public: what a Nearest Partner page is, the two demos, and the application form. */
export default function Partners() {
  return (
    <div className="scr" style={{ minHeight: "100dvh", overflow: "visible" }}>
      <div className="body" style={{ maxWidth: 560, width: "100%", margin: "0 auto", gap: 18, padding: "24px 16px 40px" }}>
        <Link href="/" className="row" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><Image src="/brand/nearest-monogram.png" alt="" width={32} height={32} /><span className="disp">Nearest</span></Link>
        <div className="col g8">
          <span className="eyebrow">Nearest Partner</span>
          <h1 className="disp" style={{ fontSize: 36, lineHeight: 1.1 }}>Your link in bio, with booking built in.</h1>
          <p className="p" style={{ margin: 0 }}>For beauty educators and creators. Share one link — your followers book you, watch your videos and shop your favorites.</p>
        </div>

        <div className="col g8">
          <span className="eyebrow">See it first</span>
          <Link className="btn" href={PARTNER_DEMO_PATH}>See how it looks to clients</Link>
          <Link className="btn ghost" href={PARTNER_SETUP_DEMO_PATH}>See how setup works</Link>
        </div>

        <div className="card" style={{ gap: 12 }}>
          {POINTS.map(([t, d]) => (
            <div key={t} className="col g4"><span className="b">{t}</span><span className="small muted">{d}</span></div>
          ))}
        </div>

        <div className="card" style={{ gap: 12 }} id="apply">
          <span className="disp h2">Apply to become a partner</span>
          <span className="small muted">No account needed to apply. We review every application and email you. Once approved, you set up your page in the Nearest pro app with this same email.</span>
          <ActionForm action={applyPartner} submitLabel="Send my application" className="col g12">
            <div className="field"><label htmlFor="pa-name">Your name</label><input id="pa-name" name="name" required maxLength={120} autoComplete="name" /></div>
            <div className="field"><label htmlFor="pa-email">Email</label><input id="pa-email" name="email" type="email" required maxLength={200} autoComplete="email" /></div>
            <div className="field"><label htmlFor="pa-ig">Instagram (optional)</label><input id="pa-ig" name="instagram" maxLength={120} placeholder="@yourhandle" /></div>
            <div className="row" style={{ gap: 10 }}>
              <div className="field grow"><label htmlFor="pa-city">City</label><input id="pa-city" name="city" required maxLength={80} autoComplete="address-level2" /></div>
              <div className="field" style={{ width: 110 }}><label htmlFor="pa-state">State</label><input id="pa-state" name="state" maxLength={40} autoComplete="address-level1" /></div>
            </div>
            <div className="field"><label htmlFor="pa-sp">Your specialty</label><input id="pa-sp" name="specialty" required maxLength={120} placeholder="Brows & lashes, nails, hair, makeup…" /></div>
            <div className="field"><label htmlFor="pa-about">What do you teach or share with your followers? (optional)</label><textarea id="pa-about" name="about" maxLength={1000} /></div>
            <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
            <label className="row small" style={{ gap: 10, alignItems: "flex-start" }}><input type="checkbox" name="agree" required style={{ marginTop: 3 }} /> <span>I agree that Nearest can email me about the partner program.</span></label>
          </ActionForm>
        </div>
        <span className="small muted" style={{ textAlign: "center" }}>Already a professional on Nearest? Apply with the email you use to sign in.</span>
      </div>
    </div>
  );
}
