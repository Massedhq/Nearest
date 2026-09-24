import { notFound } from "next/navigation";
import { AdminHead } from "@/components/AdminHead";
import { ComingSoon } from "@/components/ComingSoon";
import { SECTION_TITLES } from "@/components/AdminNav";
import { requireAdmin } from "@/lib/admin";

export default async function Section({ params }: { params: Promise<{ section: string }> }) {
  await requireAdmin();
  const { section } = await params;
  const hit = SECTION_TITLES[section];
  if (!hit) notFound();
  return (
    <>
      <AdminHead eyebrow="Nearest Administration" title={hit[0]} />
      <ComingSoon title={hit[0]} phase={hit[1]} />
    </>
  );
}
