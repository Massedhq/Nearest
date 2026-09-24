"use client";
import { useActionState, useRef, useState } from "react";
import type { FormState } from "./ActionForm";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Gets the phone's location, then submits it with the form (check-in and problem reports). */
export function LocateForm({ action, children, label, big = false, buttonClass = "btn" }: { action: Action; children?: React.ReactNode; label: string; big?: boolean; buttonClass?: string }) {
  const [state, run, pending] = useActionState<FormState, FormData>(action, {});
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const lat = useRef<HTMLInputElement>(null), lng = useRef<HTMLInputElement>(null), acc = useRef<HTMLInputElement>(null);

  function go(e: React.MouseEvent) {
    e.preventDefault();
    setErr("");
    if (!form.current?.reportValidity()) return;
    if (!("geolocation" in navigator)) { setErr("This device can't share its location."); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        lat.current!.value = String(p.coords.latitude);
        lng.current!.value = String(p.coords.longitude);
        acc.current!.value = String(p.coords.accuracy);
        setLocating(false);
        form.current!.requestSubmit();
      },
      () => { setLocating(false); setErr("Having trouble verifying your location. Turn on Location Services for this site and try again."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  const busy = locating || pending;
  return (
    <form ref={form} action={run} className="col" style={{ gap: 12, alignItems: big ? "center" : "stretch" }}>
      <input ref={lat} type="hidden" name="lat" /><input ref={lng} type="hidden" name="lng" /><input ref={acc} type="hidden" name="acc" />
      {children}
      <button
        className={big ? "" : buttonClass}
        type="submit"
        onClick={go}
        disabled={busy}
        style={big ? { width: 190, height: 190, borderRadius: 95, background: "#ECE8E1", color: "#0A0A0A", border: 0, fontWeight: 700, letterSpacing: ".1em", fontFamily: "inherit", fontSize: 15, cursor: "pointer" } : undefined}
      >
        {locating ? "Finding you…" : pending ? "Checking…" : label}
      </button>
      {(err || state.error) && <p className="err" role="alert" style={{ textAlign: "center" }}>{err || state.error}</p>}
      {state.ok && <p className="okmsg" role="status" style={{ textAlign: "center" }}>{state.ok}</p>}
    </form>
  );
}
