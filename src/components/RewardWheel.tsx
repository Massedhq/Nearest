"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { wheelInfo, spinWheel, holdReward } from "@/app/vote-actions";
import { GrantedCard } from "@/components/GrantedCard";
import { track } from "@/components/AdTags";

type Seg = { id: string; label: string; kind: string };
type Won = { batchId: string; label: string; kind: string; holdUntil: string; email?: string | null; status?: string };
const FILLS = ["#0B0B0C", "#ECE8E1", "#1C1C1F", "#C9C6C0"];
const INK = ["#ECE8E1", "#0A0A0A", "#ECE8E1", "#0A0A0A"];
const until = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Nearest GRANTED reward wheel (online votes on /vote). The server picks and saves the reward (spinWheel) BEFORE the
 * wheel turns; the animation only lands on that saved result. One spin per vote — coming back shows the same result.
 */
export function RewardWheel({ signedIn }: { signedIn: boolean }) {
  const [info, setInfo] = useState<{ open: boolean; rules: string; segments: Seg[] } | null>(null);
  const [won, setWon] = useState<Won | null>(null);
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [held, setHeld] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    start(async () => {
      const r = await wheelInfo();
      setInfo(r);
      if (r.spin) { setWon(r.spin); if (r.spin.email) setHeld(r.spin.holdUntil); }
    });
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, []);

  const segs = info?.segments ?? [];
  const n = Math.max(segs.length, 1), slice = 360 / n;

  const go = () => {
    setErr("");
    start(async () => {
      const r = await spinWheel();
      if ("error" in r) return setErr(r.error ?? "Something went wrong.");
      const i = Math.max(0, segs.findIndex((x) => x.id === r.batchId));
      // Land the pointer (top) on the middle of the saved segment.
      setAngle((a) => a - (a % 360) + 360 * 6 + (360 - (i * slice + slice / 2)));
      setSpinning(true);
      track("Spin", r.eventId);
      timer.current = setTimeout(() => { setSpinning(false); setWon(r); }, 4200);
    });
  };
  const hold = () => {
    setErr("");
    start(async () => {
      const r = await holdReward(email);
      if ("error" in r) return setErr(r.error ?? "Something went wrong.");
      setHeld(r.holdUntil);
    });
  };

  const accountButtons = (
    <>
      <Link className="btn" href={signedIn ? "/cards" : "/sign-up"}>{signedIn ? "Go to my account" : "Create my account"}</Link>
      {!signedIn && <Link className="btn ghost" href="/sign-in?redirect_url=/cards">I already have an account</Link>}
    </>
  );

  if (!info) return <div className="lightbox" style={{ minHeight: 200 }} />;

  if (won && !spinning) return (
    <div className="lightbox" style={{ gap: 12 }}>
      <span className="b" style={{ textAlign: "center" }}>{won.status === "expired" ? "This reward's hold has ended." : "You won!"}</span>
      <GrantedCard label={won.label} kind={won.kind} />
      {won.status !== "expired" && won.status !== "declined" && (held
        ? <span className="small" style={{ textAlign: "center" }}>Held for you until {until(held)}. Create your account to add it.</span>
        : (
          <>
            <div className="field"><label htmlFor="w-email">Email to hold your reward for 3 days</label>
              <input id="w-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
            </div>
            <button className="btn ghost" type="button" onClick={hold} disabled={busy}>{busy ? "Saving…" : "Hold my reward"}</button>
          </>
        ))}
      {err && <p className="err" role="alert">{err}</p>}
      {accountButtons}
    </div>
  );

  return (
    <div className="lightbox" style={{ gap: 12, alignItems: "center" }}>
      <span className="b">Spin the Nearest GRANTED wheel</span>
      {info.open ? (
        <>
          <div style={{ position: "relative", width: "min(300px, 80vw)", aspectRatio: "1" }}>
            <svg viewBox="-110 -110 220 220" style={{ width: "100%", height: "100%", transform: `rotate(${angle}deg)`, transition: spinning ? "transform 4s cubic-bezier(.12,.72,.08,1)" : "none" }} aria-hidden="true">
              <circle r="106" fill="#2A2A2D" stroke="#9C9A95" strokeWidth="2" />
              {segs.map((sg, i) => {
                const a0 = ((i * slice - 90) * Math.PI) / 180, a1 = (((i + 1) * slice - 90) * Math.PI) / 180, mid = i * slice + slice / 2;
                const large = slice > 180 ? 1 : 0;
                return (
                  <g key={sg.id}>
                    <path d={n === 1 ? "M0,-100 A100,100 0 1,1 -0.01,-100 Z" : `M0,0 L${100 * Math.cos(a0)},${100 * Math.sin(a0)} A100,100 0 ${large},1 ${100 * Math.cos(a1)},${100 * Math.sin(a1)} Z`} fill={sg.kind === "free" ? "#B9B5AD" : FILLS[i % 4]} stroke="#3A3A3E" strokeWidth="0.8" />
                    <text transform={`rotate(${mid}) translate(0,-66)`} textAnchor="middle" fill={sg.kind === "free" ? "#0A0A0A" : INK[i % 4]} style={{ font: "800 9px var(--font-body), sans-serif", letterSpacing: "0.04em" }}>{sg.label.toUpperCase()}</text>
                  </g>
                );
              })}
              <circle r="16" fill="#0B0B0C" stroke="#C9C6C0" strokeWidth="2" />
            </svg>
            <span aria-hidden="true" style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "11px solid transparent", borderRight: "11px solid transparent", borderTop: "20px solid #ECE8E1", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.6))" }} />
          </div>
          {err && <><p className="err" role="alert">{err}</p>{accountButtons}</>}
          <button className="btn" type="button" onClick={go} disabled={busy || spinning} style={{ width: "100%" }}>{spinning ? "Spinning…" : busy ? "One moment…" : "Spin"}</button>
          {info.rules && <details className="xs muted" style={{ width: "100%" }}><summary className="link">Official rules</summary><div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{info.rules}</div></details>}
        </>
      ) : (
        <>
          <span className="small muted" style={{ textAlign: "center" }}>The reward wheel isn&apos;t running right now.</span>
          {accountButtons}
        </>
      )}
    </div>
  );
}
