import { AdminHead } from "@/components/AdminHead";
import { StatusPanel } from "@/components/StatusPanel";
import { requireAdmin } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { SETTINGS } from "@/lib/settings-defaults";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Rules & Settings" };

export default async function SettingsPage() {
  const { role } = await requireAdmin();
  const s = await getSettings();
  const groups = new Map<string, { key: string; def: (typeof SETTINGS)[string]; value: number | string | boolean }[]>();
  for (const [key, def] of Object.entries(SETTINGS)) {
    if (def.type === "bool") continue;
    if (!groups.has(def.group)) groups.set(def.group, []);
    groups.get(def.group)!.push({ key, def, value: s[key] });
  }
  return (
    <>
      <AdminHead eyebrow="Owner only • changes are logged" title="Rules & Settings" />
      <SettingsForm groups={[...groups.entries()]} canEdit={role === "OWNER"} />
      <div className="acols"><StatusPanel settings={s} canEdit={role === "OWNER"} /><div /></div>
    </>
  );
}
