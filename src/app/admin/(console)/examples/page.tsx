import Link from "next/link";
import { AdminHead } from "@/components/AdminHead";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Profile examples" };

// Sample data only — shows what a mature profile looks like. Nothing here is a real person.
const PRO = {
  name: "Kisses Lash Studio", initials: "KL", city: "Frisco", distance: "2.4 mi away", rating: "4.9", reviews: 38, bookings: 126, favorites: 214, shares: 57, rebook: "71%",
  bio: "Classic, hybrid and volume lash sets for students on a budget. Licensed lash artist, 5 years. Quiet studio near Stonebriar — I'll have you out in time for practice.",
  services: [["Classic Full Set", "$65", "90 min"], ["Hybrid Full Set", "$85", "120 min"], ["Volume Full Set", "$110", "150 min"], ["Lash Fill (2–3 weeks)", "$45", "60 min"], ["Lash Removal", "$20", "30 min"]],
  portfolio: ["Classic set", "Hybrid set", "Wispy volume", "Natural classic", "Cat-eye hybrid", "Prom volume"],
  reviewList: [["Maya J.", 5, "Best lashes I've ever had — she explained aftercare and my set lasted 4 weeks."], ["Kayla B.", 5, "On time, clean studio, super gentle. Booked my fill before I left."], ["Jordan T.", 4, "Beautiful work. Ran 10 minutes late but texted me ahead."]],
  hours: [["Mon–Thu", "3:30–8:00 PM"], ["Fri", "3:30–9:00 PM"], ["Sat", "9:00 AM–5:00 PM"], ["Sun", "Closed"]],
};
const STUDENT = {
  name: "Maya J.", full: "Maya Johnson", username: "mayaj27", school: "Frisco High School", grad: "Class of 2027",
  stats: [["Appointments", "14"], ["Reviews written", "12"], ["Favorites", "9"], ["Connections", "6"]], credits: "$15.00",
  upcoming: ["Hybrid Fill with Kisses Lash Studio", "Sat, Oct 10 • 11:00 AM"],
  past: [["Classic Full Set", "Kisses Lash Studio", "Sep 12", 5], ["Knotless Braids (medium)", "Braids by Kee", "Aug 28", 5], ["Gel Manicure", "Nailed It DFW", "Aug 15", 4]],
  favorites: ["Kisses Lash Studio", "Braids by Kee", "Nailed It DFW", "Brow Theory"],
  connections: ["Kayla B.", "Jordan T.", "Ava R.", "Zoe M.", "Leah P.", "Nia W."],
  shared: [["Braids by Kee", "Kayla B."], ["Brow Theory", "Ava R."]],
};

const Tile = ({ label }: { label: string }) => (
  <div className="ph" style={{ height: 104, display: "grid", placeItems: "end start", padding: 8, background: "linear-gradient(135deg,#2A2320,#14110F)" }}>
    <span className="xs" style={{ background: "rgba(0,0,0,.55)", padding: "2px 6px", borderRadius: 6 }}>{label}</span>
  </div>
);
const Stat = ({ k, v }: { k: string; v: string }) => <div className="card" style={{ gap: 2, padding: 12, alignItems: "center", textAlign: "center" }}><span className="disp h2">{v}</span><span className="xs muted">{k}</span></div>;

export default async function Examples({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  const { show } = await searchParams;
  const tab = show === "student" ? "student" : "pro";
  return (
    <>
      <AdminHead eyebrow="Sample data — what a fully built-out profile looks like" title="Profile examples" />
      <div className="row" style={{ gap: 8 }}>
        <Link className={`chip${tab === "pro" ? " on" : ""}`} href="/admin/examples">Professional profile</Link>
        <Link className={`chip${tab === "student" ? " on" : ""}`} href="/admin/examples?show=student">Student profile</Link>
      </div>

      <div className="acols">
        {/* Phone-sized preview, exactly as it appears in the app */}
        <div style={{ maxWidth: 420, width: "100%", margin: "0 auto", border: "1px solid #2A2A2D", borderRadius: 32, padding: 16, background: "#000" }}>
          {tab === "pro" ? (
            <div className="col" style={{ gap: 14 }}>
              <div className="row">
                <div className="avatar lg">{PRO.initials}</div>
                <div className="col g4 grow"><span className="disp h2">{PRO.name}</span><span className="badge"><Icon name="shield" size="s" /> Approved by Nearest</span></div>
                <span className="col" style={{ alignItems: "center", gap: 2 }}><span className="iconbtn" style={{ width: 44, height: 44, color: "#F2A38F" }}><Icon name="heart" /></span><span className="xs b">{PRO.favorites}</span></span>
                <span className="iconbtn" style={{ width: 36, height: 36 }} aria-label="Share"><Icon name="link" size="s" /></span>
              </div>
              <div className="row" style={{ gap: 18 }}>
                <span className="col" style={{ alignItems: "center", gap: 4 }}><span className="iconbtn" style={{ width: 48, height: 48, background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", color: "#fff", borderColor: "transparent" }}><Icon name="insta" /></span><span className="xs">Instagram</span></span>
                <span className="col" style={{ alignItems: "center", gap: 4 }}><span className="iconbtn" style={{ width: 48, height: 48 }}><Icon name="tiktok" /></span><span className="xs">TikTok</span></span>
              </div>
              <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="tag"><Icon name="star" size="s" /> {PRO.rating} • {PRO.reviews} verified reviews</span>
                <span className="tag"><Icon name="pin" size="s" /> {PRO.distance}</span>
                <span className="tag"><Icon name="hand" size="s" /> ASL — Basic</span>
                <span className="tag">English • Spanish</span>
              </div>
              <div className="row small muted"><Icon name="store" size="s" /><span>Clients come to me • Frisco</span></div>
              <div className="card warn"><div className="row"><Icon name="bolt" /><span className="b grow">Available today</span></div><span className="small">4:30 PM • 6:00 PM</span></div>
              <span className="eyebrow">Portfolio</span>
              <div className="grid3">{PRO.portfolio.map((l) => <Tile key={l} label={l} />)}</div>
              <span className="eyebrow">About</span>
              <p className="small muted" style={{ margin: 0 }}>{PRO.bio}</p>
              <span className="eyebrow">Services</span>
              {PRO.services.map(([n, p, d]) => <div key={n} className="item"><div className="grow"><div className="b">{n}</div><div className="small muted">{p} • {d}</div></div><span className="btn sm">Book</span></div>)}
              <span className="eyebrow">Reviews</span>
              {PRO.reviewList.map(([n, r, t]) => <div key={n as string} className="card" style={{ gap: 4 }}><div className="row between"><span className="b small">{n}</span><span className="small">{"★".repeat(r as number)}{"☆".repeat(5 - (r as number))}</span></div><span className="small muted">{t}</span></div>)}
              <span className="link small">See all {PRO.reviews} reviews</span>
              <span className="eyebrow">Hours</span>
              {PRO.hours.map(([d, h]) => <div key={d} className="row between small"><span>{d}</span><span className="muted">{h}</span></div>)}
            </div>
          ) : (
            <div className="col" style={{ gap: 14 }}>
              <div className="row">
                <div className="avatar lg">MJ</div>
                <div className="col g4 grow"><span className="disp h2">{STUDENT.full}</span><span className="badge"><Icon name="shield" size="s" /> Verified Student</span><span className="xs muted">{STUDENT.school} • {STUDENT.grad}</span></div>
              </div>
              <div className="card" style={{ gap: 4 }}><span className="xs muted">Your username</span><div className="row between"><span className="b">@{STUDENT.username}</span><span className="btn ghost sm">Copy</span></div></div>
              <div className="grid2">{STUDENT.stats.map(([k, v]) => <Stat key={k} k={k} v={v} />)}</div>
              <div className="card ok" style={{ gap: 4 }}><span className="eyebrow">Next appointment</span><span className="b">{STUDENT.upcoming[0]}</span><span className="small muted">{STUDENT.upcoming[1]} • address unlocks the morning of</span></div>
              <div className="card" style={{ gap: 4 }}><div className="row between"><span className="eyebrow">Credits</span><span className="b">{STUDENT.credits}</span></div><span className="xs muted">$15 with Kisses Lash Studio from a rescheduled appointment</span></div>
              <span className="eyebrow">Past appointments</span>
              {STUDENT.past.map(([s, p, d, r]) => <div key={s as string} className="item"><div className="grow"><div className="b">{s}</div><div className="small muted">{p} • {d}</div></div><span className="small">{"★".repeat(r as number)}</span></div>)}
              <span className="eyebrow">Favorites</span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{STUDENT.favorites.map((f) => <span key={f} className="chip"><Icon name="heart" size="s" /> {f}</span>)}</div>
              <span className="eyebrow">My Connections ({STUDENT.connections.length})</span>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>{STUDENT.connections.map((c) => <span key={c} className="chip">{c}</span>)}</div>
              <span className="eyebrow">Shared with you</span>
              {STUDENT.shared.map(([p, from]) => <div key={p} className="item"><div className="avatar" style={{ width: 40, height: 40 }}>{p[0]}</div><div className="grow"><div className="b">{p}</div><div className="small muted">From {from}</div></div></div>)}
              <div className="col" style={{ gap: 0 }}>
                {["My appointments", "Connections", "Favorites", "My credits", "Notifications", "Communication preferences"].map((l) => <div key={l} className="item"><span className="grow">{l}</span><Icon name="right" size="s" /></div>)}
              </div>
            </div>
          )}
        </div>

        {/* What makes it "complete" */}
        <div className="card" style={{ gap: 10, alignSelf: "start" }}>
          <span className="eyebrow">{tab === "pro" ? "What students see after many bookings" : "What a fully set-up student has"}</span>
          {tab === "pro" ? (
            <>
              <span className="small">• <span className="b">{PRO.bookings} completed bookings</span> and <span className="b">{PRO.reviews} verified reviews</span> averaging ★ {PRO.rating}</span>
              <span className="small">• <span className="b">Saved by {PRO.favorites} students</span> (the number under the heart)</span>
              <span className="small">• <span className="b">Shared {PRO.shares} times</span> with Share with a Connection — shown to you in the Leaderboard, not to students</span>
              <span className="small">• {PRO.rebook} of clients book again</span>
              <span className="small">• Full portfolio (up to 10 photos, each tagged so students can Book this look)</span>
              <span className="small">• Instagram and TikTok icons, ASL and languages, Available today times, hours</span>
              <span className="small">• Only verified reviews from completed appointments appear</span>
            </>
          ) : (
            <>
              <span className="small">• <span className="b">Verified Student</span> — school ID + selfie approved</span>
              <span className="small">• Username to share, and <span className="b">6 connections</span> to send professionals to</span>
              <span className="small">• Appointment history with the reviews they left</span>
              <span className="small">• Favorites and professionals shared with them</span>
              <span className="small">• Credits (from rescheduling or a pro cancelling) ready to use</span>
              <span className="small muted">Students' profiles are private — other students only ever see “Maya J. • Frisco High School” in Connections.</span>
            </>
          )}
          <Link className="link small" href="/admin/leaderboard">See the real Leaderboard →</Link>
        </div>
      </div>
    </>
  );
}
