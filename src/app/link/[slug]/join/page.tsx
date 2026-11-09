import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TopBar } from "@/components/TopBar";
import { CustomerSignUpForm } from "@/components/CustomerSignUpForm";
import { safePartnerNext } from "@/lib/customers";
import { publicPartnerPage, partnerPagePath } from "@/lib/partners";
import { personName } from "@/lib/pro-name";

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
  const name = personName(r.p.displayName, r.u.firstName, r.u.lastName);
  return (
    <div className="scr">
      <TopBar title={`Book ${name}`} back={base} />
      <div className="body">
        <div className="lightbox"><CustomerSignUpForm next={next} partnerName={name} /></div>
        <p className="xs muted p">Are you a student? You can book with this account. To get student benefits on Nearest, create a student account from the Nearest app instead.</p>
      </div>
    </div>
  );
}
