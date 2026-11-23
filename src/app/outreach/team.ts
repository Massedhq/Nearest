import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { requireTeamAssistant, fieldActor } from "@/lib/team";

/** Top of every /outreach page: an active owner assistant only (everyone else is sent where they belong). */
export async function assistantField() {
  const { row } = await requireTeamAssistant();
  const a = await fieldActor();
  if (!a?.assistant) notFound();
  const o = await db.query.users.findFirst({ where: eq(users.id, row.ownerId), columns: { firstName: true } });
  return { a, name: row.name, owner: o?.firstName ?? "your owner" };
}
