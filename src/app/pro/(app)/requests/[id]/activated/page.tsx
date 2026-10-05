import { redirect } from "next/navigation";
import { requirePro } from "@/lib/pro";
import { stripe } from "@/lib/stripe";
import { saveSubscription } from "@/lib/pro-stripe";
import { acceptRequest } from "@/lib/requests";
import { TopBar } from "@/components/TopBar";
import { activateAndAccept } from "@/app/pro/request-actions";

export const metadata = { title: "Activating your membership" };
export const dynamic = "force-dynamic";

/** Back from Stripe: activate the membership, then accept the booking that triggered it — no hunting for it again. */
export default async function Activated({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ session?: string }> }) {
  const { user } = await requirePro();
  const { id } = await params;
  const { session: sid } = await searchParams;
  let active = false;
  if (sid) {
    try {
      const session = await stripe().checkout.sessions.retrieve(sid, { expand: ["subscription"] });
      if (session.client_reference_id === user.id && session.subscription && typeof session.subscription !== "string") {
        await saveSubscription(user.id, session.subscription);
        active = ["active", "trialing"].includes(session.subscription.status);
      }
    } catch (e) { console.error("activation return", e); }
  }
  if (active) {
    const r = await acceptRequest(id, user.id);
    if ("ok" in r) redirect(`/pro/appointments/${id}?accepted=1&activated=1`);
    redirect(`/pro/appointments/${id}?activated=1`);
  }
  return (
    <div className="scr">
      <TopBar title="Membership" back={`/pro/appointments/${id}`} />
      <div className="body">
        <h1 className="disp h1">Your payment didn&apos;t go through.</h1>
        <div className="card warn small"><span>Your membership isn&apos;t active yet, so the booking is still waiting for you. Nothing was charged. Try again with the same or another card.</span></div>
        <form action={activateAndAccept}><input type="hidden" name="id" value={id} /><button className="btn" type="submit" style={{ width: "100%" }}>Try again</button></form>
      </div>
    </div>
  );
}
