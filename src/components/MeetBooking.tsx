"use client";

import { useEffect, useMemo, useState } from "react";

const CITIES = ["Lewisville", "Flower Mound", "The Colony", "Highland Village", "Double Oak", "Copper Canyon", "Bartonville", "Carrollton", "Coppell", "Frisco"];
const SPECIALTIES: [string, string][] = [["nails", "Nail tech"], ["lashes", "Lash artist"], ["hair", "Hairstylist"], ["barber", "Barber"]];
const STATUSES: [string, string][] = [["licensed", "Licensed"], ["in_school", "In school"], ["self_taught", "Self-taught"]];
const label = (list: [string, string][], k: string | null) => list.find(([v]) => v === k)?.[1] ?? "";

type Av = {
  days: { date: string; label: string; slots: { time: string; label: string }[]; inCity: boolean }[];
  suggestion: { date: string; time: string; label: string } | null;
  spots: Record<string, number>; spotsTotal: number;
  starbucks: { id: number; name: string; address: string }[];
  meetingMinutes: number; lastLabel: string;
};

async function shrink(file: File, max = 1400): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("photo"))), "image/jpeg", 0.86));
}

function Back({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mt-back" aria-label="Back" onClick={onClick}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M15 5l-7 7 7 7" /></svg>
    </button>
  );
}

function PhotoPick({ title, hint, blob, onPick }: { title: string; hint: string; blob: Blob | null; onPick: (b: Blob | null) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!blob) { setUrl(null); return; } const u = URL.createObjectURL(blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [blob]);
  return (
    <div className="mt-card mt-row" style={{ gap: 14 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url ? <img src={url} alt="" className="mt-face" /> : (
        <div className="mt-face mt-face-empty"><svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 8h3.5l1.5-2.5h6L16.5 8H20v11.5H4z" /><circle cx="12" cy="13.3" r="3.5" /></svg></div>
      )}
      <div className="mt-col" style={{ gap: 6 }}>
        <span className="mt-b">{title} <span className="mt-gold">· required</span></span>
        <span className="mt-xs">{hint}</span>
        <label className="mt-pill-btn">
          {url ? "Change photo" : "Upload photo"}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { setErr(null); onPick(await shrink(f)); } catch { setErr("That photo couldn't be opened. Try another."); }
          }} />
        </label>
        {err && <span className="mt-xs mt-bad">{err}</span>}
      </div>
    </div>
  );
}

export function MeetBooking({ host }: { host: { name: string; title: string } }) {
  const [step, setStep] = useState(1);
  const [city, setCity] = useState<string | null>(null);
  const [av, setAv] = useState<Av | null>(null);
  const [loading, setLoading] = useState(false);
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [home, setHome] = useState<boolean | null>(null);
  const [declined, setDeclined] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [where, setWhere] = useState<"their_place" | "starbucks">("their_place");
  const [addr, setAddr] = useState({ address: "", suite: "", zip: "", notes: "" });
  const [spotId, setSpotId] = useState<number | null>(null);
  const [me, setMe] = useState({ first: "", last: "", biz: "", phone: "", email: "" });
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [friendOn, setFriendOn] = useState(false);
  const [friend, setFriend] = useState({ first: "", last: "", specialty: "", status: "", contact: "" });
  const [friendPhoto, setFriendPhoto] = useState<Blob | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hp, setHp] = useState("");

  useEffect(() => { window.scrollTo({ top: 0 }); }, [step]);

  async function loadCity(c: string) {
    setLoading(true); setErr(null);
    try {
      const r = await fetch(`/api/meet/availability?city=${encodeURIComponent(c)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAv(j);
      return j as Av;
    } catch {
      setErr("Couldn't load times. Check your connection and try again.");
      return null;
    } finally { setLoading(false); }
  }

  const day = useMemo(() => av?.days.find((d) => d.date === date) ?? null, [av, date]);
  const slotLabel = day?.slots.find((s) => s.time === time)?.label ?? "";
  const whenText = day && time ? `${day.label} at ${slotLabel}` : "";
  const total = av?.spotsTotal ?? 5;
  const left = (k: string) => av?.spots[k] ?? 0;
  const spot = av?.starbucks.find((s) => s.id === spotId) ?? null;

  const step5Problem = (() => {
    if (!photo) return "Upload a photo of yourself.";
    if (!me.first.trim() || !me.last.trim()) return "Enter your legal first and last name.";
    if (me.phone.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) return "Enter a 10-digit phone number.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(me.email.trim())) return "Enter a valid email.";
    if (friendOn) {
      if (!friend.first.trim() || !friend.last.trim()) return "Enter your friend's legal first and last name.";
      if (!friend.specialty) return "Choose your friend's specialty.";
      if (!friend.status) return "Choose licensed, in school or self-taught for your friend.";
      if (!friend.contact.trim()) return "Enter your friend's phone or email.";
      if (!friendPhoto) return "Upload a photo of your friend.";
      const need = friend.specialty === specialty ? 2 : 1;
      if (left(friend.specialty) < need) return `${label(SPECIALTIES, friend.specialty)} spots in ${city} are full, so your friend can't join this meeting.`;
    }
    return null;
  })();

  async function book() {
    if (!agreed || busy) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({
        city, specialty, proStatus: status, homeBased: home, date, time, locationType: where,
        address: addr.address, suite: addr.suite, zip: addr.zip, locationNotes: addr.notes, spotId: where === "starbucks" ? spotId : null,
        legalFirst: me.first, legalLast: me.last, businessName: me.biz, phone: me.phone, email: me.email, agreed,
        friend: friendOn ? { first: friend.first, last: friend.last, specialty: friend.specialty, status: friend.status, contact: friend.contact } : null,
      }));
      fd.append("photo", photo!, "me.jpg");
      if (friendOn && friendPhoto) fd.append("friendPhoto", friendPhoto, "friend.jpg");
      fd.append("website", hp);
      const r = await fetch("/api/meet/book", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({ ok: false, error: "Something went wrong. Try again." }));
      if (!j.ok) {
        setErr(j.error);
        if (/time was just taken/i.test(j.error) && city) { await loadCity(city); setTime(null); setStep(3); }
        return;
      }
      setStep(7);
    } catch {
      setErr("Something went wrong. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  function calendarFile() {
    if (!date || !time || !av) return;
    const [y, m, d] = date.split("-"), [hh, mm] = time.split(":");
    const start = `${y}${m}${d}T${hh}${mm}00`;
    const endMin = Number(hh) * 60 + Number(mm) + av.meetingMinutes;
    const end = `${y}${m}${d}T${String(Math.floor(endMin / 60)).padStart(2, "0")}${String(endMin % 60).padStart(2, "0")}00`;
    const loc = where === "starbucks" ? `${spot?.name ?? "Starbucks"} ${spot?.address ?? ""}` : `${addr.address} ${addr.suite}, ${city} ${addr.zip}`;
    const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nearest//Meet//EN", "BEGIN:VEVENT", `UID:${Date.now()}@usenearest.com`,
      `DTSTART;TZID=America/Chicago:${start}`, `DTEND;TZID=America/Chicago:${end}`, `SUMMARY:Meeting with ${host.name} (Nearest)`,
      `LOCATION:${loc.replace(/[,;]/g, " ")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = "nearest-meeting.ics";
    a.click();
  }

  const header = (n: number, back: () => void) => (
    <div className="mt-row mt-between">
      <Back onClick={back} />
      <span className="mt-step">Step {n} of 6</span>
    </div>
  );
  const ErrorBox = () => (err ? <div className="mt-card mt-err" role="alert">{err}</div> : null);

  return (
    <div className="mt-wrap">
      <style>{CSS}</style>
      <div className="mt-screen">
        {step === 1 && (
          <>
            <div className="mt-row mt-between"><span className="mt-brand">Nearest</span><span className="mt-step">Step 1 of 6</span></div>
            <div className="mt-col" style={{ gap: 16 }}>
              <div className="mt-row" style={{ gap: 14 }}>
                <div className="mt-host">{host.name.split(" ").map((w) => w[0]).join("")}</div>
                <div className="mt-col" style={{ gap: 4 }}>
                  <span className="mt-eyebrow mt-gold">{host.title}</span>
                  <span className="mt-b" style={{ fontSize: 17 }}>{host.name}</span>
                  <span className="mt-xs">Nearest · Dallas–Fort Worth</span>
                </div>
              </div>
              <h1 className="mt-h1">Let&apos;s build your book. In person.</h1>
              <p className="mt-p">I&apos;m not sending you a link and disappearing. I&apos;m pulling up to your city, sitting down with you face to face, and getting you set up to grow your clientele and your portfolio.</p>
              <p className="mt-p">Licensed, still in school, or working from home — I don&apos;t care. If you&apos;re serious about growing, I want to meet you.</p>
            </div>
            <div className="mt-card mt-col" style={{ gap: 12 }}>
              <span className="mt-b" style={{ fontSize: 13 }}>Only 5 spots per specialty, per city</span>
              <div className="mt-grid2">{SPECIALTIES.map(([k, v]) => <span key={k} className="mt-chip">{v}s</span>)}</div>
              <span className="mt-xs">Once a city&apos;s spots in your specialty are taken, booking for that specialty closes there.</span>
            </div>
            <div className="mt-col" style={{ gap: 10 }}>
              <span className="mt-eyebrow">Start here — choose your city</span>
              <div className="mt-grid2">
                {CITIES.map((c) => (
                  <button key={c} type="button" className={`mt-opt${city === c ? " on" : ""}`} aria-pressed={city === c} onClick={() => setCity(c)}>{c}</button>
                ))}
              </div>
            </div>
            <ErrorBox />
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={!city || loading} onClick={async () => {
              const a = await loadCity(city!);
              if (a) { setSpecialty(null); setDate(null); setTime(null); setDeclined(false); setSpotId(null); setStep(2); }
            }}>{loading ? "Loading…" : "Continue"}</button>
            <span className="mt-xs" style={{ textAlign: "center" }}>About 3 minutes · You&apos;ll pick a time after your city</span>
          </>
        )}

        {step === 2 && av && (
          <>
            {header(2, () => setStep(1))}
            <div className="mt-col" style={{ gap: 8 }}>
              <span className="mt-chip" style={{ alignSelf: "flex-start" }}>{city}</span>
              <h1 className="mt-h2">What&apos;s your specialty?</h1>
              <span className="mt-xs">Pick one. Spots left are live for {city}.</span>
            </div>
            <div className="mt-col" style={{ gap: 10 }}>
              {SPECIALTIES.map(([k, v]) => {
                const n = left(k);
                return (
                  <button key={k} type="button" disabled={n === 0} className={`mt-opt mt-row mt-between${specialty === k ? " on" : ""}${n === 0 ? " full" : ""}`} aria-pressed={specialty === k} onClick={() => setSpecialty(k)}>
                    <span>{v}</span><span className="mt-small">{n === 0 ? `Full in ${city}` : `${n} of ${total} spots left`}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-col" style={{ gap: 10 }}>
              <span className="mt-eyebrow">Where are you right now?</span>
              <div className="mt-grid3">{STATUSES.map(([k, v]) => <button key={k} type="button" className={`mt-opt mt-center${status === k ? " on" : ""}`} aria-pressed={status === k} onClick={() => setStatus(k)}>{v}</button>)}</div>
            </div>
            <div className="mt-col" style={{ gap: 10 }}>
              <span className="mt-eyebrow">Do you work from home?</span>
              <div className="mt-grid2">
                <button type="button" className={`mt-opt mt-center${home === true ? " on" : ""}`} aria-pressed={home === true} onClick={() => setHome(true)}>Yes, home-based</button>
                <button type="button" className={`mt-opt mt-center${home === false ? " on" : ""}`} aria-pressed={home === false} onClick={() => setHome(false)}>No — salon / suite</button>
              </div>
            </div>
            <div className="mt-card mt-small">All three are welcome. This just helps me prepare for our meeting.</div>
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={!specialty || !status || home === null} onClick={() => setStep(3)}>Continue</button>
          </>
        )}

        {step === 3 && av && (
          <>
            {header(3, () => setStep(2))}
            <h1 className="mt-h2">Pick your day &amp; time</h1>
            {av.suggestion && !declined && (
              <div className="mt-card mt-col mt-suggest" style={{ gap: 10 }}>
                <div className="mt-row mt-gold" style={{ gap: 8 }}>
                  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
                  <span className="mt-eyebrow mt-gold">I&apos;ll already be in {city}</span>
                </div>
                <span className="mt-b" style={{ fontSize: 15 }}>{av.suggestion.label}</span>
                <span className="mt-small">I&apos;m meeting other professionals in {city} that day. Grab the next open time and we&apos;ll make it a {city} day.</span>
                <div className="mt-grid2">
                  <button type="button" className="mt-cta sm" onClick={() => { setDate(av.suggestion!.date); setTime(av.suggestion!.time); setStep(4); }}>Book {av.days.find((d) => d.date === av.suggestion!.date)?.slots.find((s) => s.time === av.suggestion!.time)?.label}</button>
                  <button type="button" className="mt-ghost sm" onClick={() => setDeclined(true)}>Pick another day</button>
                </div>
              </div>
            )}
            {av.days.length === 0 ? (
              <div className="mt-card mt-small">No open times right now. Please check back soon.</div>
            ) : (
              <>
                <div className="mt-col" style={{ gap: 8 }}>
                  <span className="mt-eyebrow">Choose a day · no meetings on Mondays</span>
                  <div className="mt-days">
                    {av.days.map((d) => {
                      const [w, rest] = [d.label.split(",")[0].slice(0, 3), d.label.split(", ")[1] ?? ""];
                      return (
                        <button key={d.date} type="button" className={`mt-day${date === d.date ? " on" : ""}`} aria-pressed={date === d.date} onClick={() => { setDate(d.date); setTime(null); }}>
                          <span className="mt-xs" style={{ color: "inherit" }}>{w}</span><span className="mt-b">{rest.replace(/^[A-Za-z]+ /, "")}</span><span className="mt-xs" style={{ color: "inherit" }}>{rest.split(" ")[0]?.slice(0, 3)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {day && (
                  <div className="mt-col" style={{ gap: 8 }}>
                    <span className="mt-eyebrow">{day.label}</span>
                    <div className="mt-grid3">
                      {day.slots.map((s) => <button key={s.time} type="button" className={`mt-opt mt-center${time === s.time ? " on" : ""}`} aria-pressed={time === s.time} onClick={() => setTime(s.time)}>{s.label}</button>)}
                    </div>
                  </div>
                )}
                <span className="mt-xs">Meetings are {av.meetingMinutes} minutes. The last start time is {av.lastLabel}. Times are spaced so I have time to get to every city — times already taken don&apos;t show.</span>
              </>
            )}
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={!date || !time} onClick={() => setStep(4)}>{date && time ? `Continue with ${day?.label.split(",")[0].slice(0, 3)} ${slotLabel}` : "Continue"}</button>
          </>
        )}

        {step === 4 && av && (
          <>
            {header(4, () => setStep(3))}
            <div className="mt-col" style={{ gap: 8 }}>
              <h1 className="mt-h2">Where should we meet?</h1>
              <span className="mt-p" style={{ fontSize: 14 }}>I can come to you, or we can meet at a Starbucks in {city} — your call.</span>
            </div>
            <div className="mt-col" style={{ gap: 10 }}>
              <button type="button" className={`mt-opt mt-row${where === "their_place" ? " on" : ""}`} style={{ gap: 12 }} aria-pressed={where === "their_place"} onClick={() => setWhere("their_place")}>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /></svg>
                <span>Meet at my location</span>
              </button>
              <button type="button" disabled={!av.starbucks.length} className={`mt-opt mt-row${where === "starbucks" ? " on" : ""}`} style={{ gap: 12, alignItems: "flex-start" }} aria-pressed={where === "starbucks"} onClick={() => setWhere("starbucks")}>
                <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ flex: "none" }}><path d="M6 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" /><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17" /><path d="M9 3.5v2M12 3v2.5" /></svg>
                <span className="mt-col" style={{ gap: 4 }}><span>Meet at a Starbucks in {city}</span><span className="mt-xs" style={{ color: "inherit" }}>{av.starbucks.length ? "Pick from the Starbucks locations in your city" : `No Starbucks listed in ${city} yet`}</span></span>
              </button>
            </div>
            {where === "their_place" ? (
              <div className="mt-card mt-col" style={{ gap: 10 }}>
                <span className="mt-eyebrow">Your address in {city}</span>
                <label className="mt-field"><span>Street address</span><input value={addr.address} onChange={(e) => setAddr({ ...addr, address: e.target.value })} placeholder="1234 Main St" autoComplete="street-address" /></label>
                <div className="mt-grid2">
                  <label className="mt-field"><span>Suite / unit</span><input value={addr.suite} onChange={(e) => setAddr({ ...addr, suite: e.target.value })} placeholder="Suite 12" /></label>
                  <label className="mt-field"><span>ZIP</span><input value={addr.zip} inputMode="numeric" maxLength={5} onChange={(e) => setAddr({ ...addr, zip: e.target.value.replace(/\D/g, "") })} placeholder="75034" autoComplete="postal-code" /></label>
                </div>
                <label className="mt-field"><span>Anything I should know? (optional)</span><input value={addr.notes} onChange={(e) => setAddr({ ...addr, notes: e.target.value })} placeholder="Gate code, parking, which door" /></label>
                <span className="mt-xs">Must be in {city}. Only I see your address — it&apos;s never shared.</span>
              </div>
            ) : (
              <div className="mt-col" style={{ gap: 8 }}>
                {av.starbucks.map((s) => (
                  <button key={s.id} type="button" className={`mt-opt mt-col${spotId === s.id ? " ring" : ""}`} style={{ gap: 4, alignItems: "flex-start" }} aria-pressed={spotId === s.id} onClick={() => setSpotId(s.id)}>
                    <span>{s.name}</span><span className="mt-xs">{s.address}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={where === "their_place" ? !addr.address.trim() || addr.zip.length !== 5 : !spotId} onClick={() => setStep(5)}>Continue</button>
          </>
        )}

        {step === 5 && av && (
          <>
            {header(5, () => setStep(4))}
            <h1 className="mt-h2">Tell me who I&apos;m meeting</h1>
            <PhotoPick title="Your photo" hint="A clear photo of your face so I can find you." blob={photo} onPick={setPhoto} />
            <div className="mt-grid2">
              <label className="mt-field"><span>Legal first name</span><input value={me.first} onChange={(e) => setMe({ ...me, first: e.target.value })} placeholder="As on your ID" autoComplete="given-name" /></label>
              <label className="mt-field"><span>Legal last name</span><input value={me.last} onChange={(e) => setMe({ ...me, last: e.target.value })} placeholder="As on your ID" autoComplete="family-name" /></label>
            </div>
            <label className="mt-field"><span>Business name</span><input value={me.biz} onChange={(e) => setMe({ ...me, biz: e.target.value })} placeholder="e.g. Nails by Jordan (or leave blank)" /></label>
            <label className="mt-field"><span>Phone number</span><input type="tel" value={me.phone} onChange={(e) => setMe({ ...me, phone: e.target.value })} placeholder="(214) 555-0123" autoComplete="tel" /></label>
            <label className="mt-field"><span>Email</span><input type="email" value={me.email} onChange={(e) => setMe({ ...me, email: e.target.value })} placeholder="you@email.com" autoComplete="email" /></label>
            <input aria-hidden="true" tabIndex={-1} value={hp} onChange={(e) => setHp(e.target.value)} name="website" autoComplete="off" style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />

            <div className="mt-card mt-col" style={{ gap: 12 }}>
              <div className="mt-row mt-between" style={{ gap: 12 }}>
                <div className="mt-col" style={{ gap: 4 }}>
                  <span className="mt-b" style={{ fontSize: 15 }}>Bringing a friend?</span>
                  <span className="mt-xs">They must be a nail tech, lash artist, hairstylist or barber — or already on Nearest. No fill-ins.</span>
                </div>
                <button type="button" role="switch" aria-checked={friendOn} aria-label="Bring a friend" className={`mt-switch${friendOn ? " on" : ""}`} onClick={() => setFriendOn(!friendOn)}><span /></button>
              </div>
              {friendOn && (
                <>
                  <div className="mt-grid2">
                    <label className="mt-field dark"><span>Friend&apos;s legal first name</span><input value={friend.first} onChange={(e) => setFriend({ ...friend, first: e.target.value })} /></label>
                    <label className="mt-field dark"><span>Legal last name</span><input value={friend.last} onChange={(e) => setFriend({ ...friend, last: e.target.value })} /></label>
                  </div>
                  <span className="mt-xs">Their specialty</span>
                  <div className="mt-grid2">{SPECIALTIES.map(([k, v]) => <button key={k} type="button" disabled={left(k) === 0} className={`mt-opt sm mt-center${friend.specialty === k ? " on" : ""}${left(k) === 0 ? " full" : ""}`} aria-pressed={friend.specialty === k} onClick={() => setFriend({ ...friend, specialty: k })}>{v}</button>)}</div>
                  <div className="mt-grid3">{STATUSES.map(([k, v]) => <button key={k} type="button" className={`mt-opt sm mt-center${friend.status === k ? " on" : ""}`} aria-pressed={friend.status === k} onClick={() => setFriend({ ...friend, status: k })}>{v}</button>)}</div>
                  <label className="mt-field dark"><span>Friend&apos;s phone or email</span><input value={friend.contact} onChange={(e) => setFriend({ ...friend, contact: e.target.value })} /></label>
                  <PhotoPick title="Friend's photo" hint="So I know who's coming with you." blob={friendPhoto} onPick={setFriendPhoto} />
                  {friend.specialty && <span className="mt-xs mt-gold">Your friend takes one of the {total} {label(SPECIALTIES, friend.specialty).toLowerCase()} spots in {city}.</span>}
                </>
              )}
            </div>
            {step5Problem && <span className="mt-xs">{step5Problem}</span>}
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={!!step5Problem} onClick={() => { setErr(null); setStep(6); }}>Review my booking</button>
          </>
        )}

        {step === 6 && av && (
          <>
            {header(6, () => setStep(5))}
            <h1 className="mt-h2">Lock it in</h1>
            <div className="mt-card mt-col mt-small" style={{ gap: 12 }}>
              <div className="mt-row mt-between"><span className="mt-muted">When</span><span className="mt-b mt-right">{whenText}</span></div>
              <div className="mt-row mt-between"><span className="mt-muted">Where</span><span className="mt-b mt-right">{where === "starbucks" ? `${spot?.name}, ${city}` : `Your location · ${addr.address}${addr.suite ? `, ${addr.suite}` : ""}, ${city}`}</span></div>
              <div className="mt-row mt-between"><span className="mt-muted">You</span><span className="mt-b mt-right">{me.first} {me.last} · {label(SPECIALTIES, specialty)} · {label(STATUSES, status)}{home ? " · Home-based" : ""}</span></div>
              {me.biz.trim() && <div className="mt-row mt-between"><span className="mt-muted">Business</span><span className="mt-b mt-right">{me.biz}</span></div>}
              {friendOn && <div className="mt-row mt-between"><span className="mt-muted">Friend</span><span className="mt-b mt-right">{friend.first} {friend.last} · {label(SPECIALTIES, friend.specialty)} · {label(STATUSES, friend.status)}</span></div>}
            </div>
            <div className="mt-card mt-col mt-warn" style={{ gap: 10 }}>
              <div className="mt-row" style={{ gap: 8 }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>
                <span className="mt-eyebrow" style={{ color: "inherit" }}>Read before you book</span>
              </div>
              <span className="mt-p" style={{ fontSize: 14, color: "#F4E4DF" }}>Be sure about this day and time. Once you book, <strong>it can&apos;t be changed or moved</strong>.</span>
              <span className="mt-p" style={{ fontSize: 14, color: "#F4E4DF" }}>If you miss this meeting, <strong>you won&apos;t be able to book with me again</strong>. I&apos;m traveling to your city for you — please show up.</span>
            </div>
            <label className="mt-row mt-small" style={{ gap: 12, alignItems: "flex-start" }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-check" />
              <span>I&apos;m sure about this day and time. I understand it can&apos;t be changed and that missing it means I can&apos;t book again.</span>
            </label>
            <ErrorBox />
            <div className="mt-grow" />
            <button type="button" className="mt-cta" disabled={!agreed || busy} onClick={book}>{busy ? "Booking…" : "Book my meeting"}</button>
            {!agreed && <span className="mt-xs" style={{ textAlign: "center" }}>Check the box to book.</span>}
          </>
        )}

        {step === 7 && (
          <>
            <div className="mt-done"><svg aria-hidden="true" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
            <h1 className="mt-h1">See you {day?.label.split(",")[0]}.</h1>
            <p className="mt-p">You&apos;re locked in. {where === "starbucks" ? `I'll meet you at ${spot?.name} at ${slotLabel}` : `I'll come to you in ${city} at ${slotLabel}`}, ready to get you set up. Come ready to talk about where you want your business to go.</p>
            <div className="mt-card mt-col mt-small" style={{ gap: 12 }}>
              <div className="mt-row mt-between"><span className="mt-muted">When</span><span className="mt-b mt-right">{whenText}</span></div>
              <div className="mt-row mt-between"><span className="mt-muted">Where</span><span className="mt-b mt-right">{where === "starbucks" ? spot?.name : `Your location · ${addr.address}`}</span></div>
              <div className="mt-row mt-between"><span className="mt-muted">With</span><span className="mt-b mt-right">{host.name}{friendOn ? " + your friend" : ""}</span></div>
            </div>
            <div className="mt-col" style={{ gap: 8 }}>
              <span className="mt-eyebrow">Bring with you</span>
              <span className="mt-small">· Your phone with photos of your best work</span>
              <span className="mt-small">· Your prices for your main services</span>
              <span className="mt-small">· Your license or school info, if you have it</span>
            </div>
            <div className="mt-grow" />
            <button type="button" className="mt-cta" onClick={calendarFile}>Add to my calendar</button>
            <span className="mt-xs" style={{ textAlign: "center" }}>A confirmation is on its way to your email. This booking can&apos;t be changed.</span>
          </>
        )}
      </div>
    </div>
  );
}

const CSS = `
.mt-wrap{min-height:100vh;background:#000;color:#F4F1EA;display:flex;justify-content:center;font-family:var(--font-body),system-ui,sans-serif}
.mt-screen{width:100%;max-width:440px;box-sizing:border-box;padding:28px 22px 36px;display:flex;flex-direction:column;gap:20px;min-height:100vh}
.mt-row{display:flex;align-items:center}.mt-col{display:flex;flex-direction:column}.mt-between{justify-content:space-between}.mt-center{justify-content:center;text-align:center}
.mt-grow{flex:1}.mt-right{text-align:right}
.mt-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mt-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.mt-brand{font-family:var(--font-display),Georgia,serif;font-size:26px}
.mt-step{font-size:11px;letter-spacing:2px;color:#B8B2A7;text-transform:uppercase}
.mt-eyebrow{font-size:11px;letter-spacing:2px;color:#B8B2A7;text-transform:uppercase;font-weight:700}
.mt-gold{color:#D4B886}.mt-bad{color:#F2A38F}.mt-muted{color:#B8B2A7}
.mt-b{font-weight:700}.mt-small{font-size:14px;line-height:1.5}.mt-xs{font-size:12px;line-height:1.45;color:#B8B2A7}
.mt-p{margin:0;font-size:15px;line-height:1.55;color:#D9D4CA}
.mt-h1{margin:0;font-family:var(--font-display),Georgia,serif;font-weight:500;font-size:40px;line-height:1.05}
.mt-h2{margin:0;font-family:var(--font-display),Georgia,serif;font-weight:500;font-size:34px;line-height:1.1}
.mt-host{width:72px;height:72px;border-radius:36px;background:#1A1A1D;border:1px solid #3A3A3F;display:flex;align-items:center;justify-content:center;font-family:var(--font-display),Georgia,serif;font-size:26px;color:#E9E4D9;flex:none}
.mt-card{background:#121214;border:1px solid #2A2A2E;border-radius:18px;padding:16px}
.mt-suggest{background:#17140E;border-color:#5A4A2A}
.mt-warn{background:#1A0F0D;border-color:#7A3B2E;color:#F2A38F}
.mt-err{background:#1A0F0D;border-color:#7A3B2E;color:#F4E4DF;font-size:14px}
.mt-chip{border:1px solid #3A3A3F;border-radius:999px;padding:7px 12px;font-size:13px;text-align:center;color:#D9D4CA}
.mt-opt{background:#121214;color:#F4F1EA;border:1px solid #2A2A2E;border-radius:14px;padding:14px;font:600 14px var(--font-body),sans-serif;text-align:left;min-height:48px;cursor:pointer}
.mt-opt.sm{padding:11px 6px;font-size:13px;min-height:44px}
.mt-opt.on{background:#E9E4D9;color:#0B0B0C;border-color:#E9E4D9;font-weight:700}
.mt-opt.ring{border:2px solid #E9E4D9}
.mt-opt.full,.mt-opt:disabled{background:#0B0B0C;color:#8E897F;border-style:dashed;cursor:not-allowed}
.mt-back{width:44px;height:44px;border-radius:22px;border:1px solid #2A2A2E;background:transparent;color:#F4F1EA;display:flex;align-items:center;justify-content:center;cursor:pointer}
.mt-cta{display:block;width:100%;text-align:center;background:#E9E4D9;color:#0B0B0C;border:0;border-radius:999px;padding:17px;font:700 13px var(--font-body),sans-serif;letter-spacing:2px;text-transform:uppercase;cursor:pointer}
.mt-cta.sm{padding:12px;letter-spacing:0;text-transform:none;font-size:13px}
.mt-cta:disabled{opacity:.4;cursor:not-allowed}
.mt-ghost{background:transparent;color:#F4F1EA;border:1px solid #3A3A3F;border-radius:999px;padding:12px;font:600 13px var(--font-body),sans-serif;cursor:pointer}
.mt-days{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
.mt-day{flex:none;width:62px;display:flex;flex-direction:column;align-items:center;gap:2px;background:#121214;color:#F4F1EA;border:1px solid #2A2A2E;border-radius:14px;padding:10px 4px;cursor:pointer;font-family:inherit}
.mt-day.on{background:#E9E4D9;color:#0B0B0C;border-color:#E9E4D9}
.mt-field{display:flex;flex-direction:column;gap:6px;min-width:0}.mt-field span{font-size:12px;color:#B8B2A7}
.mt-field input{background:#121214;color:#F4F1EA;border:1px solid #2A2A2E;border-radius:12px;padding:13px;font:500 16px var(--font-body),sans-serif;min-width:0;width:100%;box-sizing:border-box}
.mt-field.dark input{background:#0B0B0C}
.mt-field input::placeholder{color:#8E897F}
.mt-face{width:76px;height:76px;border-radius:38px;object-fit:cover;flex:none}
.mt-face-empty{border:1px dashed #4A4740;display:flex;align-items:center;justify-content:center;color:#B8B2A7}
.mt-pill-btn{align-self:flex-start;background:#E9E4D9;color:#0B0B0C;border-radius:999px;padding:9px 16px;font-weight:700;font-size:12px;cursor:pointer}
.mt-switch{width:52px;height:30px;border-radius:15px;background:#2A2A2E;border:0;position:relative;flex:none;cursor:pointer}
.mt-switch span{position:absolute;left:3px;top:3px;width:24px;height:24px;border-radius:12px;background:#8E897F;transition:left .15s}
.mt-switch.on{background:#E9E4D9}.mt-switch.on span{left:25px;background:#0B0B0C}
.mt-check{width:22px;height:22px;margin:0;accent-color:#E9E4D9;flex:none}
.mt-done{width:64px;height:64px;border-radius:32px;background:#E9E4D9;color:#0B0B0C;display:flex;align-items:center;justify-content:center;margin-top:32px}
`;
