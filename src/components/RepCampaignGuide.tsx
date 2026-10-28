"use client";
import { useEffect, useState } from "react";
import { CAMPAIGN_CATEGORIES, CAMPAIGN_GUIDE, CAMPAIGN_TIMEFRAMES, CORE_MESSAGE, fillScript } from "@/lib/rep-campaign";
import { FACEBOOK_URL, INSTAGRAM_URL } from "@/lib/public/site";
import { Icon } from "./Icon";

type Plan = { area: string; cats: string[]; time: string; goal: string };
const KEY = "nearest_rep_campaign";

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); } catch { window.prompt("Copy this:", text); } }}>
      {done ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The rep Campaign Guide: a quick campaign planner, then how campaigns work, where to find professionals, approaching
 * pros and schools, ideas, Meta/Google ads, copy-ready messages (the rep's own link filled in), brand rules and tracking.
 * The plan is kept in this browser only (a convenience — nothing is sent to Nearest).
 */
export function RepCampaignGuide({ link, name }: { link: string; name: string }) {
  const [plan, setPlan] = useState<Plan>({ area: "", cats: [], time: "30 days", goal: "10" });
  const [open, setOpen] = useState<string | null>("how");
  useEffect(() => { try { const s = localStorage.getItem(KEY); if (s) setPlan({ ...plan, ...JSON.parse(s) }); } catch { /* storage blocked */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = (p: Plan) => { setPlan(p); try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };
  const vars = { link, name, city: plan.area, category: plan.cats[0] };
  const ready = plan.area.trim() && plan.cats.length > 0;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="card" style={{ gap: 12 }}>
        <span className="eyebrow">Plan a campaign</span>
        <span className="small">{CORE_MESSAGE}</span>
        <div className="field"><label htmlFor="cg-area">Focus area (a city, neighborhood or school area)</label><input id="cg-area" value={plan.area} maxLength={60} placeholder="e.g. Westside, or the area around Valley Beauty Academy" onChange={(e) => save({ ...plan, area: e.target.value })} /></div>
        <div className="col g8">
          <span className="lbl">Service categories</span>
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {CAMPAIGN_CATEGORIES.map((c) => {
              const on = plan.cats.includes(c);
              return <button key={c} type="button" className={`chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => save({ ...plan, cats: on ? plan.cats.filter((x) => x !== c) : [...plan.cats, c].slice(-3) })}>{c}</button>;
            })}
          </div>
          <span className="xs muted">Pick up to 3.</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <div className="field grow"><label htmlFor="cg-time">Timeframe</label><select id="cg-time" value={plan.time} onChange={(e) => save({ ...plan, time: e.target.value })}>{CAMPAIGN_TIMEFRAMES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div className="field" style={{ width: 130 }}><label htmlFor="cg-goal">Goal (pros)</label><input id="cg-goal" inputMode="numeric" value={plan.goal} maxLength={4} onChange={(e) => save({ ...plan, goal: e.target.value.replace(/\D/g, "") })} /></div>
        </div>
        {ready ? (
          <div className="card" style={{ gap: 6, background: "#0E0E10" }}>
            <span className="small b">Your campaign: {plan.cats.join(", ")} in {plan.area} — {plan.time}, goal {plan.goal || "?"} professionals</span>
            <span className="xs muted">Week by week: list where these pros are → personal DMs Mon–Wed → visits Thu–Sat → follow up with everyone in Started on your dashboard every few days. Your link goes in every message:</span>
            <div className="row" style={{ gap: 8 }}><code className="small grow" style={{ wordBreak: "break-all" }}>{link}</code><Copy text={link} /></div>
          </div>
        ) : <span className="xs muted">Add a focus area and at least one category to see your plan. Your plan is saved on this device only.</span>}
      </div>

      {CAMPAIGN_GUIDE.map((b) => {
        const isOpen = open === b.id;
        return (
          <div key={b.id} className="card" style={{ gap: 10 }}>
            <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : b.id)} className="row between" style={{ background: "transparent", border: 0, color: "inherit", padding: 0, cursor: "pointer", textAlign: "left", font: "inherit", gap: 8 }}>
              <span className="b">{b.title}</span><Icon name={isOpen ? "down" : "right"} size="s" />
            </button>
            {isOpen && (
              <div className="col" style={{ gap: 10 }}>
                {b.intro && <span className="small">{fillScript(b.intro, vars)}</span>}
                {b.steps && <ol className="small" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.5 }}>{b.steps.map((s, i) => <li key={i}>{fillScript(s, vars)}</li>)}</ol>}
                {b.points && <ul className="small" style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, lineHeight: 1.5 }}>{b.points.map((s, i) => <li key={i}>{fillScript(s, vars)}</li>)}</ul>}
                {b.scripts?.map((sc) => {
                  const text = fillScript(sc.text, vars);
                  return (
                    <div key={sc.id} className="col" style={{ gap: 6, borderTop: "1px solid #1C1C1F", paddingTop: 10 }}>
                      <div className="row between" style={{ gap: 8 }}><span className="col g4"><span className="small b">{sc.title}</span><span className="xs muted">{sc.when}</span></span><Copy text={text} /></div>
                      <pre className="small" style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit", background: "#0E0E10", border: "1px solid #2A2A2D", borderRadius: 12, padding: 12, lineHeight: 1.5 }}>{text}</pre>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      <div className="card" style={{ gap: 10 }}>
        <span className="b">Follow Nearest</span>
        <span className="small muted">Follow us so you can share and repost what Nearest posts — it gives your campaign real examples to point to.</span>
        <div className="row" style={{ gap: 8 }}>
          <a className="btn sm" href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer"><Icon name="facebook" size="s" /> Follow on Facebook</a>
          <a className="btn ghost sm" href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Icon name="insta" size="s" /> Instagram</a>
        </div>
      </div>
    </div>
  );
}
