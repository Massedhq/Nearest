"use client";
import { useState } from "react";
import { StarRating } from "./StarRating";

const EXPERIENCES: [string, string][] = [
  ["walkthrough", "I watched the explainer video or a walkthrough of Nearest"],
  ["website", "I reviewed the Nearest website"],
  ["platform_use", "I've actually used the Nearest platform"],
  ["other", "Something else (describe)"],
];
const RELATIONSHIPS: [string, string][] = [
  ["compensation", "I received or will receive compensation (money) from Nearest"],
  ["benefit", "I received a benefit (free service, credit, gift or similar)"],
  ["employment", "I work for or with Nearest (employee, contractor, partner, ambassador)"],
  ["other", "Another relationship with Nearest"],
];
const AFFILIATION: [string, string][] = [
  ["current", "I'm currently with a school or organization"],
  ["former", "I was previously with a school or organization (not anymore)"],
  ["none", "I'm not with a school or organization"],
];

type Texts = { statementExample: string; benefitExample: string; consent: string };

/** Supporter submission (public, invitation link). Posts to /api/supporters/submit; shows the private management link after. */
export function SupporterForm({ token, texts }: { token: string; texts: Texts }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<{ manageUrl: string; googleReviewUrl: string | null; review: string } | null>(null);
  const [copiedReview, setCopiedReview] = useState(false);
  const [copied, setCopied] = useState(false);
  const [experience, setExperience] = useState("");
  const [type, setType] = useState("");
  const [rel, setRel] = useState("");
  const [aff, setAff] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  if (done) {
    return (
      <div className="col" style={{ gap: 14 }}>
        <div className="card ok" style={{ gap: 6 }}>
          <span className="b">Thank you — your statement was received.</span>
          <span className="small">Nearest gives it a quick review and then publishes it on usenearest.com.</span>
        </div>
        {done.googleReviewUrl && (
          <div className="card" style={{ gap: 8 }}>
            <span className="eyebrow">Post the same review on Google (optional)</span>
            <span className="small">Your review is saved on Nearest. To share it on Google too, tap below: we copy your review, then Google&apos;s review page for Nearest opens — paste it, choose your stars, and post. Google only lets you post from your own Google account.</span>
            <a className="btn sm" href={done.googleReviewUrl} target="_blank" rel="noopener noreferrer" onClick={async () => { try { await navigator.clipboard.writeText(done.review); setCopiedReview(true); } catch { setCopiedReview(false); } }}>Copy my review &amp; open Google</a>
            {copiedReview && <span className="xs muted">Copied — paste it into Google&apos;s review box.</span>}
          </div>
        )}
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Your private management link</span>
          <span className="small">Save this link. It&apos;s the only way to correct your statement or withdraw it — Nearest doesn&apos;t email it, and anyone with the link can make changes.</span>
          <input readOnly value={done.manageUrl} className="ainput" onFocus={(e) => e.currentTarget.select()} aria-label="Management link" />
          <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(done.manageUrl); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</button>
        </div>
      </div>
    );
  }

  const opt = { fontSize: 14, fontWeight: 500, color: "#ECE8E1", letterSpacing: 0 } as const;
  return (
    <form className="col g16" onSubmit={async (e) => {
      e.preventDefault();
      setErr(""); setBusy(true);
      try {
        const fd = new FormData(e.currentTarget);
        const review = [String(fd.get("statement") ?? "").trim(), String(fd.get("benefit") ?? "").trim()].filter(Boolean).join("\n\n");
        fd.set("token", token);
        if (!photo) fd.delete("portrait");
        const r = await fetch("/api/supporters/submit", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setErr(j.error || "Something went wrong. Try again."); return; }
        setDone({ manageUrl: j.manageUrl, googleReviewUrl: j.googleReviewUrl ?? null, review });
        window.scrollTo({ top: 0 });
      } catch { setErr("Couldn't send — check your connection and try again."); } finally { setBusy(false); }
    }}>
      <div className="field"><label htmlFor="sp-name">Your name</label><input id="sp-name" name="name" required maxLength={120} autoComplete="name" /></div>
      <div className="field"><label htmlFor="sp-email">Contact email (private — never published)</label><input id="sp-email" name="email" type="email" required maxLength={160} autoComplete="email" /></div>
      <div className="field"><label htmlFor="sp-title">Professional title</label><input id="sp-title" name="title" required maxLength={120} placeholder="e.g. School counselor, Teacher, Retired principal" /></div>

      <div className="field">
        <label>School or organization</label>
        {AFFILIATION.map(([v, l]) => (
          <label key={v} className={`check${aff === v ? " on" : ""}`}><input type="radio" name="affiliationStatus" value={v} required onChange={() => setAff(v)} /><span style={opt}>{l}</span></label>
        ))}
        {(aff === "current" || aff === "former") && (
          <input name="organization" required maxLength={160} placeholder={aff === "former" ? "Where you were (e.g. Frisco ISD)" : "Where you are now (e.g. Frisco ISD)"} />
        )}
      </div>

      <div className="field">
        <label htmlFor="sp-photo">Your photo (optional)</label>
        <input id="sp-photo" name="portrait" type="file" accept="image/jpeg,image/png,image/webp" style={{ paddingTop: 12 }} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <span className="xs muted">JPG, PNG or WebP, up to 4 MB. Without a photo, your initials are shown.</span>
      </div>

      <div className="field">
        <label>Your rating of Nearest</label>
        <StarRating />
      </div>

      <div className="field">
        <label htmlFor="sp-statement">Your opinion of Nearest, in your own words</label>
        <textarea id="sp-statement" name="statement" required minLength={20} maxLength={1500} placeholder={texts.statementExample} style={{ height: 160 }} />
      </div>
      <div className="field">
        <label htmlFor="sp-benefit">How could Nearest benefit students and parents?</label>
        <textarea id="sp-benefit" name="benefit" required minLength={20} maxLength={1500} placeholder={texts.benefitExample} style={{ height: 130 }} />
        <span className="xs muted">The examples are only ideas — please write what you actually think.</span>
      </div>

      <div className="field">
        <label>What did you review or experience?</label>
        {EXPERIENCES.map(([v, l]) => (
          <label key={v} className={`check${experience === v ? " on" : ""}`}><input type="radio" name="experience" value={v} required onChange={() => setExperience(v)} /><span style={opt}>{l}</span></label>
        ))}
        {experience === "other" && <input name="experienceOther" required maxLength={300} placeholder="Describe what you reviewed or experienced" />}
      </div>

      <div className="field">
        <label>Is this a personal or organizational endorsement?</label>
        <label className={`check${type === "personal" ? " on" : ""}`}><input type="radio" name="endorsementType" value="personal" required onChange={() => setType("personal")} /><span style={opt}>Personal — my own view</span></label>
        {aff === "current" && <label className={`check${type === "organizational" ? " on" : ""}`}><input type="radio" name="endorsementType" value="organizational" required onChange={() => setType("organizational")} /><span style={opt}>On behalf of my organization — I&apos;m authorized to speak for it</span></label>}
        <span className="xs muted">A personal endorsement does not establish school or district endorsement. Naming a school or organization doesn&apos;t make it an organizational endorsement.</span>
        {type === "organizational" && aff === "current" && (
          <>
            <input name="orgAuthorityNote" required maxLength={300} placeholder="Your role and how you're authorized (e.g. principal, approved by…)" />
            <label className="check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="orgAuthorityConfirmed" required /><span style={opt}>I confirm I&apos;m authorized to provide this endorsement on behalf of my organization.</span></label>
          </>
        )}
      </div>

      <div className="field">
        <label>Do you have any compensation, benefit, employment or other relationship with Nearest?</label>
        <label className={`check${rel === "none" ? " on" : ""}`}><input type="radio" name="relationshipAnswer" value="none" required onChange={() => setRel("none")} /><span style={opt}>No relationship</span></label>
        <label className={`check${rel === "some" ? " on" : ""}`}><input type="radio" name="relationshipAnswer" value="some" required onChange={() => setRel("some")} /><span style={opt}>Yes</span></label>
        {rel === "some" && (
          <>
            {RELATIONSHIPS.map(([v, l]) => <label key={v} className="check"><input type="checkbox" name="relationships" value={v} /><span style={opt}>{l}</span></label>)}
            <input name="relationshipNote" maxLength={500} placeholder="Details (optional)" />
            <span className="xs muted">Relationships are disclosed next to your published statement.</span>
          </>
        )}
      </div>

      <label className="check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="confirmHonest" required /><span style={opt}>This statement reflects my honest perspective.</span></label>
      {photo && <label className="check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="confirmPhoto" required /><span style={opt}>I have permission to provide the uploaded photo.</span></label>}
      <label className="check" style={{ alignItems: "flex-start" }}><input type="checkbox" name="publishConsent" required /><span style={opt}>{texts.consent}</span></label>

      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit my statement"}</button>
    </form>
  );
}
