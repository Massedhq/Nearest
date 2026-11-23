import Image from "next/image";
import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { partnerSides } from "@/lib/partner-booking";
import { setProSide } from "@/app/pro/side-actions";

export const metadata = { title: "Where are you working today?" };

/** First screen after sign-in for professionals who are also Nearest Partners (2026-11-22, owner): pick a side. */
export default async function ChooseSide() {
  const { user, profile } = await requirePro();
  const sides = await partnerSides(user.id);
  if (!sides.partner || sides.partnerOnly) redirect("/pro/home");
  const opt = (side: "student" | "partner", title: string, sub: string) => (
    <form action={setProSide}>
      <input type="hidden" name="side" value={side} /><input type="hidden" name="back" value="/pro/home" />
      <button type="submit" className="card" style={{ width: "100%", textAlign: "left", cursor: "pointer", gap: 6, padding: 18, border: side === "partner" ? "1px solid #E8C4C0" : undefined }}>
        <span className="eyebrow">{side === "partner" ? "Partner side" : "Student side"}</span>
        <span className="disp" style={{ fontSize: 24 }}>{title}</span>
        <span className="small muted">{sub}</span>
      </button>
    </form>
  );
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ gap: 14, maxWidth: 480, margin: "0 auto", width: "100%" }}>
        <div className="row" style={{ gap: 12 }}>
          {profile.photoUrl && <Image src={profile.photoUrl} alt="" width={52} height={52} style={{ borderRadius: 26, objectFit: "cover" }} />}
          <span className="col" style={{ gap: 2 }}><span className="small muted">Welcome back{user.firstName ? `, ${user.firstName}` : ""}</span><span className="disp h2" style={{ margin: 0 }}>Where are you working today?</span></span>
        </div>
        {opt("student", "Student side", "Bookings from verified students in the Nearest app, your student-side services and Model Calls.")}
        {opt("partner", "Partner side", "Your partner page — bookings from anyone 18+, your shop, partner Model Calls and assistants.")}
        <span className="xs muted">Switch anytime from the top of your Menu. Your calendar is shared, so the two sides never double-book.</span>
      </div>
    </div>
  );
}
