"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { checkCity, saveCityInterest, type CityStatus } from "@/app/public-actions";

const LABEL = { first_in: "Open — First In spots", open: "Open — additional spots", full: "Closed — spots taken" } as const;

/**
 * Public city checker: search any U.S. city or ZIP → live for bookings / open for professionals (per category) /
 * not open yet, plus an opt-in "tell me when it opens" form. Works without signing in.
 */
export function CityChecker({ categories = [] }: { categories?: { id: number; name: string }[] }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [r, setR] = useState<CityStatus | null>(null);
  const [state, save, saving] = useActionState(saveCityInterest, {});

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { setR(await checkCity(q)); } catch { setR({ query: q, found: false, city: "", state: "", zip: null, cityId: null, live: false, enrolling: false, categories: [], error: "Something went wrong. Try again." }); }
    setBusy(false);
  }

  const status = r ? (r.live ? "live" : r.found && r.enrolling ? "enrolling" : r.found ? "closed" : "not_open") : "";
  const cats = r?.categories.length ? r.categories.map((c) => ({ id: c.id, name: c.name })) : categories;

  return (
    <section id="check" className="pub-box" aria-labelledby="check-h">
      <h2 id="check-h" style={{ marginTop: 0 }}>Check your city</h2>
      <form onSubmit={run} className="pub-cta-row" role="search" style={{ alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 240px" }}>
          <label htmlFor="cc-q" className="pub-muted" style={{ display: "block", marginBottom: 4 }}>City and state, or ZIP code</label>
          <input id="cc-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Atlanta, GA · 48226" autoComplete="address-level2" maxLength={80} required
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #2A2A2D", background: "#000", color: "#ECE8E1", fontSize: 16 }} />
        </div>
        <button className="pub-btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Check"}</button>
      </form>

      {r && (
        <div role="status" aria-live="polite" style={{ marginTop: 16 }}>
          {r.error ? <p>{r.error}</p> : (
            <>
              <h3 style={{ marginTop: 0 }}>{r.city}{r.state ? `, ${r.state}` : ""}</h3>
              {r.live && <p><span className="pub-tag ok">Live for student bookings</span> Verified students can book professionals here. <Link href="/sign-up">Create a student account</Link>.</p>}
              {r.found && !r.live && <p><span className="pub-tag gold">Not live for bookings yet</span> No professional here is live yet, so students can&apos;t book in {r.city} today.</p>}
              {r.found && (
                <>
                  <p>{r.enrolling ? <><span className="pub-tag ok">Open for professionals</span> Professionals can enroll here in the categories marked open. <Link href="/pro/sign-up">Join as a professional</Link>.</> : <><span className="pub-tag">Closed at capacity</span> Every category here has filled its spots.</>}</p>
                  {r.categories.length > 0 && (
                    <details><summary className="pub-muted" style={{ cursor: "pointer" }}>Professional spots by category</summary>
                      <ul>{r.categories.map((c) => <li key={c.id}>{c.name}: {LABEL[c.status]}</li>)}</ul>
                    </details>
                  )}
                </>
              )}
              {!r.found && <p><span className="pub-tag gold">Not open yet</span> Nearest hasn&apos;t opened {r.city || "this city"} yet — students can&apos;t book and professionals can&apos;t enroll there today. Leave your details and Nearest will know there&apos;s interest.</p>}

              {state.ok ? <p className="pub-box note">{state.ok}</p> : (
                <form action={save} style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <strong>{r.live ? "Get updates about Nearest here" : "Tell me when Nearest opens here"}</strong>
                  <input type="hidden" name="city" value={r.city || r.query} />{r.state && <input type="hidden" name="state" value={r.state} />}
                  <input type="hidden" name="zip" value={r.zip ?? ""} /><input type="hidden" name="cityId" value={r.cityId ?? ""} /><input type="hidden" name="status" value={status} />
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
                  <fieldset style={{ border: 0, padding: 0, margin: 0, display: "flex", gap: 14, flexWrap: "wrap" }}>
                    <legend className="pub-muted" style={{ marginBottom: 4 }}>I&apos;m a</legend>
                    {[["professional", "Professional"], ["student", "Student"], ["parent", "Parent or guardian"]].map(([v, l]) => <label key={v}><input type="radio" name="role" value={v} required /> {l}</label>)}
                  </fieldset>
                  {!r.state && <label>State (2 letters) <input name="state" maxLength={2} required style={{ width: 60 }} /></label>}
                  <label>Email <input type="email" name="email" required maxLength={160} autoComplete="email" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #2A2A2D", background: "#000", color: "#ECE8E1" }} /></label>
                  <label>Name (optional) <input name="name" maxLength={80} autoComplete="name" style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid #2A2A2D", background: "#000", color: "#ECE8E1" }} /></label>
                  {cats.length > 0 && <label>Main service (professionals) <select name="categoryId" defaultValue="" style={{ padding: 10, borderRadius: 10, background: "#000", color: "#ECE8E1", border: "1px solid #2A2A2D" }}><option value="">—</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
                  <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}><input type="checkbox" name="consent" required style={{ marginTop: 5 }} /><span className="pub-muted">Nearest may email me about Nearest in my city. I can ask to stop at any time. (No texts, no sharing of my details.)</span></label>
                  {state.error && <p role="alert" style={{ color: "#F2A38F" }}>{state.error}</p>}
                  <button className="pub-btn" type="submit" disabled={saving} style={{ justifySelf: "start" }}>{saving ? "Saving…" : "Notify me"}</button>
                </form>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
