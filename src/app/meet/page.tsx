import { MeetBooking } from "@/components/MeetBooking";
import { MEET_HOST } from "@/lib/meet";

export const metadata = {
  title: { absolute: `Meet ${MEET_HOST.name} — ${MEET_HOST.title} · Nearest` },
  description: "Nail techs, lash artists, hairstylists and barbers: book a 30-minute in-person meeting to grow your clientele and your portfolio with Nearest.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/** Public booking page for in-person meetings with the Director of Outreach (src/lib/meet.ts). */
export default function MeetPage() {
  return <MeetBooking host={MEET_HOST} />;
}
