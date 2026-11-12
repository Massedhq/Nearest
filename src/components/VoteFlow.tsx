"use client";
import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { voteCities, voteSchools, voteServices, submitVote, enterVoucher } from "@/app/vote-actions";

type City = { id: number; name: string };
type School = { id: number; name: string; type: string | null };
type Svc = { name: string; fromCents: number | null; near: boolean };
const money = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;

/**
 * /card — "YOUR CITY. YOUR CHOICE." (Nearest GRANTED Certificate Voucher, 2026-11-11). Kept short on purpose:
 * welcome → where you live + school → services → thank you + voucher number/code → finish creating the account.
 * No account, county, graduation year, ID or parent approval is needed to vote.
 */
export function VoteFlow({ states, signedIn }: { states: string[]; signedIn: boolean }) {
  const [step, setStep] = useState<"start" | "where" | "services" | "thanks">("start");
  const [state, setState] = useState("TX");
  const [cities, setCities] = useState<City[]>([]);
  const [cityText, setCityText] = useState("");
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [schoolOther, setSchoolOther] = useState("");
  const [svcs, setSvcs] = useState<Svc[]>([]);
  const [picks, setPicks] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, start] = useTransition();
  const [num, setNum] = useState("");
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState<{ ok: string; signedIn: boolean } | null>(null);

  const city = cities.find((c) => c.name.toLowerCase() === cityText.trim().toLowerCase()) ?? null;
  useEffect(() => { if (state) start(async () => { setCities(await voteCities(state)); }); }, [state]);
  useEffect(() => {
    setSchoolId(null); setSchools([]);
    if (city) start(async () => { setSchools(await voteSchools(city.id)); });
  }, [city?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toServices = () => {
    setErr("");
    if (!city) return setErr("Start typing the city you live in and pick it from the list.");
    if (!schoolId && !schoolOther.trim()) return setErr("Choose your school, or type it if it isn't listed.");
    start(async () => { setSvcs(await voteServices(city.id)); setStep("services"); window.scrollTo(0, 0); });
  };
  const vote = () => {
    setErr("");
    if (!picks.length) return setErr("Pick at least one service.");
    start(async () => {
      const r = await submitVote({ state, cityId: city!.id, schoolId, schoolOther, categories: picks });
      if ("error" in r) return setErr(r.error);
      setStep("thanks"); window.scrollTo(0, 0);
    });
  };
  const addVoucher = () => {
    setErr("");
    start(async () => {
      const r = await enterVoucher(num, code);
      if ("error" in r) return setErr(r.error);
      setSaved(r);
    });
  };

  const Head = () => (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
      <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={150} height={44} style={{ objectFit: "contain" }} priority />
    </div>
  );

  if (step === "start") return (
    <div className="body" style={{ gap: 16, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <Head />
      <span className="eyebrow" style={{ textAlign: "center" }}>Nearest GRANTED Certificate Voucher</span>
      <h1 className="disp h1" style={{ textAlign: "center", margin: 0 }}>YOUR CITY.<br />YOUR CHOICE.</h1>
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>Help us bring the beauty, grooming, wellness, and self-care professionals you want to your city at student-friendly prices.</p>
      <button className="btn" type="button" onClick={() => setStep("where")}>Let&apos;s get started</button>
      <p className="xs muted" style={{ textAlign: "center", margin: 0 }}>Takes under a minute. No account needed to vote. Already have an account? <Link className="link" href="/sign-in?redirect_url=/cards">Sign in</Link></p>
    </div>
  );

  if (step === "where") return (
    <div className="body" style={{ gap: 14, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <Head />
      <div className="steps"><span className="on" /><span /><span /></div>
      <h1 className="disp h2" style={{ margin: 0 }}>Where do you live and go to school?</h1>
      <div className="field"><label htmlFor="v-state">State</label>
        <select id="v-state" value={state} onChange={(e) => { setState(e.target.value); setCityText(""); }}>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="field"><label htmlFor="v-city">City you live in</label>
        <input id="v-city" list="v-cities" autoComplete="off" placeholder="Start typing your city" value={cityText} onChange={(e) => setCityText(e.target.value)} />
        <datalist id="v-cities">{cities.map((c) => <option key={c.id} value={c.name} />)}</datalist>
      </div>
      <div className="field"><label htmlFor="v-school">School</label>
        <select id="v-school" value={schoolId ?? ""} disabled={!city} onChange={(e) => { setSchoolId(e.target.value ? Number(e.target.value) : null); if (e.target.value) setSchoolOther(""); }}>
          <option value="">{city ? (schools.length ? "Choose your school…" : "No schools listed — type yours below") : "Pick your city first"}</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      {city && !schoolId && (
        <div className="field"><label htmlFor="v-other">My school isn&apos;t listed (or I go to school online)</label>
          <input id="v-other" maxLength={120} placeholder="Type your school's name" value={schoolOther} onChange={(e) => setSchoolOther(e.target.value)} />
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="button" onClick={toServices} disabled={busy}>{busy ? "Loading…" : "Continue"}</button>
      <button className="link small" type="button" onClick={() => setStep("start")} style={{ background: "none", border: 0, color: "inherit" }}>Back</button>
    </div>
  );

  if (step === "services") return (
    <div className="body" style={{ gap: 14, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <Head />
      <div className="steps"><span className="on" /><span className="on" /><span /></div>
      <h1 className="disp h2" style={{ margin: 0 }}>What services would you like in your city?</h1>
      <p className="muted small" style={{ margin: 0 }}>Choose the services you&apos;d like Nearest to bring to your area. Pick as many as you want.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        {svcs.map((s) => {
          const on = picks.includes(s.name);
          return (
            <button key={s.name} type="button" aria-pressed={on} onClick={() => setPicks(on ? picks.filter((x) => x !== s.name) : [...picks, s.name])}
              style={{ textAlign: "left", borderRadius: 14, padding: "12px 12px", border: `1px solid ${on ? "#ECE8E1" : "#2F2F33"}`, background: on ? "#ECE8E1" : "#0E0E10", color: on ? "#0A0A0A" : "#ECE8E1", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, font: "inherit" }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>{on ? "✓ " : ""}{s.name}</span>
              <span style={{ fontSize: 11, opacity: 0.75 }}>{s.fromCents != null ? `From ${money(s.fromCents)}${s.near ? " nearby" : ""}` : "\u00a0"}</span>
            </button>
          );
        })}
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      <button className="btn" type="button" onClick={vote} disabled={busy}>{busy ? "Saving…" : "Submit my vote"}</button>
      <button className="link small" type="button" onClick={() => setStep("where")} style={{ background: "none", border: 0, color: "inherit" }}>Back</button>
    </div>
  );

  return (
    <div className="body" style={{ gap: 14, maxWidth: 480, margin: "0 auto", width: "100%" }}>
      <Head />
      <div className="steps"><span className="on" /><span className="on" /><span className="on" /></div>
      <h1 className="disp h1" style={{ textAlign: "center", margin: 0 }}>Thank you for your vote!</h1>
      <p className="muted" style={{ textAlign: "center", margin: 0 }}>You&apos;ve helped Nearest identify the services students want in your city.</p>
      <div className="lightbox" style={{ gap: 12 }}>
        <span className="b">Activate your GRANTED voucher</span>
        <span className="small">To activate your voucher and use it on Nearest, enter the 16-digit number and the security code printed on your voucher below, then finish creating your account.</span>
        {saved ? (
          <div className="card" style={{ gap: 6 }}>
            <span className="b small" style={{ color: "#1F7A3A" }}>{saved.ok}</span>
            {saved.signedIn
              ? <Link className="btn" href="/cards">See my voucher</Link>
              : <><Link className="btn" href="/sign-up">Finish creating my account</Link><Link className="btn ghost" href="/sign-in?redirect_url=/cards">I already have an account</Link></>}
          </div>
        ) : (
          <>
            <div className="field"><label htmlFor="v-num">Voucher number (16 digits)</label>
              <input id="v-num" inputMode="numeric" autoComplete="off" placeholder="8877 0000 0000 0000" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 "))} />
            </div>
            <div className="field"><label htmlFor="v-code">Security code (3 or 4 digits)</label>
              <input id="v-code" inputMode="numeric" autoComplete="off" placeholder="888" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ maxWidth: 160 }} />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <button className="btn" type="button" onClick={addVoucher} disabled={busy}>{busy ? "Checking…" : signedIn ? "Activate my voucher" : "Add my voucher & create my account"}</button>
            {!signedIn && <span className="xs muted">No voucher with you? You can still <Link className="link" href="/sign-up">create your account</Link> and add it later in Account → Cards &amp; activations.</span>}
          </>
        )}
      </div>
      <p className="xs muted" style={{ textAlign: "center", margin: 0 }}>Keep your Nearest GRANTED voucher. Vouchers are promotional, have no cash value and work once per student. Questions? support@usenearest.com</p>
    </div>
  );
}
