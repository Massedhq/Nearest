import { redirect } from "next/navigation";
import { getProViewer } from "@/lib/build-mode";
import { partnerPagePreview } from "@/lib/partners";
import { ensureProSlug } from "@/lib/connections";
import { PartnerPageView } from "@/components/PartnerPageView";

export const metadata = { title: "Preview my partner page", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Private preview of a partner's page (the partner, or an owner building it for them) — works before it's live. */
export default async function PartnerPreview() {
  const viewer = await getProViewer();
  if (!viewer?.user) redirect("/pro/sign-in");
  await ensureProSlug(viewer.user.id);
  const r = await partnerPagePreview(viewer.user.id);
  if (!r) redirect("/pro/partner");
  return <PartnerPageView r={r} preview />;
}
