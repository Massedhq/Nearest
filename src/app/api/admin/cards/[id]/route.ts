import { asc, eq } from "drizzle-orm";
import { db, nearestCardBatches, nearestCards } from "@/db";
import { requireAdmin } from "@/lib/admin";
import { logActivity } from "@/lib/log";
import { cardLabel, groupNumber, validThruLabel } from "@/lib/nearest-cards";

/** Owners: the printer file for one batch of Nearest Cards (CSV: number, code, value, valid thru). Every download is logged. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, role } = await requireAdmin();
  if (role !== "OWNER") return new Response("Only owners can download card files.", { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const batch = await db.query.nearestCardBatches.findFirst({ where: eq(nearestCardBatches.id, id) });
  if (!batch) return new Response("Not found", { status: 404 });
  const cards = await db.select({ number: nearestCards.number, code: nearestCards.code, status: nearestCards.status }).from(nearestCards).where(eq(nearestCards.batchId, id)).orderBy(asc(nearestCards.createdAt));
  const value = batch.kind === "free" ? `Free (up to $${(batch.amountCents / 100).toFixed(2)})` : `$${(batch.amountCents / 100).toFixed(2)} off`;
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["Card type", "Card number", "Code", "Value", "Valid thru", "Status"].join(",")];
  // ="..." keeps Excel from turning the numbers into 8.877E+15 or dropping a leading zero in the code.
  for (const c of cards) lines.push([q(cardLabel(batch.kind)), `="${groupNumber(c.number)}"`, `="${c.code}"`, q(value), q(validThruLabel(batch.validThru)), q(c.status)].join(","));
  await logActivity({ actorUserId: user.id, action: "cards.file_downloaded", targetType: "nearest_card_batch", targetId: id, after: { cards: cards.length } });
  const name = batch.name.replace(/[^A-Za-z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || "nearest-cards";
  return new Response(lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}
