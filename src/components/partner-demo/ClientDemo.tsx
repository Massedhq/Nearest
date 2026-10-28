"use client";
import { useState } from "react";
import { ACCENT, GOLD, IMG, C, Btn, Choice, Row, Check, Stars, Ico, Done, DemoShell } from "./ui";
import { DEMO, SERVICES, PORTFOLIO, VIDEOS, LINKS, MODEL_CALLS, PRODUCTS, mins } from "./data";

const TABS = ["Link page", "Book profile", "Booking", "Bundle", "Model Calls", "Shop", "Save to phone"];
const svcOf = (id: string) => SERVICES.find((s) => s.id === id)!;

/** What a partner's clients see: the link page, the booking profile, booking, Bundle my booking, Model Calls, save to phone. */
export function ClientDemo() {
  const [tab, setTab] = useState(0);
  const [preset, setPreset] = useState<string | null>(null);
  const [item, setItem] = useState<string | null>(null);
  const book = (svc?: string) => { setPreset(svc ?? null); setTab(2); };
  const shop = (id?: string) => { setItem(id ?? null); setTab(5); };
  return (
    <DemoShell title="Client view · demo" other={{ label: "Setup demo", href: "/partners/demo/setup" }} tabs={TABS} tab={tab} setTab={setTab}>
      {tab === 0 && <LinkPage go={setTab} book={book} shop={shop} />}
      {tab === 1 && <Profile book={book} />}
      {tab === 2 && <Booking preset={preset} />}
      {tab === 3 && <Bundle />}
      {tab === 4 && <ModelCalls />}
      {tab === 5 && <Shop start={item} />}
      {tab === 6 && <SavePhone />}
    </DemoShell>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "#16130E", border: `1px solid #3B3222`, borderRadius: 12, padding: "10px 12px", fontSize: 12, color: "#E9CF8E", lineHeight: 1.5 }}>{children}</div>;
}

function LinkPage({ go, book, shop }: { go: (n: number) => void; book: (s?: string) => void; shop: (id?: string) => void }) {
  return (
    <>
      <Note>This is the partner&apos;s link in bio. Tap anything — every button works.</Note>
      <section style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG("profile")} alt={DEMO.name} style={{ width: 184, height: 184, borderRadius: 20, objectFit: "cover", border: `2px solid ${ACCENT}` }} />
        <h1 style={{ ...C.h1, fontSize: 32 }}>{DEMO.name}</h1>
        <span style={{ fontSize: 14, color: "#D9D4CA" }}>{DEMO.headline}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}><Stars /><b>5.0</b><span style={{ color: "#B8B2A7", fontSize: 13 }}>(128 reviews)</span></span>
        <div style={{ display: "flex", gap: 10 }}>
          {([
            ["Instagram", <><rect key="a" x="4" y="4" width="16" height="16" rx="4.5" /><circle key="b" cx="12" cy="12" r="3.6" /><path key="c" d="M16.8 7.2v.01" /></>],
            ["TikTok", <><path key="a" d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5" /><path key="b" d="M14 4c.5 2.6 2.4 4.3 5 4.5" /></>],
            ["YouTube", <><rect key="a" x="3.5" y="6" width="17" height="12" rx="3.5" /><path key="b" d="m10.5 9.5 4 2.5-4 2.5z" /></>],
          ] as const).map(([label, d]) => <span key={label} role="img" aria-label={label} style={{ width: 40, height: 40, borderRadius: 20, border: "1px solid #2A2A2E", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico size={17} d={d} /></span>)}
        </div>
      </section>
      <button type="button" onClick={() => go(1)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: ACCENT, color: "#0B0B0C", border: "none", borderRadius: 18, padding: 18, cursor: "pointer", font: "inherit" }}>
        <span style={{ fontWeight: 800, fontSize: 14, letterSpacing: 2, textTransform: "uppercase" }}>Book an appointment</span>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Booked and paid securely on Nearest</span>
      </button>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={C.eyebrow}>Top services</span>
        {["brow", "lift", "glam", "gelx"].map((id) => { const s = svcOf(id); return (
          <button key={id} type="button" onClick={() => book(id)} style={C.tile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG(s.img)} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flex: "none" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>${s.price} · {mins(s.mins)}</span></span>
            <span style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>Book</span>
          </button>
        ); })}
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
        <button type="button" onClick={() => go(4)} style={{ display: "flex", flexDirection: "column", gap: 6, background: "#E9E4D9", color: "#0B0B0C", border: "none", borderRadius: 16, padding: 14, textAlign: "left", cursor: "pointer", font: "inherit" }}>
          <span style={{ fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, lineHeight: 1.05 }}>Model Calls</span><span style={{ fontSize: 12, fontWeight: 700 }}>2 open · from $40</span>
        </button>
        <button type="button" onClick={() => go(3)} style={{ display: "flex", flexDirection: "column", gap: 6, background: "#121214", color: "#F4F1EA", border: `1px solid ${ACCENT}`, borderRadius: 16, padding: 14, textAlign: "left", cursor: "pointer", font: "inherit" }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>Bundle my booking</span><span style={{ fontSize: 12, color: ACCENT, fontWeight: 800 }}>Save {DEMO.bundlePct}% on 2+ services</span>
        </button>
      </div>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={C.eyebrow}>Learn with me</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>
          {VIDEOS.map((v) => (
            <div key={v.title} style={{ position: "relative", aspectRatio: "9 / 16", borderRadius: 12, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG(v.img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,.8) 100%)" }} />
              <span style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 6px", fontSize: 10, fontWeight: 700 }}>{v.len}</span>
              <span style={{ position: "absolute", left: 8, right: 8, bottom: 8, fontSize: 11, fontWeight: 800, lineHeight: 1.25 }}>{v.title}</span>
            </div>
          ))}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={C.eyebrow}>Shop</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {PRODUCTS.map((p) => (
            <button key={p.id} type="button" onClick={() => shop(p.id)} style={{ display: "flex", flexDirection: "column", gap: 6, background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, overflow: "hidden", color: "#F4F1EA", padding: 0, textAlign: "left", cursor: "pointer", font: "inherit" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG(p.img)} alt="" style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", display: "block" }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px 10px" }}><span style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.3 }}>{p.title}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>${p.price} · {p.kind === "digital" ? "Instant download" : "Ships to you"}</span></span>
            </button>
          ))}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={C.eyebrow}>Shop &amp; links</span>
        {LINKS.map((l) => (
          <div key={l.title} style={C.tile}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG(l.img)} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flex: "none" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{l.title}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>{l.note}</span></span>
            <Ico size={16} d={<path d="M7 17 17 7M9 7h8v8" />} />
          </div>
        ))}
      </section>
      <Btn kind="outline" onClick={() => go(6)}>Save Ava to my phone</Btn>
      <a href="/partners" style={{ display: "flex", alignItems: "center", gap: 12, border: `1px solid ${ACCENT}`, borderRadius: 16, padding: 14, textDecoration: "none", color: "#F4F1EA" }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}><span style={{ fontSize: 14, fontWeight: 800, color: ACCENT }}>Nearest Partner</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>Want a page like this? Become a partner</span></span>
        <Ico size={16} d={<path d="m9 5 7 7-7 7" />} />
      </a>
    </>
  );
}

function Profile({ book }: { book: (s?: string) => void }) {
  const [view, setView] = useState<number | null>(null);
  const cats = [...new Set(SERVICES.map((s) => s.cat))];
  if (view !== null) {
    const p = PORTFOLIO[view]; const s = svcOf(p.svc);
    return (
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button type="button" onClick={() => setView(null)} style={{ background: "transparent", border: "1px solid #2A2A2E", color: "#F4F1EA", borderRadius: 999, padding: "8px 14px", font: "700 12px var(--font-body), sans-serif", cursor: "pointer" }}>Close</button>
          <span style={{ fontSize: 13, color: "#B8B2A7", fontWeight: 700 }}>{view + 1} of {PORTFOLIO.length}</span>
        </div>
        <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", aspectRatio: "4 / 5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG(p.img)} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          {(["prev", "next"] as const).map((d) => (
            <button key={d} type="button" aria-label={d === "prev" ? "Previous photo" : "Next photo"} onClick={() => setView((view + (d === "prev" ? PORTFOLIO.length - 1 : 1)) % PORTFOLIO.length)} style={{ position: "absolute", top: "50%", [d === "prev" ? "left" : "right"]: 10, transform: "translateY(-50%)", width: 40, height: 40, borderRadius: 20, border: "none", background: "rgba(0,0,0,.55)", color: "#FFF", cursor: "pointer" }}>{d === "prev" ? "‹" : "›"}</button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}><span style={C.eyebrow}>This look</span><span style={{ fontSize: 18, fontWeight: 800 }}>{s.name}</span><span style={{ fontSize: 13, color: "#D9D4CA" }}>${s.price} · {mins(s.mins)}</span></div>
        <Btn onClick={() => book(s.id)}>Book this look</Btn>
      </>
    );
  }
  return (
    <>
      <section style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG("profile")} alt="" style={{ width: 88, height: 88, borderRadius: 16, objectFit: "cover", flex: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ ...C.h1, fontSize: 26 }}>{DEMO.name}</span>
          <span style={{ fontSize: 13, color: "#D9D4CA" }}>{DEMO.business}</span>
          <span style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><span style={{ color: GOLD }}>★</span><b>5.0</b><span style={{ color: "#B8B2A7" }}>128 verified reviews</span></span>
        </div>
      </section>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Licensed", `4.2 mi · ${DEMO.city}`, "English · Spanish", "ASL — Basic"].map((t) => <span key={t} style={{ border: "1px solid #3A3A3F", borderRadius: 999, padding: "6px 11px", fontSize: 12 }}>{t}</span>)}
      </div>
      <div style={{ ...C.card, gap: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>Come to my studio or I travel</span>
        <span style={C.muted}>Travels up to {DEMO.travelMiles} miles · ${DEMO.travelFee} travel fee, added only when she comes to you</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}><span style={{ background: "#2B2410", color: "#E9CF8E", borderRadius: 999, padding: "5px 10px", fontWeight: 800, fontSize: 12 }}>Available today</span><span style={{ color: "#D9D4CA" }}>1:00 PM · 2:30 PM · 5:30 PM</span></div>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={C.eyebrow}>Portfolio · tap a photo</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 4 }}>
          {PORTFOLIO.map((p, i) => (
            <button key={i} type="button" onClick={() => setView(i)} aria-label={`Open ${svcOf(p.svc).name} photo`} style={{ position: "relative", aspectRatio: "1 / 1", borderRadius: 10, overflow: "hidden", border: "none", padding: 0, cursor: "pointer" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG(p.img)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {p.video && <span style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 5px", fontSize: 10, fontWeight: 800, color: "#FFF" }}>0:12</span>}
            </button>
          ))}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={C.eyebrow}>Services</span>
        {cats.map((cat) => (
          <div key={cat} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 800 }}>{cat}</span>
            {SERVICES.filter((s) => s.cat === cat).map((s) => (
              <div key={s.id} style={{ ...C.tile, cursor: "default" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={IMG(s.img)} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flex: "none" }} />
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}</span>
                  <span style={{ fontSize: 12, color: "#B8B2A7" }}>${s.price} · {mins(s.mins)}{s.request ? " · Booking request" : ""}</span>
                  {s.adds.length > 0 && <span style={{ fontSize: 11, color: "#8E897F" }}>Add-ons: {s.adds.map((a) => `${a[1]} +$${a[2]}`).join(" · ")}</span>}
                </span>
                <button type="button" onClick={() => book(s.id)} style={{ flex: "none", background: ACCENT, color: "#0B0B0C", border: "none", borderRadius: 999, padding: "9px 14px", font: "800 12px var(--font-body), sans-serif", cursor: "pointer" }}>Book</button>
              </div>
            ))}
          </div>
        ))}
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={C.eyebrow}>Verified booking reviews</span>
        <div style={C.card}>
          <div style={{ display: "flex", justifyContent: "space-between" }}><b style={{ fontSize: 14 }}>Jasmine R.</b><span style={{ color: GOLD, fontSize: 13, fontWeight: 800 }}>5.0 · Oct 18</span></div>
          <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>My brows have never looked this full. She explained everything and the studio was spotless.</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG("p-eyesq")} alt="The client's finished look" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 12 }} />
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={C.eyebrow}>Hours</span>
        <div style={{ ...C.card, gap: 7, fontSize: 13 }}>
          {[["Tue – Fri", "10:00 AM – 7:00 PM"], ["Saturday", "9:00 AM – 4:00 PM"], ["After school (Tue, Thu)", "3:30 – 7:00 PM"], ["Sun – Mon", "Closed"]].map(([d, h]) => <div key={d} style={{ display: "flex", justifyContent: "space-between" }}><span>{d}</span><span>{h}</span></div>)}
        </div>
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={C.eyebrow}>About</span>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#D9D4CA" }}>14 years in beauty. I own a private studio in Corona and teach pros how to get booked and show up online.</p>
      </section>
      <Btn onClick={() => book()}>Book now</Btn>
    </>
  );
}

function Booking({ preset }: { preset: string | null }) {
  const [step, setStep] = useState(1);
  const [svc, setSvc] = useState(preset ?? "brow");
  const [adds, setAdds] = useState<string[]>([]);
  const [home, setHome] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const s = svcOf(svc);
  const addCost = s.adds.filter((a) => adds.includes(a[0])).reduce((n, a) => n + a[2], 0);
  const total = s.price + addCost + (home ? DEMO.travelFee : 0);
  const days = [["Tue", "3"], ["Wed", "4"], ["Thu", "5"], ["Fri", "6"], ["Sat", "7"]];
  const times = home ? ["10:00 AM", "1:00 PM", "4:30 PM"] : ["10:00 AM", "11:30 AM", "1:00 PM", "2:30 PM", "4:00 PM", "5:30 PM"];
  const ok = step === 1 || step === 2 || (step === 3 && day && time) || (step === 4 && agree);
  const dayLabel = day ? `${days.find((d) => d[1] === day)![0]}, Nov ${day}` : "";
  if (step === 5) return (
    <Done title={s.request ? "Request sent." : "You're booked."} text={s.request ? "Ava answers within 24 hours. If she accepts, you get an email to pay and confirm — nothing is charged until then." : `${s.name} with Ava, ${dayLabel} at ${time} — paid $${total}. A confirmation is on its way to your email.`}>
      <div style={{ ...C.card, fontSize: 13, color: "#D9D4CA", lineHeight: 1.6 }}>On the day: the address unlocks, you check in when you arrive, and you can message Ava in the app. Phone numbers are never shared.</div>
      <Btn kind="ghost" onClick={() => { setStep(1); setDay(null); setTime(null); setAgree(false); }}>Book another</Btn>
    </Done>
  );
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, color: "#B8B2A7", fontWeight: 700 }}>Step {step} of 4 · {["Service", "Where", "Day & time", s.request ? "Request" : "Pay"][step - 1]}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>{[1, 2, 3, 4].map((n) => <span key={n} style={{ height: 4, borderRadius: 2, background: n <= step ? ACCENT : "#2A2A2E" }} />)}</div>
      </div>
      {step === 1 && (
        <>
          <h2 style={C.h1}>Pick a service</h2>
          {SERVICES.map((x) => (
            <Row key={x.id} on={svc === x.id} onClick={() => { setSvc(x.id); setAdds([]); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG(x.img)} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flex: "none" }} />
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{x.name}</span><span style={{ fontSize: 12, opacity: 0.75 }}>{mins(x.mins)}{x.request ? " · Booking request" : ""}</span></span>
              <b>${x.price}</b>
            </Row>
          ))}
          {s.adds.length > 0 && (
            <>
              <span style={C.eyebrow}>Add-ons</span>
              {s.adds.map(([id, name, p]) => { const on = adds.includes(id); return <Row key={id} on={on} onClick={() => setAdds(on ? adds.filter((a) => a !== id) : [...adds, id])}><Check on={on} /><span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{name}</span><b style={{ fontSize: 13 }}>+${p}</b></Row>; })}
            </>
          )}
        </>
      )}
      {step === 2 && (
        <>
          <h2 style={C.h1}>Where?</h2>
          <Row on={!home} onClick={() => { setHome(false); setTime(null); }}><span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 15, fontWeight: 800 }}>At Ava&apos;s studio</span><span style={{ fontSize: 12, opacity: 0.8 }}>{DEMO.city} · 4.2 mi · the exact address shows on the day of your appointment</span></span><b>$0</b></Row>
          <Row on={home} onClick={() => { setHome(true); setTime(null); }}><span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 15, fontWeight: 800 }}>Ava comes to me</span><span style={{ fontSize: 12, opacity: 0.8 }}>Within {DEMO.travelMiles} miles of her studio</span></span><b>+${DEMO.travelFee}</b></Row>
          {home && (
            <>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>Your address<input defaultValue="2150 Main St, Corona, CA 92882" style={C.input} /></label>
              <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>6.1 mi from Ava · inside her travel area</span>
              <span style={C.muted}>The travel fee is set by Ava and only added when she comes to you. Your address is shared only with her.</span>
            </>
          )}
        </>
      )}
      {step === 3 && (
        <>
          <h2 style={C.h1}>Pick a day &amp; time</h2>
          <span style={C.muted}>{s.name} · {mins(s.mins + (adds.includes("art") ? 20 : 0))}</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>{days.map(([dow, n]) => <Choice key={n} on={day === n} onClick={() => { setDay(n); setTime(null); }}><span style={{ display: "block", fontSize: 11, opacity: 0.8 }}>{dow}</span><span style={{ fontSize: 17, fontWeight: 800 }}>{n}</span></Choice>)}</div>
          {day && <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>{times.map((t) => <Choice key={t} on={time === t} onClick={() => setTime(t)}>{t}</Choice>)}</div>}
          <span style={C.muted}>Only times Ava is actually open show here — her hours, breaks and other bookings are already taken out.</span>
        </>
      )}
      {step === 4 && (
        <>
          <h2 style={C.h1}>{s.request ? "Review your request" : "Review & pay"}</h2>
          <div style={{ ...C.card, fontSize: 14, gap: 9 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><span>{s.name}</span><span>${s.price}</span></div>
            {s.adds.filter((a) => adds.includes(a[0])).map((a) => <div key={a[0]} style={{ display: "flex", justifyContent: "space-between", color: "#D9D4CA" }}><span>+ {a[1]}</span><span>${a[2]}</span></div>)}
            {home && <div style={{ display: "flex", justifyContent: "space-between", color: "#D9D4CA" }}><span>Travel fee</span><span>${DEMO.travelFee}</span></div>}
            <div style={{ height: 1, background: "#2A2A2E" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16 }}><span>Total</span><span>${total}</span></div>
            <span style={C.muted}>{dayLabel} at {time} · {home ? "at your address" : "at Ava's studio"}</span>
          </div>
          {s.request && <Note>Ava reviews this service before it&apos;s booked. She has 24 hours to accept, and you pay only after she says yes.</Note>}
          {!s.request && <><span style={C.eyebrow}>Pay with</span><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><Choice on onClick={() => {}}>Apple Pay</Choice><Choice on={false} onClick={() => {}}>Card</Choice></div></>}
          <span style={C.muted}>Your payment is held safely by Nearest and released to Ava after your appointment. Cancel 24+ hours ahead for full Nearest credit; late cancels and no-shows keep the deposit.</span>
          <button type="button" onClick={() => setAgree(!agree)} style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "transparent", border: "none", color: "#F4F1EA", padding: 0, textAlign: "left", font: "500 13px var(--font-body), sans-serif", cursor: "pointer" }}><Check on={agree} />I agree to the booking and cancellation terms.</button>
        </>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 8 }}>
        {step > 1 && <Btn kind="ghost" onClick={() => setStep(step - 1)} style={{ flex: "0 0 30%" }}>Back</Btn>}
        <Btn disabled={!ok} onClick={() => setStep(step + 1)}>{step < 4 ? "Continue" : s.request ? "Send booking request" : `Pay $${total} and book`}</Btn>
      </div>
    </>
  );
}

function Bundle() {
  const [picked, setPicked] = useState(["brow", "wax"]);
  const [budget, setBudget] = useState(150);
  const [done, setDone] = useState(false);
  const items = ["brow", "lift", "glam", "wax", "gelx"].map(svcOf);
  const sel = items.filter((i) => picked.includes(i.id));
  const sub = sel.reduce((n, i) => n + i.price, 0);
  const off = sel.length >= 2 ? Math.round(sub * DEMO.bundlePct / 100) : 0;
  const total = sub - off;
  const ok = sel.length >= 2 && total <= budget;
  if (done) return <Done title="Your bundle is booked." text={`${sel.map((i) => i.name).join(" + ")}, back to back on Fri, Nov 6 at 11:00 AM — paid $${total} (you saved $${off}).`} />;
  return (
    <>
      <h2 style={C.h1}>Bundle my booking</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Getting ready for an event? Pick everything you want, set a budget, and book it all in one visit — {DEMO.bundlePct}% off automatically.</span>
      <span style={C.eyebrow}>What do you need?</span>
      {items.map((i) => { const on = picked.includes(i.id); return <Row key={i.id} on={on} onClick={() => setPicked(on ? picked.filter((x) => x !== i.id) : [...picked, i.id])}><Check on={on} /><span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{i.name}</span><span style={{ fontSize: 12, opacity: 0.75 }}>{mins(i.mins)}</span></span><b>${i.price}</b></Row>; })}
      <span style={C.eyebrow}>Your budget</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>{[100, 150, 200, 250].map((b) => <Choice key={b} on={budget === b} onClick={() => setBudget(b)}>${b}</Choice>)}</div>
      <div style={{ ...C.card, border: `1px solid ${ok ? ACCENT : "#7A3B2E"}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}><span>Services</span><span>${sub}</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: ACCENT, fontWeight: 800 }}><span>Bundle discount ({DEMO.bundlePct}%)</span><span>−${off}</span></div>
        <div style={{ height: 1, background: "#2A2A2E" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}><b>Bundle total</b><b style={{ fontSize: 20 }}>${total}</b></div>
        <span style={{ fontSize: 12 }}>{sel.length < 2 ? `Pick at least 2 services to unlock ${DEMO.bundlePct}% off` : total <= budget ? `You save $${off} · fits your budget` : "Over your budget"}</span>
      </div>
      <Btn disabled={!ok} onClick={() => setDone(true)}>Pay ${total} and book</Btn>
    </>
  );
}

function ModelCalls() {
  const [pick, setPick] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [cid, time] = (pick ?? "|").split("|");
  const call = MODEL_CALLS.find((c) => c.id === cid);
  if (done && call) return <Done title="You're booked." text={`${call.name}, ${call.date} at ${time} · $${call.price} — paid. A confirmation is on its way to your email.`}><Btn kind="ghost" onClick={() => { setDone(false); setPick(null); }}>See other Model Calls</Btn></Done>;
  return (
    <>
      <h2 style={C.h1}>Model Calls</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Ava is practicing new techniques and filming for her classes. You get the look at a lower price.</span>
      {MODEL_CALLS.map((c) => (
        <div key={c.id} style={{ background: "#121214", border: "1px solid #2A2A2E", borderRadius: 18, overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG(c.img)} alt="" style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }} />
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}><b>{c.name}</b><span><b>${c.price}</b> <span style={{ fontSize: 12, color: "#8E897F", textDecoration: "line-through" }}>${c.was}</span></span></div>
            <span style={{ fontSize: 13, color: "#D9D4CA" }}>{c.about}</span>
            <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>{c.date} · {c.left}</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6 }}>{c.times.map((t) => <Choice key={t} on={pick === `${c.id}|${t}`} onClick={() => setPick(`${c.id}|${t}`)}>{t}</Choice>)}</div>
          </div>
        </div>
      ))}
      <Btn disabled={!call} onClick={() => setDone(true)}>{call ? `Pay $${call.price} and book` : "Pick a time"}</Btn>
    </>
  );
}

function Shop({ start }: { start: string | null }) {
  const [id, setId] = useState<string | null>(start);
  const [qty, setQty] = useState(1);
  const [step, setStep] = useState<"view" | "pay" | "done">("view");
  const [got, setGot] = useState(false);
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) return (
    <>
      <h2 style={C.h1}>Ava&apos;s shop</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Digital downloads arrive the moment you pay. Products ship to your door. No account needed.</span>
      {PRODUCTS.map((x) => (
        <button key={x.id} type="button" onClick={() => { setId(x.id); setQty(1); setStep("view"); setGot(false); }} style={C.tile}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={IMG(x.img)} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: "cover", flex: "none" }} />
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{x.title}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>{x.kind === "digital" ? "Instant download" : "Ships to you"}</span></span>
          <b>${x.price}</b>
        </button>
      ))}
    </>
  );
  const digital = p.kind === "digital";
  const total = p.price * qty + (digital ? 0 : p.shipping ?? 0);
  const back = <button type="button" onClick={() => setId(null)} style={{ alignSelf: "flex-start", background: "transparent", border: "1px solid #2A2A2E", color: "#F4F1EA", borderRadius: 999, padding: "8px 14px", font: "700 12px var(--font-body), sans-serif", cursor: "pointer" }}>‹ All products</button>;
  if (step === "done") return digital ? (
    <Done title="Your download is ready." text={`${p.title} — $${total} paid. We also emailed you the link so you can download it again later.`}>
      <Btn onClick={() => setGot(true)}>{got ? "Downloaded ✓ — check your Files" : "Download now"}</Btn>
      <span style={C.muted}>{p.file}. Your link works 10 times for a year.</span>
      {back}
    </Done>
  ) : (
    <Done title="Your order is in." text={`${qty} × ${p.title} — $${total} paid. Ava ships it to you, and we'll email you the tracking number when it's on the way.`}>{back}</Done>
  );
  if (step === "pay") return (
    <>
      {back}
      <h2 style={C.h1}>Checkout</h2>
      <div style={{ ...C.card, fontSize: 14, gap: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}><span>{qty > 1 ? `${qty} × ` : ""}{p.title}</span><span>${p.price * qty}</span></div>
        {!digital && <div style={{ display: "flex", justifyContent: "space-between", color: "#D9D4CA" }}><span>Shipping</span><span>{p.shipping ? `$${p.shipping}` : "Free"}</span></div>}
        <div style={{ height: 1, background: "#2A2A2E" }} />
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: 16 }}><span>Total</span><span>${total}</span></div>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>Email for your receipt{digital ? " and download link" : ""}<input defaultValue="jasmine@email.com" style={C.input} /></label>
      {!digital && <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>Ship to<input defaultValue="Jasmine R., 2150 Main St, Corona, CA 92882" style={C.input} /></label>}
      <span style={C.eyebrow}>Pay with</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><Choice on onClick={() => {}}>Apple Pay</Choice><Choice on={false} onClick={() => {}}>Card</Choice></div>
      <Btn onClick={() => setStep("done")}>Pay ${total}</Btn>
      <span style={{ ...C.muted, textAlign: "center" }}>Secure checkout on Nearest. No account needed.</span>
    </>
  );
  return (
    <>
      {back}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={IMG(p.img)} alt={p.title} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 18 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ ...C.eyebrow, color: GOLD }}>{digital ? "Digital download" : "Ships to you"}</span>
        <h2 style={C.h1}>{p.title}</h2>
        <b style={{ fontSize: 20 }}>${p.price}</b>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#D9D4CA" }}>{p.desc}</p>
      {digital ? <span style={C.muted}>{p.file} — download it right after you pay.</span> : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>Quantity</span>
            <button type="button" aria-label="Fewer" onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #2A2A2E", background: "#121214", color: "#F4F1EA", cursor: "pointer" }}>−</button>
            <b style={{ width: 28, textAlign: "center" }}>{qty}</b>
            <button type="button" aria-label="More" onClick={() => setQty(Math.min(10, qty + 1))} style={{ width: 40, height: 40, borderRadius: 10, border: "1px solid #2A2A2E", background: "#121214", color: "#F4F1EA", cursor: "pointer" }}>+</button>
          </div>
          <span style={C.muted}>{p.shipping ? `Shipping $${p.shipping}` : "Free shipping"} · {p.left} left</span>
        </>
      )}
      <Btn onClick={() => setStep("pay")}>{digital ? `Buy & download · $${total}` : `Buy now · $${total}`}</Btn>
    </>
  );
}

function SavePhone() {
  const [os, setOs] = useState<"ios" | "android">("ios");
  return (
    <>
      <h2 style={C.h1}>Save Ava to your phone</h2>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Clients can keep a partner&apos;s page on their home screen like an app. It opens straight to Ava, with her photo as the icon — no app store needed.</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}><Choice on={os === "ios"} onClick={() => setOs("ios")}>iPhone</Choice><Choice on={os === "android"} onClick={() => setOs("android")}>Android</Choice></div>
      <div style={C.card}>
        <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5 }}>
          {os === "ios"
            ? <><li>Open Ava&apos;s link in <b>Safari</b> and tap <b>Save Ava to my phone</b>.</li><li>Tap the <b>Share</b> button (the square with an arrow).</li><li>Tap <b>Add to Home Screen</b>, then <b>Add</b>.</li></>
            : <><li>Open Ava&apos;s link in <b>Chrome</b> and tap <b>Save Ava to my phone</b>.</li><li>Tap <b>Install</b> when Chrome asks (or ⋮ → <b>Install app</b>).</li><li>Done — it&apos;s on your home screen.</li></>}
        </ol>
        <span style={C.muted}>Opened the link inside Instagram or TikTok? Tap ⋯ → Open in browser first.</span>
      </div>
      <span style={C.eyebrow}>On the home screen</span>
      <div style={{ borderRadius: 24, padding: 20, background: "linear-gradient(160deg, #3A2B2A, #121214)", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16, justifyItems: "center" }}>
        {["Photos", "Maps", "Ava", "Music", "Notes", "Mail", "Clock", "Camera"].map((n) => (
          <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            {n === "Ava"
              ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={IMG("profile")} alt="" style={{ width: 54, height: 54, borderRadius: 14, objectFit: "cover", boxShadow: `0 0 0 2px ${ACCENT}` }} />
              : <span style={{ width: 54, height: 54, borderRadius: 14, background: "rgba(255,255,255,.12)" }} />}
            <span style={{ fontSize: 10, color: "#F4F1EA" }}>{n}</span>
          </div>
        ))}
      </div>
    </>
  );
}
