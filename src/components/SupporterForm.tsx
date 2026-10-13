"use client";
import { useState } from "react";

const EXPERIENCES: [string, string][] = [
  ["walkthrough", "I saw a walkthrough / demonstration of Nearest"],
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

/** Supporter submission (public, invitation link). Posts to /api/supporters/submit; shows the private management link after. */
export function SupporterForm({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [experience, setExperience] = useState("");
  const [type, setType] = useState("");
  const [rel, setRel] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  if (done) {
    return (
      <div className="col" style={{ gap: 14 }}>
        <div className="card ok" style={{ gap: 6 }}>
          <span className="b">Thank you — your statement was received.</span>
          <span className="small">Nearest reviews every statement by hand. Nothing is published until it&apos;s approved, and only with the permissions you gave.</span>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Your private management link</span>
          <span className="small">Save this link. It&apos;s the only way to correct your statement, change your permissions or withdraw it — Nearest doesn&apos;t email it, and anyone with the link can make changes.</span>
          <input readOnly value={done} className="ainput" onFocus={(e) => e.currentTarget.select()} aria-label="Management link" />
          <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(done); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Copied" : "Copy link"}</button>
          <a className="link small" href={done}>Open it now</a>
        </div>
      </div>
    );
  }

  return (
    <form className="col g16" onSubmit={async (e) => {
      e.preventDefault();
      setErr(""); setBusy(true);
      try {
        const fd = new FormData(e.currentTarget);
        fd.set("token", token);
        if (!photo) fd.delete("portrait");
        const r = await fetch("/api/supporters/submit", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) { setErr(j.error || "Something went wrong. Try again."); return; }
        setDone(j.manageUrl);
        window.scrollTo({ top: 0 });
      } catch { setErr("Couldn't send — check your connection and try again."); } finally { setBusy(false); }
    }}>
      <div className="field"><label htmlFor="sp-name">Your name</label><input id="sp-name" name="name" required maxLength={120} autoComplete="name" /></div>
      <div className="field"><label htmlFor="sp-email">Contact email (private — never published)</label><input id="sp-email" name="email" type="email" required maxLength={160} autoComplete="email" /></div>
      <div className="field"><label htmlFor="sp-title">Professional title</label><input id="sp-title" name="title" required maxLength={120} placeholder="e.g. School counselor" /></div>
      <div className="field"><label htmlFor="sp-org">School or organization</label><input id="sp-org" name="organization" required maxLength={160} /></div>

      <div className="field">
        <label htmlFor="sp-photo">Portrait (optional)</label>
        <input id="sp-photo" name="portrait" type="file" accept="image/jpeg,image/png,image/webp" style={{ paddingTop: 12 }} onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
        <span className="xs muted">JPG, PNG or WebP, up to 4 MB. Without a photo, your initials are shown.</span>
      </div>

      <div className="field">
        <label htmlFor="sp-statement">Your statement, in your own words</label>
        <textarea id="sp-statement" name="statement" required minLength={20} maxLength={1500} style={{ height: 150 }} />
      </div>

      <div className="field">
        <label>What did you review or experience?</label>
        {EXPERIENCES.map(([v, l]) => (
          <label key={v} className={`check xs${experience === v ? " on" : ""}`}><input type="radio" name="experience" value={v} required onChange={() => setExperience(v)} /><span>{l}</span></label>
        ))}
        {experience === "other" && <input name="experienceOther" required maxLength={300} placeholder="Describe what you reviewed or experienced" />}
      </div>

      <div className="field">
        <label>Is this a personal or organizational endorsement?</label>
        <label className={`check xs${type === "personal" ? " on" : ""}`}><input type="radio" name="endorsementType" value="personal" required onChange={() => setType("personal")} /><span>Personal — my own view</span></label>
        <label className={`check xs${type === "organizational" ? " on" : ""}`}><input type="radio" name="endorsementType" value="organizational" required onChange={() => setType("organizational")} /><span>On behalf of my organization — I&apos;m authorized to speak for it</span></label>
        <span className="xs muted">A personal endorsement does not establish school or district endorsement. Naming your school or organization doesn&apos;t make it an organizational endorsement.</span>
        {type === "organizational" && (
          <>
            <input name="orgAuthorityNote" required maxLength={300} placeholder="Your role and how you're authorized (e.g. principal, approved by…)" />
            <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="orgAuthorityConfirmed" required /><span>I confirm I&apos;m authorized to provide this endorsement on behalf of my organization.</span></label>
          </>
        )}
      </div>

      <div className="field">
        <label>Do you have any compensation, benefit, employment or other relationship with Nearest?</label>
        <label className={`check xs${rel === "none" ? " on" : ""}`}><input type="radio" name="relationshipAnswer" value="none" required onChange={() => setRel("none")} /><span>No relationship</span></label>
        <label className={`check xs${rel === "some" ? " on" : ""}`}><input type="radio" name="relationshipAnswer" value="some" required onChange={() => setRel("some")} /><span>Yes</span></label>
        {rel === "some" && (
          <>
            {RELATIONSHIPS.map(([v, l]) => <label key={v} className="check xs"><input type="checkbox" name="relationships" value={v} /><span>{l}</span></label>)}
            <input name="relationshipNote" maxLength={500} placeholder="Details (optional)" />
            <span className="xs muted">Relationships are disclosed next to a published statement.</span>
          </>
        )}
      </div>

      <div className="field">
        <label>What may Nearest publish? (each is separate)</label>
        <label className="check xs"><input type="checkbox" name="permStatement" /><span>My statement</span></label>
        <label className="check xs"><input type="checkbox" name="permName" /><span>My name and professional title</span></label>
        <label className="check xs"><input type="checkbox" name="permPortrait" disabled={!photo} /><span>My portrait{photo ? "" : " (upload one above)"}</span></label>
        <label className="check xs"><input type="checkbox" name="permAffiliation" /><span>My school or organization</span></label>
        <span className="xs muted">Nearest only publishes a statement with permission for both the statement and your name and title. You can change these later with your private link.</span>
      </div>

      <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="confirmHonest" required /><span>This statement reflects my honest perspective.</span></label>
      {photo && <label className="check xs" style={{ alignItems: "flex-start" }}><input type="checkbox" name="confirmPhoto" required /><span>I have permission to provide the uploaded photo.</span></label>}

      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Sending…" : "Submit my statement"}</button>
      <span className="xs muted" style={{ textAlign: "center" }}>Nearest reviews every statement by hand before anything is published.</span>
    </form>
  );
}
