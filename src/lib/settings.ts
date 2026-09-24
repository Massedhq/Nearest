import "server-only";
import { db, platformSettings } from "@/db";
import { SETTINGS } from "./settings-defaults";

export type Settings = Record<string, number | string | boolean>;

export async function getSettings(): Promise<Settings> {
  const rows = await db.select().from(platformSettings);
  const out: Settings = {};
  for (const [k, def] of Object.entries(SETTINGS)) out[k] = def.value;
  for (const r of rows) out[r.key] = r.value as number | string | boolean;
  return out;
}

export async function getNumber(key: string): Promise<number> {
  const s = await getSettings();
  return Number(s[key]);
}

export async function getFlag(key: string): Promise<boolean> {
  const s = await getSettings();
  return s[key] === true;
}
