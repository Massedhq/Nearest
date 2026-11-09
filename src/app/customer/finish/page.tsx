import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer, destinationFor } from "@/lib/viewer";
import { createCustomerFromSignUp, safePartnerNext } from "@/lib/customers";

export const metadata = { title: "Finishing your account" };
export const dynamic = "force-dynamic";

/** Right after a partner client verifies their email: create their Nearest account, then back to the booking. */
export default async function CustomerFinish({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safePartnerNext((await searchParams).next);
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  if (viewer.user) redirect(next ?? (await destinationFor(viewer)));
  const r = await createCustomerFromSignUp();
  if (r === "other") redirect(await destinationFor(viewer));
  if (r !== "problem") redirect(next ?? "/bookings");
  return (
    <div className="scr"><div className="body" style={{ gap: 14 }}>
      <h1 className="disp h2">We couldn&apos;t finish your account.</h1>
      <p className="small muted p">Your email must be verified and you must be 18 or older to book. If something looks wrong, contact support@usenearest.com.</p>
      <Link className="btn" href={next ?? "/"}>Go back</Link>
    </div></div>
  );
}
