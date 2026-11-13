import { redirect } from "next/navigation";
import { requireAdmin, isMainOwner } from "@/lib/admin";

/** GRANTED vouchers are managed on Nearest Cards (main owner); everyone else has My Voucher Distribution. */
export default async function Vouchers() {
  const { user } = await requireAdmin();
  redirect((await isMainOwner(user.id)) ? "/admin/cards" : "/admin/my-vouchers");
}
