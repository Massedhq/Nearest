"use server";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, fines } from "@/db";
import { requirePro } from "@/lib/pro";
import { stripe, origin } from "@/lib/stripe";

export async function payFine(form: FormData) {
  const { user } = await requirePro();
  const f = await db.query.fines.findFirst({ where: and(eq(fines.id, String(form.get("id"))), eq(fines.proId, user.id), eq(fines.status, "outstanding")) });
  if (!f) redirect("/pro/account-status");
  const base = await origin();
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: user.email ?? undefined,
    line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: f.amountCents, product_data: { name: "Nearest professional fine", description: f.reason } } }],
    metadata: { fineId: f.id },
    success_url: `${base}/pro/account-status?fine_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/pro/account-status`,
  });
  await db.update(fines).set({ stripeCheckoutId: session.id }).where(eq(fines.id, f.id));
  redirect(session.url!);
}
