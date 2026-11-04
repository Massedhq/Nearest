import { requirePro } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { Icon } from "@/components/Icon";
import { learnPrice, publishedClasses } from "@/lib/learn";

export const metadata = { title: "Learn at Nearest" };

/**
 * Learn at Nearest — COMING SOON, professionals only (requirePro; never linked from student or public pages).
 * Shows the classes owners have marked "Show to professionals" as covers + titles + educator credit, labeled Coming
 * soon. No video plays here yet and nothing is sold. Covers come from /api/learn/[id]/cover (inside the app only).
 */
const POINTS: [string, string, string][] = [
  ["school", "Classes from working professionals", "Short, focused classes on one skill at a time, like ponytails, lash mapping or a clean fade, taught by educators who do it every day."],
  ["star", "Credit where it's due", "Every class shows who teaches it, with their name and links, so you can follow and support them."],
  ["clock", "30 days to learn it", "Buy a class and watch it as many times as you want for 30 days, right here in the app."],
  ["sparkle", "Practice, then post a Model Call", "Practice at home, then post a Model Call to try the new skill on a real client before you add it to your menu."],
];

export default async function LearnPage() {
  await requirePro();
  const classes = await publishedClasses();
  return (
    <div className="scr">
      <TopBar title="Learn at Nearest" back="/pro/business" />
      <div className="body">
        <div className="card pearl" style={{ gap: 10 }}>
          <span className="tag warn" style={{ alignSelf: "flex-start" }}>Coming soon</span>
          <span className="disp h2">Learn at Nearest</span>
          <span className="small">A place to pick up new skills from professionals who teach them, right inside your Nearest account.</span>
        </div>
        {classes.length > 0 && (
          <div className="col" style={{ gap: 10 }}>
            <span className="eyebrow">First classes</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {classes.map((c) => (
                <div key={c.id} className="col" style={{ gap: 6 }}>
                  <div style={{ position: "relative", borderRadius: 14, overflow: "hidden", aspectRatio: "9 / 16", background: "#1C1C1F" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.hasCover && <img src={`/api/learn/${c.id}/cover`} alt={`${c.title} by ${c.educatorName}`} draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    <span className="tag warn" style={{ position: "absolute", left: 8, top: 8 }}>Coming soon</span>
                    <span style={{ position: "absolute", inset: "auto 0 0 0", padding: "28px 10px 10px", background: "linear-gradient(transparent, rgba(0,0,0,.8))", display: "flex", alignItems: "center", gap: 6 }}><Icon name="lock" size="s" /><span className="xs b">Opens soon</span></span>
                  </div>
                  <span className="small b">{c.title}</span>
                  {learnPrice(c.priceCents) && <span className="small b" style={{ color: "#E3C58A" }}>{learnPrice(c.priceCents)} <span className="xs muted" style={{ fontWeight: 500 }}>• 30 days</span></span>}
                  <span className="xs muted">by {c.educatorLink ? <a className="link" href={c.educatorLink} target="_blank" rel="noopener noreferrer">{c.educatorName}</a> : c.educatorName}{c.category ? ` • ${c.category}` : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="col" style={{ gap: 10 }}>
          {POINTS.map(([icon, title, text]) => (
            <div key={title} className="card row" style={{ gap: 14, alignItems: "flex-start" }}>
              <Icon name={icon} />
              <div className="col g4"><span className="b">{title}</span><span className="small muted">{text}</span></div>
            </div>
          ))}
        </div>
        <p className="xs muted p" style={{ margin: 0 }}>Classes are skill training only. They don&apos;t count as continuing education hours or toward a license, and they play only inside the Nearest app. We&apos;ll let you know in Updates when the first classes open.</p>
      </div>
    </div>
  );
}
