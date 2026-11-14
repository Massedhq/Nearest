"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { scratchInfo, scratchCard, holdReward } from "@/app/vote-actions";
import { GrantedCard } from "@/components/GrantedCard";

type Won = { label: string; kind: string; holdUntil: string; line: string; email?: string | null; status?: string };
const until = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const REVEAL_AT = 0.45; // share of the silver scratched away before the rest falls off

/**
 * Nearest GRANTED card scratch-off (printed cards on /card). The server picks and saves the reward (scratchCard) the
 * moment the student starts scratching; the silver only uncovers that saved result. One result per vote — coming back
 * shows the same reward. Separate from the online reward wheel.
 */
export function ScratchOff({ signedIn }: { signedIn: boolean }) {
  const [won, setWon] = useState<Won | null>(null);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [err, setErr] = useState("");
  const [email, setEmail] = useState("");
  const [held, setHeld] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const asked = useRef(false), down = useRef(false), moves = useRef(0), cleared = useRef(false), last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    start(async () => {
      const r = await scratchInfo();
      if (r) { setWon(r); setRevealed(true); if (r.email) setHeld(r.holdUntil); }
      setReady(true);
    });
  }, []);

  // Draw the silver cover.
  useEffect(() => {
    const c = canvas.current;
    if (!ready || revealed || !c) return;
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    if (!g) return;
    g.scale(dpr, dpr);
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#D9D6CF"); grad.addColorStop(0.45, "#9C9A95"); grad.addColorStop(0.55, "#B9B5AD"); grad.addColorStop(1, "#E6E3DC");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(10,10,10,.55)"; g.textAlign = "center";
    g.font = "800 13px Manrope, sans-serif"; g.fillText("N E A R E S T   G R A N T E D", w / 2, h / 2 - 14);
    g.font = "800 20px Manrope, sans-serif"; g.fillText("SCRATCH TO REVEAL", w / 2, h / 2 + 14);
  }, [ready, revealed]);

  // When enough silver is gone AND the saved reward is here, uncover the rest.
  const maybeReveal = (result: Won | null) => { if (cleared.current && result) setRevealed(true); };

  const ask = () => {
    if (asked.current) return;
    asked.current = true;
    start(async () => {
      const r = await scratchCard();
      if ("error" in r) { setErr(r.error ?? "Something went wrong."); return; }
      setWon(r);
      maybeReveal(r);
    });
  };

  const erase = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvas.current, g = c?.getContext("2d");
    if (!c || !g) return;
    const box = c.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    g.globalCompositeOperation = "destination-out";
    g.lineWidth = 44; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(last.current?.x ?? x, last.current?.y ?? y); g.lineTo(x, y); g.stroke();
    last.current = { x, y };
    if (++moves.current % 6) return;
    const { data } = g.getImageData(0, 0, c.width, c.height);
    let gone = 0, n = 0;
    for (let i = 3; i < data.length; i += 4 * 32) { n++; if (data[i] === 0) gone++; }
    if (gone / n >= REVEAL_AT) { cleared.current = true; maybeReveal(won); }
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
      <Link className="btn" href={signedIn ? "/cards" : "/sign-up"}>{signedIn ? "Add it to my account" : "Finish creating my account"}</Link>
      {!signedIn && <Link className="btn ghost" href="/sign-in?redirect_url=/cards">I already have an account</Link>}
    </>
  );

  if (!ready) return <div className="lightbox" style={{ minHeight: 200 }} />;

  return (
    <div className="lightbox" style={{ gap: 12 }}>
      <span className="b" style={{ textAlign: "center" }}>{revealed ? (won?.status === "expired" ? "This reward's hold has ended." : "You revealed:") : "Scratch your GRANTED card"}</span>
      <div style={{ position: "relative", width: "100%", maxWidth: 360, margin: "0 auto" }}>
        <GrantedCard label={won?.label ?? " "} kind={won?.kind ?? "discount"} />
        {!revealed && (
          <canvas ref={canvas} aria-label="Scratch here to reveal your reward" role="img"
            onPointerDown={(e) => { down.current = true; last.current = null; e.currentTarget.setPointerCapture(e.pointerId); ask(); erase(e); }}
            onPointerMove={(e) => { if (down.current) erase(e); }}
            onPointerUp={() => { down.current = false; last.current = null; }}
            onPointerCancel={() => { down.current = false; last.current = null; }}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", borderRadius: 18, touchAction: "none", cursor: "grab" }} />
        )}
      </div>
      {!revealed && !err && <span className="xs muted" style={{ textAlign: "center" }}>Use your finger (or mouse) to scratch the silver.</span>}
      {revealed && won && won.status !== "expired" && won.status !== "declined" && (
        <>
          <span className="b small" style={{ color: "#1F7A3A" }}>{won.line}</span>
          {held
            ? <span className="small" style={{ textAlign: "center" }}>Held for you until {until(held)}. Create your account to add it.</span>
            : !signedIn && (
              <>
                <div className="field"><label htmlFor="s-email">Email to hold your reward while you create your account</label>
                  <input id="s-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                </div>
                <button className="btn ghost" type="button" onClick={hold} disabled={busy}>{busy ? "Saving…" : "Hold my reward"}</button>
              </>
            )}
        </>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      {(revealed || err) && accountButtons}
    </div>
  );
}
