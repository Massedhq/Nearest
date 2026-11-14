import { AdminHead } from "@/components/AdminHead";
import { ActionForm } from "@/components/ActionForm";
import { requireMainOwner } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { liveReports } from "@/lib/live/reports";
import { ONLINE_FREE_MAX, rewardLabel } from "@/lib/reward-wheel";
import { saveOnlineCampaign, setOnlineCampaignStatus, saveSegment, addAdSpend, setLivePublic } from "@/app/admin/live-actions";
import { fmtDate, money } from "@/lib/time";

export const metadata = { title: "Nearest LIVE & Digital Rewards" };
export const dynamic = "force-dynamic";

const field = { borderRadius: 10, border: "1px solid #2A2A2D", background: "#0E0E10", color: "#ECE8E1", padding: "0 10px", height: 40 } as const;
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 100)}%` : "—");
const local = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "America/Chicago" }).slice(0, 16).replace(" ", "T") : "");
const STATUS: Record<string, string> = { draft: "Draft", live: "Live", paused: "Paused", ended: "Ended" };

/**
 * Nearest LIVE & Digital Rewards (main owner): the online reward wheel (campaigns, rewards, odds, inventory), voting by
 * channel and ad platform, ad performance with spend, and the live map's visibility. Counts only — no student details.
 */
export default async function LiveAdmin({ searchParams }: { searchParams: Promise<{ c?: string; seg?: string }> }) {
  await requireMainOwner({ page: true });
  const sp = await searchParams;
  const [r, settings] = await Promise.all([liveReports(), getSettings()]);
  const isPublic = settings["live.public"] === true;
  const camp = r.campaigns.find((c) => c.id === sp.c) ?? r.campaigns[0] ?? null;
  const editing = sp.c === "new" ? null : camp;
  const segs = camp ? r.segments.filter((x) => x.campaignId === camp.id) : [];
  const editSeg = segs.find((x) => x.id === sp.seg) ?? null;
  const freeSet = r.segments.filter((x) => x.kind === "free").reduce((n, x) => n + x.count, 0);
  const weightTotal = segs.filter((x) => x.count - x.claimed > 0).reduce((n, x) => n + x.weight, 0);
  const online = r.channels.find((c) => c.channel === "online") ?? { votes: 0, registered: 0 };
  const physical = r.channels.filter((c) => c.channel !== "online").reduce((a, c) => ({ votes: a.votes + c.votes, registered: a.registered + c.registered }), { votes: 0, registered: 0 });
  const dayMax = Math.max(1, ...r.daily.map((d) => d.physical + d.online));
  const tags = [["Meta Pixel", !!process.env.NEXT_PUBLIC_META_PIXEL_ID], ["Meta Conversions API", !!process.env.META_CAPI_TOKEN], ["Google Analytics 4", !!process.env.NEXT_PUBLIC_GA4_ID], ["Google Ads", !!process.env.NEXT_PUBLIC_GOOGLE_ADS_ID]] as const;

  return (
    <>
      <AdminHead eyebrow="Overview" title="Nearest LIVE & Digital Rewards" />

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Nearest LIVE map</span>
        <div className="row" style={{ gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <a className="btn sm" href="/live" target="_blank" style={{ width: "auto" }}>Open the live map</a>
          <form action={setLivePublic}><input type="hidden" name="on" value={isPublic ? "0" : "1"} /><button className="btn ghost sm" type="submit" style={{ width: "auto" }}>{isPublic ? "Make it owners only" : "Show it to everyone"}</button></form>
          <span className={`tag ${isPublic ? "ok" : ""}`}>{isPublic ? "Public" : "Owners only"}</span>
        </div>
        <span className="xs muted">Ad link for online voting: usenearest.com/vote?utm_source=facebook&amp;utm_campaign=YOUR-CAMPAIGN (use instagram or google as the source for those ads).</span>
      </div>

      <div className="card" style={{ gap: 10 }} id="wheel">
        <div className="row between" style={{ flexWrap: "wrap", gap: 8 }}><span className="eyebrow">Reward wheel campaigns</span><a className="link xs" href="/admin/live?c=new#wheel">+ New campaign</a></div>
        <table className="tbl"><thead><tr><th>Campaign</th><th>Dates (Central)</th><th>Where</th><th>Status</th><th /></tr></thead>
          <tbody>{r.campaigns.length === 0 ? <tr><td className="empty" colSpan={5}>No online campaigns yet — set one up below.</td></tr> : r.campaigns.map((c) => (
            <tr key={c.id}><td className="b"><a className="link" href={`/admin/live?c=${c.id}#wheel`}>{c.name}</a></td>
              <td className="xs">{c.starts_at ? fmtDate(new Date(c.starts_at)) : "Any time"} – {c.ends_at ? fmtDate(new Date(c.ends_at)) : "no end"}</td><td>{c.states.join(", ")}</td>
              <td><span className={`tag ${c.status === "live" ? "ok" : ""}`}>{STATUS[c.status] ?? c.status}</span></td>
              <td><div className="row" style={{ gap: 6 }}>
                {c.status !== "live" && <form action={setOnlineCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="live" /><button className="link xs b" type="submit">Go live</button></form>}
                {c.status === "live" && <form action={setOnlineCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="paused" /><button className="link xs" type="submit">Pause</button></form>}
                {c.status !== "ended" && <form action={setOnlineCampaignStatus}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="ended" /><button className="link xs" type="submit">End</button></form>}
              </div></td></tr>
          ))}</tbody>
        </table>
        <span className="xs muted">Go live needs at least one reward with odds above 0, official rules, and a Valid thru in the future. Only one campaign is live at a time.</span>

        <span className="small b">{editing ? `Change ${editing.name}` : "New campaign"}</span>
        <ActionForm action={saveOnlineCampaign} submitLabel={editing ? "Save changes" : "Save draft"} buttonClass="btn sm" className="col g8">
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid2" style={{ gap: 8 }}>
            <input name="name" required maxLength={80} defaultValue={editing?.name ?? ""} placeholder="Campaign name" style={field} aria-label="Campaign name" />
            <input name="states" defaultValue={editing?.states.join(", ") ?? "TX"} placeholder="States (e.g. TX)" style={field} aria-label="States" />
            <label className="xs muted col" style={{ gap: 2 }}>Starts<input name="startsAt" type="datetime-local" defaultValue={local(editing?.starts_at ?? null)} style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>Ends<input name="endsAt" type="datetime-local" defaultValue={local(editing?.ends_at ?? null)} style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>Hold with an email (hours)<input name="holdHours" inputMode="numeric" defaultValue={editing?.hold_hours ?? 72} style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>Hold without an email (minutes)<input name="quickHoldMinutes" inputMode="numeric" defaultValue={editing?.quick_hold_minutes ?? 60} style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>Spins per hour from one network<input name="spinsPerHour" inputMode="numeric" defaultValue={editing?.spins_per_hour ?? 5} style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>Cards valid thru<input name="validThru" type="month" required defaultValue={editing ? new Date(editing.valid_thru).toISOString().slice(0, 7) : "2027-12"} style={field} /></label>
          </div>
          <textarea name="rulesText" rows={5} defaultValue={editing?.rules_text ?? ""} placeholder="Official rules shown from the wheel (eligibility, one reward per student, not with a printed GRANTED voucher, how long it's held, no purchase needed, no cash value…)" style={{ ...field, height: "auto", padding: 10 }} aria-label="Official rules" />
        </ActionForm>
      </div>

      {camp && (
        <div className="card" style={{ gap: 10 }} id="rewards">
          <span className="eyebrow">Rewards on the wheel — {camp.name}</span>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl"><thead><tr><th>Reward</th><th className="num">How many</th><th className="num">Odds</th><th className="num">Chance now</th><th className="num">Won</th><th className="num">Held</th><th className="num">On accounts</th><th className="num">Used</th><th className="num">Expired</th><th className="num">Left</th><th /></tr></thead>
              <tbody>{segs.length === 0 ? <tr><td className="empty" colSpan={11}>No rewards yet — add them below.</td></tr> : segs.map((x) => {
                const left = Math.max(0, x.count - x.claimed);
                return (
                  <tr key={x.id}><td className="b">{rewardLabel(x.kind, x.amountCents)}</td><td className="num">{x.count}</td><td className="num">{x.weight}</td><td className="num">{left > 0 && weightTotal ? pct(x.weight, weightTotal) : "—"}</td>
                    <td className="num">{x.held + x.assigned}</td><td className="num">{x.held}</td><td className="num b">{x.assigned}</td><td className="num">{x.used}</td><td className="num">{x.expired + x.declined}</td><td className="num">{left}</td>
                    <td><a className="link xs" href={`/admin/live?c=${camp.id}&seg=${x.id}#rewards`}>Edit</a></td></tr>
                );
              })}</tbody>
            </table>
          </div>
          <span className="xs muted">Online free-service rewards set: {freeSet} of {ONLINE_FREE_MAX} (all online campaigns together — separate from the printed vouchers). Odds are relative: a reward with odds 10 comes up twice as often as one with 5. Odds 0 takes it off the wheel.</span>
          <span className="small b">{editSeg ? `Change ${rewardLabel(editSeg.kind, editSeg.amountCents)}` : "Add a reward"}</span>
          <ActionForm action={saveSegment} submitLabel={editSeg ? "Save" : "Add to the wheel"} buttonClass="btn sm" className="col g8">
            <input type="hidden" name="campaignId" value={camp.id} />
            {editSeg && <input type="hidden" name="id" value={editSeg.id} />}
            <div className="grid2" style={{ gap: 8 }}>
              <select name="kind" defaultValue={editSeg?.kind ?? "discount"} style={field} aria-label="Reward type"><option value="discount">Discount</option><option value="free">Free service</option></select>
              <select name="amount" defaultValue={editSeg && editSeg.kind === "discount" ? String(editSeg.amountCents / 100) : "10"} style={field} aria-label="Dollars off (discount)">{[5, 10, 20, 30, 40].map((d) => <option key={d} value={d}>${d} off</option>)}</select>
              <input name="count" required inputMode="numeric" defaultValue={editSeg?.count ?? ""} placeholder="How many" style={field} aria-label="How many" />
              <input name="weight" required inputMode="numeric" defaultValue={editSeg?.weight ?? ""} placeholder="Odds (e.g. 10)" style={field} aria-label="Odds" />
            </div>
            <span className="xs muted">Free service covers the whole eligible service the professional chose; the deposit and booking fee are still paid. Dollars off is ignored for free service.</span>
          </ActionForm>
          {editSeg && <a className="link xs" href={`/admin/live?c=${camp.id}#rewards`}>Cancel</a>}
        </div>
      )}

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Voting</span>
        <div className="kpis k4">
          <div className="col" style={{ gap: 2 }}><span className="xs muted">All votes</span><span className="stat">{(online.votes + physical.votes).toLocaleString()}</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Printed vouchers (/card)</span><span className="stat">{physical.votes.toLocaleString()}</span><span className="xs muted">{physical.registered} registered</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">Online (/vote)</span><span className="stat">{online.votes.toLocaleString()}</span><span className="xs muted">{online.registered} registered</span></div>
          <div className="col" style={{ gap: 2 }}><span className="xs muted">By platform</span><span className="xs">{r.platforms.map((p) => `${p.platform} ${p.votes}`).join(" • ") || "—"}</span></div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
          {r.daily.map((d) => (
            <div key={d.day} title={`${d.day}: ${d.physical} printed, ${d.online} online`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
              <div style={{ height: `${(d.online / dayMax) * 100}%`, background: "#E3C58A" }} /><div style={{ height: `${(d.physical / dayMax) * 100}%`, background: "#C9C6C0" }} />
            </div>
          ))}
        </div>
        <span className="xs muted">Last 30 days — silver = printed vouchers, gold = online. Votes by city and service: the live map and Nearest Cards → Reports.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Ad performance</span>
        <div style={{ overflowX: "auto" }}>
          <table className="tbl"><thead><tr><th>Platform</th><th>Campaign</th><th className="num">Visits</th><th className="num">Votes</th><th className="num">Vote rate</th><th className="num">Spins</th><th className="num">Registered</th><th className="num">Cards added</th><th className="num">Spend</th><th className="num">Cost per vote</th></tr></thead>
            <tbody>{r.ads.length === 0 ? <tr><td className="empty" colSpan={10}>No visits from ad links yet.</td></tr> : r.ads.map((a) => (
              <tr key={`${a.platform}-${a.campaign}`}><td>{a.platform}</td><td className="b">{a.campaign}</td><td className="num">{a.visits}</td><td className="num">{a.votes}</td><td className="num">{pct(a.votes, a.visits)}</td><td className="num">{a.spins}</td><td className="num">{a.registered}</td><td className="num b">{a.cards}</td>
                <td className="num">{a.spend ? money(a.spend) : "—"}</td><td className="num">{a.spend && a.votes ? money(Math.round(a.spend / a.votes)) : "—"}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <span className="xs muted">From Nearest&apos;s own records (the ad link&apos;s utm tags). Spend is what you enter below from Meta / Google — cost per vote shows only when spend is entered.</span>
        <ActionForm action={addAdSpend} submitLabel="Save spend" buttonClass="btn sm" className="col g8">
          <div className="grid2" style={{ gap: 8 }}>
            <select name="platform" defaultValue="facebook" style={field} aria-label="Platform"><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="google">Google</option><option value="other">Other</option></select>
            <input name="campaign" required placeholder="Campaign (same as utm_campaign)" style={field} aria-label="Campaign" />
            <input name="amount" required inputMode="decimal" placeholder="Spent ($)" style={field} aria-label="Spent" />
            <label className="xs muted col" style={{ gap: 2 }}>From<input name="fromDay" type="date" required style={field} /></label>
            <label className="xs muted col" style={{ gap: 2 }}>To<input name="toDay" type="date" required style={field} /></label>
          </div>
        </ActionForm>
        <span className="xs muted">Ad tags: {tags.map(([n, on]) => `${n} ${on ? "on" : "off"}`).join(" • ")}. They only load after a visitor allows ad measurement, and only get event names — never names, schools, cities or service picks.</span>
      </div>

      <div className="card" style={{ gap: 10 }}>
        <span className="eyebrow">Recent spins</span>
        <table className="tbl"><thead><tr><th>When</th><th>Reward</th><th>City</th><th>From</th><th>Status</th></tr></thead>
          <tbody>{r.spinsRecent.length === 0 ? <tr><td className="empty" colSpan={5}>No spins yet.</td></tr> : r.spinsRecent.map((x, i) => (
            <tr key={i}><td className="xs">{fmtDate(new Date(x.at))}</td><td>{rewardLabel(x.kind, x.amountCents)}</td><td>{x.city ?? "—"}</td><td>{x.platform}</td><td>{({ held: "Held", assigned: "On an account", expired: "Expired", declined: "Not added (already had a GRANTED card)" } as Record<string, string>)[x.status] ?? x.status}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
