import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { PartnerBookShell, PS } from "@/components/PartnerBookShell";
import { CustomerSignUpForm } from "@/components/CustomerSignUpForm";
import { safePartnerNext } from "@/lib/customers";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";
import { partnerName } from "@/lib/partner-booking";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your account", robots: { index: false, follow: false } };

/** Partner side: a quick account (18+, email code, no school or ID check) before paying for a booking. */
export default async function PartnerJoin({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const { slug } = await params;
  const r = await publicPartnerPage(slug);
  if (!r) notFound();
  const base = partnerPagePath(r.p.slug!);
  const next = safePartnerNext((await searchParams).next) ?? `${base}/book`;
  const { userId } = await auth();
  if (userId) redirect(next);
  const name = partnerName(r);
  return (
    <PartnerBookShell name={name} photo={r.p.photoUrl} back={base}>
      <h2 style={PS.h1}>Almost there</h2>
      <span style={PS.muted}>Create a quick account to book {name}. Anyone 18+ — no school or ID needed. Already on Nearest? Sign in at the bottom.</span>
      <div className="lightbox"><CustomerSignUpForm next={next} partnerName={name} /></div>
      <span style={PS.muted}>Are you a student? You can book with this account too. For student benefits on Nearest, create a student account from the Nearest app instead.</span>
    </PartnerBookShell>
  );
}
