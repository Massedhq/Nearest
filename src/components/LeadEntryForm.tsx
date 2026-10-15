"use client";
import { useRef, useState } from "react";
import type { FormState } from "./ActionForm";

type Cat = { id: number; name: string };

/**
 * Manual prospect entry for Lead Contributors. Keeps what was typed when something needs fixing; clears after a save
 * so the next prospect can be entered. Attribution is never part of this form — the server sets it.
 */
export function LeadEntryForm({ action, categories, sources }: { action: (s: FormState, f: FormData) => Promise<FormState>; categories: Cat[]; sources: string[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  return (
    <form ref={ref} className="col g16" noValidate onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setState({});
      try {
        const r = await action({}, new FormData(e.currentTarget));
        setState(r);
        if (r.ok) ref.current?.reset();
      } catch { setState({ error: "Couldn't save — check your connection and try again." }); } finally { setBusy(false); }
    }}>
      <fieldset className="col g16" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>Professional</legend>
        <div className="field"><label htmlFor="ld-name">Professional or contact name *</label><input id="ld-name" name="name" maxLength={120} autoComplete="off" /></div>
        <div className="field"><label htmlFor="ld-bus">Business name (if any)</label><input id="ld-bus" name="business" maxLength={120} autoComplete="off" /></div>
        <div className="field"><label htmlFor="ld-cat">Service category *</label>
          <select id="ld-cat" name="categoryId" defaultValue=""><option value="" disabled>Choose a category</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </div>
      </fieldset>
      <fieldset className="col g16" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>Location</legend>
        <div className="grid3">
          <div className="field"><label htmlFor="ld-city">City *</label><input id="ld-city" name="city" maxLength={80} /></div>
          <div className="field"><label htmlFor="ld-county">County *</label><input id="ld-county" name="county" maxLength={80} /></div>
          <div className="field"><label htmlFor="ld-state">State *</label><input id="ld-state" name="state" maxLength={2} defaultValue="TX" style={{ textTransform: "uppercase" }} /></div>
        </div>
      </fieldset>
      <fieldset className="col g16" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow" style={{ marginBottom: 4 }}>Contact — at least one *</legend>
        <span className="xs muted" style={{ marginTop: -6 }}>Leads without an email address are kept as &ldquo;Needs information&rdquo; and aren&apos;t used for email outreach.</span>
        <div className="grid2">
          <div className="field"><label htmlFor="ld-email">Email</label><input id="ld-email" name="email" type="email" maxLength={160} autoComplete="off" /></div>
          <div className="field"><label htmlFor="ld-phone">Phone</label><input id="ld-phone" name="phone" type="tel" maxLength={30} autoComplete="off" /></div>
        </div>
        <div className="field"><label htmlFor="ld-social">Social profile or business website</label><input id="ld-social" name="social" maxLength={300} placeholder="instagram.com/theirbusiness or @handle" autoComplete="off" /></div>
      </fieldset>
      <fieldset className="col g16" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="eyebrow" style={{ marginBottom: 10 }}>Details</legend>
        <div className="field"><label htmlFor="ld-src">Where you found them</label>
          <select id="ld-src" name="source" defaultValue=""><option value="">Choose a source</option>{sources.map((x) => <option key={x}>{x}</option>)}</select>
        </div>
        <div className="field"><label htmlFor="ld-notes">Notes (optional, internal only)</label><textarea id="ld-notes" name="notes" maxLength={1000} rows={3} /></div>
      </fieldset>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save prospect"}</button>
    </form>
  );
}
