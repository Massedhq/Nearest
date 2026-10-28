"use client";
import { useState } from "react";
import { ACCENT, GOLD, IMG, C, Btn, Choice, Check, Toggle, Done, DemoShell } from "./ui";
import { DEMO, SERVICES, PORTFOLIO, mins } from "./data";

const TABS = ["Apply", "Sign in", "Your page", "Services", "Portfolio", "Travel & hours", "Share"];

/** How a partner sets up: apply, sign in, page & links, services, portfolio, travel & hours, then share and save. */
export function SetupDemo() {
  const [tab, setTab] = useState(0);
  return (
    <DemoShell title="Setup · demo" other={{ label: "Client demo", href: "/partners/demo" }} tabs={TABS} tab={tab} setTab={setTab}>
      {tab === 0 && <Apply next={() => setTab(1)} />}
      {tab === 1 && <SignIn next={() => setTab(2)} />}
      {tab === 2 && <YourPage />}
      {tab === 3 && <Services />}
      {tab === 4 && <Portfolio />}
      {tab === 5 && <TravelHours />}
      {tab === 6 && <Share />}
    </DemoShell>
  );
}

function Head({ step, title, text }: { step: string; title: string; text: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...C.eyebrow, color: ACCENT }}>{step}</span>
      <h1 style={C.h1}>{title}</h1>
      <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}
const Field = ({ label, value, ph }: { label: string; value?: string; ph?: string }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>{label}<input defaultValue={value} placeholder={ph} style={C.input} /></label>
);
function Saved({ on }: { on: boolean }) {
  return on ? <span role="status" style={{ fontSize: 13, color: "#8FE0A8", fontWeight: 700, textAlign: "center" }}>Saved — your page is updated</span> : null;
}

function Apply({ next }: { next: () => void }) {
  const [sent, setSent] = useState(false);
  if (sent) return (
    <Done title="You're approved." text="In real life we review every application and email you. Then you sign in to the Nearest pro app with the same email and your partner page is ready to fill in.">
      <Btn onClick={next}>Next: sign in</Btn>
    </Done>
  );
  return (
    <>
      <Head step="Step 1" title="Apply to become a partner" text="No account needed to apply. Nearest reviews it and emails you." />
      <Field label="Your name" value={DEMO.name} />
      <Field label="Email" value="ava@avamonroebeauty.com" />
      <Field label="Instagram" value="@avamonroebeauty" />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8 }}><Field label="City" value="Corona" /><Field label="State" value="CA" /></div>
      <Field label="Your specialty" value="Brows, lashes & glam" />
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>What do you teach or share?<textarea defaultValue="I teach pros how to get booked and show up online." rows={3} style={{ ...C.input, resize: "none", lineHeight: 1.5 }} /></label>
      <Btn onClick={() => setSent(true)}>Send my application</Btn>
    </>
  );
}

function SignIn({ next }: { next: () => void }) {
  const [code, setCode] = useState(false);
  return (
    <>
      <Head step="Step 2" title={code ? "Check your email" : "Sign in to the pro app"} text={code ? "Enter the 6-digit code we just sent you." : "Same Nearest sign-in professionals use at usenearest.com/pro. Codes come by email — never by text."} />
      {!code ? (
        <>
          <Field label="Email" value="ava@avamonroebeauty.com" />
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>Password<input type="password" defaultValue="password123" style={C.input} /></label>
          <button type="button" onClick={() => setCode(true)} style={{ background: "transparent", border: "none", color: "#B8B2A7", textAlign: "left", padding: 0, font: "600 13px var(--font-body), sans-serif", textDecoration: "underline", cursor: "pointer" }}>Email me a code instead</button>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 6 }}>{["4", "8", "1", "9", "0", "3"].map((d, i) => <span key={i} style={{ height: 54, borderRadius: 12, background: "#121214", border: `1px solid ${ACCENT}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>{d}</span>)}</div>
          <button type="button" onClick={() => setCode(false)} style={{ background: "transparent", border: "none", color: "#B8B2A7", textAlign: "left", padding: 0, font: "600 13px var(--font-body), sans-serif", textDecoration: "underline", cursor: "pointer" }}>Use my password instead</button>
        </>
      )}
      <Btn onClick={next}>Sign in</Btn>
      <div style={C.card}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>First time?</span>
        <span style={C.muted}>New professionals set up their profile in the pro app first — photo, services, hours, ID check — then open Business → Partner page. That&apos;s where everything in the next steps lives.</span>
      </div>
    </>
  );
}

function YourPage() {
  const [links, setLinks] = useState(["Shop my brow stain line", "Amazon must-haves", "Get Booked Academy"]);
  const [videos, setVideos] = useState(["How to get fully booked in 2027", "Fuller brows in 60 seconds", "My 3-step soft glam lip"]);
  const [published, setPublished] = useState(true);
  const [saved, setSaved] = useState(false);
  const move = (i: number) => { if (i === 0) return; const a = [...links]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; setLinks(a); setSaved(false); };
  return (
    <>
      <Head step="Step 3" title="Your page & links" text="Your photo, a short headline, your social links, your shop links and your videos." />
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG("profile")} alt="Your photo" style={{ width: 96, height: 96, borderRadius: 16, objectFit: "cover" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}><Btn style={{ padding: 10, fontSize: 11 }}>Change photo</Btn><Btn kind="ghost" style={{ padding: 10, fontSize: 11 }}>Change logo</Btn></div>
      </div>
      <Field label="Headline (under your name)" value={DEMO.headline} />
      <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 700 }}>Your link<span style={{ ...C.input, display: "block" }}><span style={{ color: "#8E897F" }}>usenearest.com/link/</span>{DEMO.slug}</span></label>
      <span style={C.eyebrow}>Social profiles</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}><Field label="Instagram" value="@avamonroebeauty" /><Field label="TikTok" value="@avamonroe" /><Field label="Facebook" value="avamonroebeauty" /><Field label="Pinterest" value="avamonroe" /></div>
      <span style={C.eyebrow}>Shop &amp; links · ↑ to reorder</span>
      {links.map((l, i) => (
        <div key={l} style={{ ...C.tile, cursor: "default" }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{l}</span>
          <button type="button" aria-label="Move up" onClick={() => move(i)} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #2A2A2E", background: "transparent", color: "#F4F1EA", cursor: "pointer" }}>↑</button>
          <button type="button" aria-label="Remove" onClick={() => { setLinks(links.filter((x) => x !== l)); setSaved(false); }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #5A2A22", background: "transparent", color: "#F2A99A", cursor: "pointer" }}>×</button>
        </div>
      ))}
      <Btn kind="outline" onClick={() => { setLinks([...links, `New link ${links.length + 1}`]); setSaved(false); }}>+ Add link</Btn>
      <span style={C.eyebrow}>Learn with me videos</span>
      {videos.map((v) => (
        <div key={v} style={{ ...C.tile, cursor: "default" }}>
          <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 13, fontWeight: 800 }}>{v}</span><span style={{ fontSize: 11, color: "#8E897F" }}>YouTube link</span></span>
          <button type="button" aria-label="Remove video" onClick={() => { setVideos(videos.filter((x) => x !== v)); setSaved(false); }} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #5A2A22", background: "transparent", color: "#F2A99A", cursor: "pointer" }}>×</button>
        </div>
      ))}
      <Btn kind="outline" onClick={() => { setVideos([...videos, `New video ${videos.length + 1}`]); setSaved(false); }}>+ Paste a YouTube, TikTok or Instagram link</Btn>
      <div style={{ ...C.card, flexDirection: "row", alignItems: "center" }}>
        <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}><span style={{ fontSize: 14, fontWeight: 800 }}>Page is live</span><span style={C.muted}>{published ? "Anyone with your link can see your page." : "Hidden — only you can see it."}</span></span>
        <Toggle on={published} onClick={() => { setPublished(!published); setSaved(false); }} label="Page is live" />
      </div>
      <Btn onClick={() => setSaved(true)}>Save</Btn>
      <Saved on={saved} />
    </>
  );
}

function Services() {
  const [pct, setPct] = useState(DEMO.bundlePct);
  const [open, setOpen] = useState<string | null>("brow");
  const [price, setPrice] = useState<Record<string, number>>(Object.fromEntries(SERVICES.map((s) => [s.id, s.price - 5])));
  const [req, setReq] = useState<Record<string, boolean>>(Object.fromEntries(SERVICES.map((s) => [s.id, Boolean(s.request)])));
  const [top, setTop] = useState(["brow", "lift", "glam", "gelx"]);
  const [saved, setSaved] = useState(false);
  return (
    <>
      <Head step="Step 4" title="Services & prices" text="You enter your price. Pick the 4 that show on your page, and how each one is booked." />
      <div style={{ ...C.card, border: `1px solid ${ACCENT}` }}>
        <span style={{ fontSize: 14, fontWeight: 800 }}>Bundle my booking discount</span>
        <span style={C.muted}>Taken off automatically when a client books 2 or more of your services together.</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>{[0, 5, 10, 15, 20].map((p) => <Choice key={p} on={pct === p} onClick={() => { setPct(p); setSaved(false); }}>{p ? `${p}%` : "Off"}</Choice>)}</div>
      </div>
      {SERVICES.map((s) => {
        const isOpen = open === s.id; const isTop = top.includes(s.id);
        return (
          <div key={s.id} style={{ background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, overflow: "hidden" }}>
            <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-expanded={isOpen} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", color: "#F4F1EA", padding: "12px 14px", textAlign: "left", font: "inherit", cursor: "pointer" }}>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{s.name}{isTop ? " ★" : ""}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>{s.cat} · {mins(s.mins)} · {req[s.id] ? "Booking request" : "Instant booking"}</span></span>
              <b>${price[s.id]}</b>
            </button>
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "10px 14px 14px", borderTop: "1px solid #2A2A2E" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Your price</span>
                  <button type="button" aria-label="Lower price" onClick={() => { setPrice({ ...price, [s.id]: Math.max(5, price[s.id] - 5) }); setSaved(false); }} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #2A2A2E", background: "#0B0B0C", color: "#F4F1EA", cursor: "pointer" }}>−</button>
                  <b style={{ width: 54, textAlign: "center", fontSize: 16 }}>${price[s.id]}</b>
                  <button type="button" aria-label="Raise price" onClick={() => { setPrice({ ...price, [s.id]: Math.min(145, price[s.id] + 5) }); setSaved(false); }} style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #2A2A2E", background: "#0B0B0C", color: "#F4F1EA", cursor: "pointer" }}>+</button>
                </div>
                <span style={{ fontSize: 12, color: GOLD }}>Clients see ${price[s.id] + 5} — that includes the $5 booking fee.</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>How clients book this</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <Choice on={!req[s.id]} onClick={() => { setReq({ ...req, [s.id]: false }); setSaved(false); }}>Instant booking</Choice>
                  <Choice on={req[s.id]} onClick={() => { setReq({ ...req, [s.id]: true }); setSaved(false); }}>Booking request</Choice>
                </div>
                <span style={C.muted}>{req[s.id] ? "You approve each booking within 24 hours. The client pays after you accept." : "Clients pick an open time and pay — it's booked right away."}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>Add-ons</span>
                {s.adds.length ? s.adds.map((a) => <div key={a[0]} style={{ display: "flex", justifyContent: "space-between", background: "#0B0B0C", border: "1px solid #2A2A2E", borderRadius: 10, padding: "9px 12px", fontSize: 13 }}><span>{a[1]}</span><span>+${a[2]}</span></div>) : <span style={C.muted}>No add-ons yet.</span>}
                <button type="button" onClick={() => { setTop(isTop ? top.filter((x) => x !== s.id) : top.length < 4 ? [...top, s.id] : top); setSaved(false); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", color: "#F4F1EA", padding: 0, font: "700 13px var(--font-body), sans-serif", cursor: "pointer" }}><Check on={isTop} />Show on my page as a top service ({top.length} of 4)</button>
              </div>
            )}
          </div>
        );
      })}
      <Btn kind="outline">+ Add a service</Btn>
      <Btn onClick={() => setSaved(true)}>Save services</Btn>
      <Saved on={saved} />
    </>
  );
}

function Portfolio() {
  const [items, setItems] = useState(PORTFOLIO.slice(0, 6).map((p, i) => ({ ...p, id: i, star: i < 2 })));
  const [saved, setSaved] = useState(false);
  const photos = items.filter((i) => !i.video).length; const vids = items.filter((i) => i.video).length;
  const names = SERVICES.map((s) => s.id);
  return (
    <>
      <Head step="Step 5" title="Portfolio" text="Up to 10 photos and 5 videos (15 seconds each). Tag each one with the service it shows — clients tap it and book that look." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Btn kind="outline" disabled={photos >= 10} onClick={() => { setItems([...items, { img: "p-floral", svc: "gelx", id: Date.now(), star: false }]); setSaved(false); }}>+ Photo ({photos}/10)</Btn>
        <Btn kind="outline" disabled={vids >= 5} onClick={() => { setItems([...items, { img: "v-glam", svc: "glam", video: true, id: Date.now(), star: false }]); setSaved(false); }}>+ Video ({vids}/5)</Btn>
      </div>
      {items.map((it) => (
        <div key={it.id} style={{ display: "flex", gap: 10, alignItems: "center", background: "#121214", border: "1px solid #2A2A2E", borderRadius: 14, padding: 8 }}>
          <span style={{ position: "relative", flex: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={IMG(it.img)} alt="" style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", display: "block" }} />
            {it.video && <span style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,.65)", borderRadius: 5, padding: "1px 5px", fontSize: 10, fontWeight: 800 }}>VIDEO</span>}
          </span>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
            <button type="button" onClick={() => { setItems(items.map((x) => x.id === it.id ? { ...x, svc: names[(names.indexOf(x.svc) + 1) % names.length] } : x)); setSaved(false); }} style={{ background: "#0B0B0C", border: "1px solid #2A2A2E", borderRadius: 10, padding: "9px 10px", color: "#F4F1EA", textAlign: "left", font: "700 12px var(--font-body), sans-serif", cursor: "pointer" }}>Tagged: {SERVICES.find((s) => s.id === it.svc)!.name} ▾</button>
            <div style={{ display: "flex", gap: 6 }}>
              <Choice on={it.star} onClick={() => { setItems(items.map((x) => x.id === it.id ? { ...x, star: !x.star } : x)); setSaved(false); }} style={{ flex: 1, padding: 7, fontSize: 11 }}>{it.star ? "★ On top" : "☆ Put on top"}</Choice>
              <button type="button" aria-label="Remove" onClick={() => { setItems(items.filter((x) => x.id !== it.id)); setSaved(false); }} style={{ width: 34, borderRadius: 8, border: "1px solid #5A2A22", background: "transparent", color: "#F2A99A", cursor: "pointer" }}>×</button>
            </div>
          </div>
        </div>
      ))}
      <Btn onClick={() => setSaved(true)}>Save portfolio</Btn>
      <Saved on={saved} />
    </>
  );
}

function TravelHours() {
  const [mode, setMode] = useState("both");
  const [miles, setMiles] = useState(DEMO.travelMiles);
  const [fee, setFee] = useState(DEMO.travelFee);
  const [off, setOff] = useState(["Sun", "Mon"]);
  const [saved, setSaved] = useState(false);
  const H: Record<string, string> = { Tue: "10:00 AM – 7:00 PM", Wed: "10:00 AM – 7:00 PM", Thu: "10:00 AM – 7:00 PM", Fri: "10:00 AM – 7:00 PM", Sat: "9:00 AM – 4:00 PM" };
  return (
    <>
      <Head step="Step 6" title="Travel & hours" text="Where you work, how far you'll travel and what it costs, and when you're open." />
      <span style={C.eyebrow}>Where you work</span>
      {[["studio", "Clients come to me"], ["travel", "I travel to clients"], ["both", "Come to me or I travel"]].map(([k, l]) => <Choice key={k} on={mode === k} onClick={() => { setMode(k); setSaved(false); }} style={{ textAlign: "left", padding: "13px 14px", fontSize: 14 }}>{l}</Choice>)}
      {mode !== "travel" && <><Field label="Studio address" value="1240 W 6th St, Suite 4, Corona, CA 92882" /><span style={C.muted}>Clients only see your city and distance. The full address shows to a booked client on the day of the appointment.</span></>}
      {mode !== "studio" && (
        <div style={C.card}>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Travel</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}><span style={{ flex: 1 }}>How far you&apos;ll go</span>
            <button type="button" aria-label="Less" onClick={() => { setMiles(Math.max(5, miles - 5)); setSaved(false); }} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #2A2A2E", background: "#0B0B0C", color: "#F4F1EA", cursor: "pointer" }}>−</button>
            <b style={{ width: 50, textAlign: "center" }}>{miles} mi</b>
            <button type="button" aria-label="More" onClick={() => { setMiles(Math.min(50, miles + 5)); setSaved(false); }} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #2A2A2E", background: "#0B0B0C", color: "#F4F1EA", cursor: "pointer" }}>+</button>
          </div>
          <span style={{ fontSize: 13 }}>Travel fee</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 6 }}>{[35, 40, 45, 50, 55].map((f) => <Choice key={f} on={fee === f} onClick={() => { setFee(f); setSaved(false); }}>${f}</Choice>)}</div>
          <span style={C.muted}>A flat fee between $35 and $55, added only when you go to the client.</span>
        </div>
      )}
      <span style={C.eyebrow}>Hours · tap a day to open or close it</span>
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => { const closed = off.includes(d); return (
        <button key={d} type="button" onClick={() => { setOff(closed ? off.filter((x) => x !== d) : [...off, d]); setSaved(false); }} style={{ ...C.tile, padding: "10px 12px" }}>
          <Check on={!closed} /><b style={{ width: 40, fontSize: 13 }}>{d}</b><span style={{ flex: 1, fontSize: 13, color: closed ? "#8E897F" : "#F4F1EA" }}>{closed ? "Closed" : H[d] ?? "10:00 AM – 5:00 PM"}</span>
        </button>
      ); })}
      <div style={{ ...C.card, flexDirection: "row", justifyContent: "space-between", fontSize: 13 }}><span><b>After school</b> · Tue, Thu</span><span>3:30 – 7:00 PM</span></div>
      <Btn onClick={() => setSaved(true)}>Save</Btn>
      <Saved on={saved} />
    </>
  );
}

function Share() {
  const [copied, setCopied] = useState(false);
  const link = `usenearest.com/link/${DEMO.slug}`;
  return (
    <>
      <Head step="Step 7" title="Share your page" text="Put your link in your Instagram and TikTok bio. Followers can save your page to their phone like an app." />
      <div style={{ ...C.card, border: `1px solid ${ACCENT}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b style={{ fontSize: 14 }}>Your page is live</b><span style={{ background: "#12301C", color: "#8FE0A8", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>LIVE</span></div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "#0B0B0C", border: "1px solid #2A2A2E", borderRadius: 12, padding: "10px 12px", fontSize: 14 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</span>
          <button type="button" onClick={() => { navigator.clipboard?.writeText(`https://www.${link}`).catch(() => {}); setCopied(true); }} style={{ flex: "none", background: ACCENT, color: "#0B0B0C", border: "none", borderRadius: 999, padding: "8px 14px", font: "800 12px var(--font-body), sans-serif", cursor: "pointer" }}>{copied ? "Copied" : "Copy"}</button>
        </div>
        <a href="/partners/demo" style={{ textAlign: "center", border: "1px solid #3A3A3F", borderRadius: 999, padding: 12, textDecoration: "none", fontWeight: 800, fontSize: 12, color: "#F4F1EA" }}>See it the way clients do</a>
      </div>
      <span style={C.eyebrow}>Where to put it</span>
      <div style={{ ...C.card, gap: 8, fontSize: 14, lineHeight: 1.5 }}>
        <span><b>Instagram:</b> Edit profile → Links → Add external link → paste.</span>
        <span><b>TikTok:</b> Edit profile → Website → paste.</span>
        <span><b>Stories &amp; posts:</b> add a link sticker with your page.</span>
      </div>
      <span style={C.eyebrow}>Your partner dashboard</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
        {[["4", "Bookings today"], ["1", "Request"], ["2", "Messages"]].map(([n, l]) => <div key={l} style={{ ...C.card, padding: 12, gap: 2 }}><b style={{ fontSize: 20 }}>{n}</b><span style={{ fontSize: 11, color: "#B8B2A7" }}>{l}</span></div>)}
      </div>
      <span style={C.muted}>Bookings, requests, messages and earnings all live in the Nearest pro app you already use for your business.</span>
    </>
  );
}
