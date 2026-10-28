"use client";
import { useState } from "react";
import { ACCENT, GOLD, C, Choice, DemoShell } from "./ui";
import { RepCampaignGuide } from "@/components/RepCampaignGuide";

// SAMPLE DATA ONLY — a made-up rep, made-up professionals and made-up numbers. Never real reps or pros.
const REP = { name: "Jordan Ellis", first: "Jordan", code: "DEMO", link: "https://www.usenearest.com/r/DEMO", student: "https://www.usenearest.com/r/DEMO/students" };
const PROS = [
  { who: "Glow by Tia", cat: "Lash artists", city: "Riverside", status: "First booking", when: "Oct 3" },
  { who: "Crown & Coil Braids", cat: "Braiders", city: "Oak Park", status: "Live", when: "Oct 6" },
  { who: "Fade Lab Barbers", cat: "Barbers", city: "Riverside", status: "Live", when: "Oct 9" },
  { who: "Nailed It by Mari", cat: "Nail techs", city: "Lakeview", status: "Profile complete", when: "Oct 14" },
  { who: "Brow Theory", cat: "Brow artists", city: "Oak Park", status: "First booking", when: "Oct 15" },
  { who: "Silk & Shine Studio", cat: "Hairstylists", city: "Lakeview", status: "Started", when: "Oct 19" },
  { who: "Lashed by Kay", cat: "Lash artists", city: "Riverside", status: "Started", when: "Oct 22" },
  { who: "The Polish Room", cat: "Nail techs", city: "Riverside", status: "Profile complete", when: "Oct 24" },
  { who: "Student", cat: "", city: "", status: "Verified", when: "Oct 25" },
  { who: "Student", cat: "", city: "", status: "Signed up", when: "Oct 26" },
] as const;
const STATUSES = [["Started", "Account made, profile not finished — follow up"], ["Profile complete", "Submitted for review"], ["Live", "Approved and showing to students"], ["First booking", "Booked at least once"]] as const;
const PAYOUTS = [["Oct 15, 2026", "October 1–15", 180], ["Oct 1, 2026", "September 16–30", 120], ["Sep 15, 2026", "September 1–15", 60]] as const;
const TABS = ["Dashboard", "Sign-ups", "Pros by status", "City & category", "Earnings", "Campaign Guide"];

const pros = PROS.filter((p) => p.who !== "Student");
const count = (k: (typeof STATUSES)[number][0]) => pros.filter((p) => p.status === k).length;
const tally = (key: "city" | "cat") => Object.entries(pros.reduce<Record<string, number>>((m, p) => { m[p[key]] = (m[p[key]] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);

function Kpi({ label, n, sub }: { label: string; n: string | number; sub: string }) {
  return <div style={{ ...C.card, padding: 12, gap: 2 }}><span style={{ fontSize: 11, color: "#B8B2A7" }}>{label}</span><b style={{ fontSize: 24 }}>{n}</b><span style={{ fontSize: 11, color: "#8E897F" }}>{sub}</span></div>;
}
function CopyRow({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 800 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#0B0B0C", border: "1px solid #2A2A2E", borderRadius: 12, padding: "10px 12px" }}>
        <code style={{ flex: 1, fontSize: 13, wordBreak: "break-all" }}>{text}</code>
        <button type="button" onClick={() => setDone(true)} style={{ flex: "none", background: ACCENT, color: "#0B0B0C", border: "none", borderRadius: 999, padding: "8px 14px", font: "800 12px var(--font-body), sans-serif", cursor: "pointer" }}>{done ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

/** Public demo of the sales rep dashboard (sample data only) for prospective reps and partners. */
export function RepDemo() {
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState<string>("All");
  return (
    <DemoShell title="Rep dashboard · demo" other={{ label: "Partner demo", href: "/partners/demo" }} tabs={TABS} tab={tab} setTab={setTab}
      banner="DEMO — sample rep, sample professionals and sample numbers. Not real data."
      finish={{ label: "Become a sales rep", href: "mailto:support@usenearest.com?subject=Become%20a%20Nearest%20sales%20rep" }}>
      {tab === 0 && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ ...C.eyebrow, color: GOLD }}>Nearest sales team</span>
            <h1 style={C.h1}>Hi, {REP.first}</h1>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            <Kpi label="Link taps" n={214} sub="171 pro · 43 student" />
            <Kpi label="Total sign-ups" n={PROS.length} sub="6 this month" />
            <Kpi label="Professionals" n={pros.length} sub={`${count("Profile complete") + count("Live") + count("First booking")} complete · ${count("Live") + count("First booking")} live`} />
            <Kpi label="Students" n={2} sub="1 verified" />
          </div>
          <div style={C.card}>
            <span style={C.eyebrow}>Your links</span>
            <span style={C.muted}>Anyone who signs up within 30 days of tapping your link counts for you.</span>
            <CopyRow label="For professionals (your sales link)" text={REP.link} />
            <CopyRow label="For students (public places only)" text={REP.student} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "#B8B2A7" }}>Invite code</span><b style={{ letterSpacing: 2 }}>{REP.code}</b></div>
          </div>
          <div style={C.card}>
            <span style={C.eyebrow}>This campaign</span>
            <span style={{ fontSize: 14, fontWeight: 800 }}>Lash artists & nail techs in Riverside — 30 days</span>
            <div style={{ height: 8, borderRadius: 4, background: "#2A2A2E", overflow: "hidden" }}><div style={{ width: "60%", height: "100%", background: ACCENT }} /></div>
            <span style={C.muted}>6 of 10 professionals started · plan your next one in the Campaign Guide.</span>
          </div>
        </>
      )}

      {tab === 1 && (
        <>
          <h2 style={C.h1}>Sign-ups through your link</h2>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["All", "Professionals", "Students"].map((f) => <Choice key={f} on={filter === f} onClick={() => setFilter(f)} style={{ padding: "8px 12px" }}>{f}</Choice>)}</div>
          {PROS.filter((p) => filter === "All" || (filter === "Students" ? p.who === "Student" : p.who !== "Student")).map((p, i) => (
            <div key={i} style={{ ...C.tile, cursor: "default" }}>
              <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}><span style={{ fontSize: 14, fontWeight: 800 }}>{p.who}</span><span style={{ fontSize: 12, color: "#B8B2A7" }}>{p.who === "Student" ? "Student" : `${p.cat} · ${p.city}`} · {p.when}</span></span>
              <span style={{ fontSize: 11, fontWeight: 800, borderRadius: 999, padding: "4px 10px", ...(p.status === "Started" || p.status === "Signed up" ? { background: "#2B2410", color: "#E9CF8E" } : { background: "#12301C", color: "#8FE0A8" }) }}>{p.status}</span>
            </div>
          ))}
          <span style={C.muted}>Professionals show by business name. Students are never named.</span>
        </>
      )}

      {tab === 2 && (
        <>
          <h2 style={C.h1}>Professionals by status</h2>
          {STATUSES.map(([s, d]) => (
            <div key={s} style={C.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b style={{ fontSize: 15 }}>{s}</b><span style={C.muted}>{d}</span></span><b style={{ fontSize: 26 }}>{count(s)}</b></div>
              {pros.filter((p) => p.status === s).map((p) => <span key={p.who} style={{ fontSize: 13, color: "#D9D4CA" }}>{p.who} · {p.city}</span>)}
            </div>
          ))}
          <div style={{ ...C.card, border: `1px solid ${GOLD}` }}>
            <b style={{ fontSize: 14 }}>Follow up with Started</b>
            <span style={C.muted}>Send the follow-up message from the Campaign Guide — services, hours and a few photos are usually all that's left.</span>
          </div>
        </>
      )}

      {tab === 3 && (
        <>
          <h2 style={C.h1}>Sign-ups by city & category</h2>
          {([["By city", tally("city")], ["By service category", tally("cat")]] as const).map(([t, list]) => (
            <div key={t} style={C.card}>
              <span style={C.eyebrow}>{t}</span>
              {list.map(([label, n]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                  <span style={{ width: 110 }}>{label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#2A2A2E", overflow: "hidden" }}><div style={{ width: `${(n / pros.length) * 100}%`, height: "100%", background: ACCENT }} /></div>
                  <b style={{ width: 20, textAlign: "right" }}>{n}</b>
                </div>
              ))}
            </div>
          ))}
          <span style={C.muted}>Do more of what's working: here, lash artists and nail techs in Riverside.</span>
        </>
      )}

      {tab === 4 && (
        <>
          <h2 style={C.h1}>Earnings</h2>
          <div style={C.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={C.eyebrow}>Payouts</span><span style={{ background: "#12301C", color: "#8FE0A8", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>Connected</span></div>
            <span style={{ fontSize: 13 }}>Payments go to <b>Bank account •••• 1234</b> (sample).</span>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15 }}><b>Paid to you</b><b>${PAYOUTS.reduce((t, p) => t + p[2], 0).toFixed(2)}</b></div>
            {PAYOUTS.map(([d, note, a]) => <div key={d} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span>{d} · {note}</span><b>${a.toFixed(2)}</b></div>)}
          </div>
          <span style={C.muted}>Sample amounts. Real compensation is set by Nearest in writing for each rep. Reps are independent contractors and handle their own taxes.</span>
        </>
      )}

      {tab === 5 && (
        <>
          <h2 style={C.h1}>Campaign Guide</h2>
          <span style={{ fontSize: 14, color: "#D9D4CA", lineHeight: 1.5 }}>Every rep gets this guide on their dashboard, with their own link already filled into every message.</span>
          <RepCampaignGuide link={REP.link} name={REP.first} />
        </>
      )}
    </DemoShell>
  );
}
