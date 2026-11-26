import "server-only";
import { eq } from "drizzle-orm";
import { db, platformSettings } from "@/db";
import { ALL_MENU_ITEMS, SIMPLE_MENU } from "./owner-menu-items";

/**
 * Simple menus for the other owners (2026-11-26, owner rule): the main owner has the full admin menu; other owners
 * (Kisses, Lakeesha) start with SIMPLE_MENU — only what they need to grow Nearest. The main owner adds pages for each
 * of them later in Team & Activity Log → Their menu (stored as platform_settings "owner_menu.<userId>" = extra hrefs).
 * Pages that aren't on their menu are blocked too (requireAdmin checks the path the proxy passes in x-nearest-path).
 */
const key = (userId: string) => `owner_menu.${userId}`;

export async function extraMenu(userId: string): Promise<string[]> {
  const row = await db.query.platformSettings.findFirst({ where: eq(platformSettings.key, key(userId)) });
  const v = Array.isArray(row?.value) ? (row!.value as unknown[]) : [];
  const known = new Set(ALL_MENU_ITEMS.map((i) => i.href));
  return v.filter((h): h is string => typeof h === "string" && known.has(h) && !SIMPLE_MENU.includes(h));
}

export async function saveExtraMenu(userId: string, hrefs: string[], by: string) {
  const known = new Set(ALL_MENU_ITEMS.filter((i) => !i.mainOnly).map((i) => i.href));
  const clean = [...new Set(hrefs)].filter((h) => known.has(h) && !SIMPLE_MENU.includes(h));
  await db.insert(platformSettings).values({ key: key(userId), value: clean, updatedBy: by, updatedAt: new Date() })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: clean, updatedBy: by, updatedAt: new Date() } });
  return clean;
}

/** Every menu href this owner may open (base + what the main owner added). */
export async function menuFor(userId: string) {
  return [...SIMPLE_MENU, ...(await extraMenu(userId))];
}

/** Pages every admin can always open (profile, bell, sign-in, the guide) and the pages behind an allowed menu item. */
const ALWAYS = ["/admin/profile", "/admin/notifications", "/admin/sign-in", "/admin/guide"];
const CHILDREN: Record<string, string[]> = { "/admin/field/orgs": ["/admin/field/org/"] };

export function pathAllowed(path: string, hrefs: string[]) {
  if (ALWAYS.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  for (const raw of hrefs) {
    const h = raw.split("?")[0];
    if (h === "/admin") { if (path === "/admin") return true; continue; }
    if (path === h || path.startsWith(`${h}/`)) return true;
    if ((CHILDREN[h] ?? []).some((c) => path.startsWith(c))) return true;
  }
  return false;
}
