import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, cities } from "@/db";
import { requirePro } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { partnerPageFor, partnerDemoLink, partnerSetupDemoLink } from "@/lib/partners";
import { partnerApplyStatus } from "@/lib/partner-apply";
import { mainCategory } from "@/lib/public/directory";
import { requestPartnership } from "@/app/partner-actions";

export const metadata = { title: "Become a Nearest Partner" };

/** Menu → Become a Nearest Partner (2026-11-22): what it is, progress to the booking minimum, then Apply. */
export default async function BecomePartner() {
  const { user, profile } = await requirePro();
  if (await partnerPageFor(user.id)) redirect("/pro/partner");
  const st = await partnerApplyStatus(user.id, user.email);
  const pct = st.min ? Math.min(100, Math.round((st.completed / st.min) * 100)) : 100;
  const [city, cat] = await Promise.all([
    profile.cityId ? db.query.cities.findFirst({ where: eq(cities.id, profile.cityId), columns: { name: true } }) : null,
    mainCategory(user.id),
  ]);
  return (
    <div className="scr">
      <TopBar title="Become a Nearest Partner" back="/pro/business" />
      <div className="body">
        <div className="card" style={{ gap: 8 }}>
          <span className="eyebrow">Nearest Partner</span>
          <span className="disp h2" style={{ margin: 0 }}>Your own booking page.</span>
          <span className="small">A partner page is your link-in-bio on Nearest: anyone 18+ can book you (no $150 limit), you can sell in your own shop, post public Model Calls, add assistants, and run your Student side and Partner side from one login.</span>
          <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
            <a className="btn ghost sm" href={partnerDemoLink()} target="_blank" rel="noreferrer">See a partner page</a>
            <a className="btn ghost sm" href={partnerSetupDemoLink()} target="_blank" rel="noreferrer">See how setup works</a>
          </div>
        </div>
        <div className="card" style={{ gap: 8 }}>
          <div className="row between"><span className="b">Completed bookings</span><span className="b">{Math.min(st.completed, st.min)} of {st.min}</span></div>
          <div style={{ height: 10, borderRadius: 5, background: "#2A2A2E", overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "#E8C4C0" }} /></div>
          <span className="xs muted">{st.eligible ? "You qualify — send your request below. Nearest reviews every request." : `Professionals can apply after ${st.min} completed bookings on Nearest. ${st.min - st.completed} to go.`}</span>
        </div>
        {st.pending ? <div className="card ok small"><span><span className="b">Your request is in.</span> We&apos;ll email you after we review it.</span></div>
          : st.eligible ? (
            <ActionForm action={requestPartnership} submitLabel="Send my request">
              {st.declined?.note && <div className="card warn small"><span>Last time: {st.declined.note}</span></div>}
              <div className="field"><label htmlFor="specialty">Your specialty</label><input id="specialty" name="specialty" defaultValue={cat ?? ""} maxLength={120} /></div>
              <input type="hidden" name="city" value={city?.name ?? ""} />
              <div className="field"><label htmlFor="about">What would you share on your partner page?</label><textarea id="about" name="about" rows={4} required placeholder="Your services, classes, products or tutorials — and who follows you." /></div>
              <label className="check"><input type="checkbox" name="agree" required />Nearest can review my account and contact me about the partner program</label>
            </ActionForm>
          ) : <Link className="btn ghost" href="/pro/home">Back to Today</Link>}
      </div>
    </div>
  );
}
