import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db, users, teamAssistants } from "@/db";
import { requireTeamAssistant, fieldActor, mayWork, type FieldActor } from "@/lib/team";

export const VIEW_AS_COOKIE = "nearest_view_as";

/**
 * Top of every /outreach page: an active owner assistant only (everyone else is sent where they belong) — or an owner
 * who tapped "See <name>'s screen" (cookie nearest_view_as = the assistant row id, re-checked here: the assistant must be
 * active and belong to that owner; the main owner may view anyone's). Viewing shows exactly her screens; any form the
 * owner sends from there still acts as the owner.
 */
export async function assistantField(): Promise<{ a: FieldActor; name: string; owner: string; viewAs: boolean; assistantUserId: string | null }> {
  const id = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    const me = await fieldActor();
    if (me && !me.assistant) {
      const row = await db.query.teamAssistants.findFirst({ where: and(eq(teamAssistants.id, id), eq(teamAssistants.status, "active")) });
      if (row && mayWork(me, row.ownerId)) {
        const o = await db.query.users.findFirst({ where: eq(users.id, row.ownerId), columns: { firstName: true } });
        return { a: { ...me, assistant: row, ownerId: row.ownerId, scope: row.ownerId, main: false }, name: row.name, owner: o?.firstName ?? "your owner", viewAs: true, assistantUserId: row.userId };
      }
    }
  }
  const { row } = await requireTeamAssistant();
  const a = await fieldActor();
  if (!a?.assistant) notFound();
  const o = await db.query.users.findFirst({ where: eq(users.id, row.ownerId), columns: { firstName: true } });
  return { a, name: row.name, owner: o?.firstName ?? "your owner", viewAs: false, assistantUserId: row.userId };
}
