import { notFound } from "next/navigation";
import { AdminHead } from "@/components/AdminHead";
import { requireMainOwner } from "@/lib/admin";
import { db } from "@/db";
import { VoucherDistributionView } from "@/components/VoucherDistributionView";

export const metadata = { title: "Distributor" };
export const dynamic = "force-dynamic";

/** One distributor's full voucher activity — main owner only (Voucher Distribution Management). */
export default async function DistributorDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireMainOwner({ page: true });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const u = await db.query.users.findFirst({ where: (t, { eq }) => eq(t.id, id) });
  if (!u) notFound();
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Distributor";
  return (
    <>
      <AdminHead eyebrow="Nearest Cards" title={name} />
      <a className="link xs" href="/admin/cards">← Nearest Cards</a>
      <VoucherDistributionView userId={id} own={false} />
    </>
  );
}
