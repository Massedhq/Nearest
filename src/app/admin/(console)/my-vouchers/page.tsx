import { AdminHead } from "@/components/AdminHead";
import { requireAdmin } from "@/lib/admin";
import { VoucherDistributionView } from "@/components/VoucherDistributionView";

export const metadata = { title: "My Voucher Distribution" };
export const dynamic = "force-dynamic";

/**
 * My Voucher Distribution (2026-11-12): each distributor's own GRANTED voucher assignment, progress, organization
 * assignments and history. Owners only; everything is read for the signed-in owner's own id — nobody else's.
 */
export default async function MyVouchers() {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") { const { notFound } = await import("next/navigation"); notFound(); }
  return (
    <>
      <AdminHead eyebrow="Business" title="My Voucher Distribution" />
      <VoucherDistributionView userId={user.id} own />
    </>
  );
}
