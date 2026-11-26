import { notFound } from "next/navigation";
import { AdminHead } from "@/components/AdminHead";
import { FieldTabs } from "@/components/field/FieldViews";
import { requireAdmin } from "@/lib/admin";
import { fieldActor } from "@/lib/team";

/** Admin → Field team: owners only. The main owner sees every owner's work; other owners see their own. */
export async function ownerField() {
  const { role } = await requireAdmin();
  if (role !== "OWNER") notFound();
  const a = await fieldActor();
  if (!a || a.assistant) notFound();
  return a;
}

/** `simple` = an owner on the simple menu (2026-11-26): no Field team menu, just the page. */
export function FieldHead({ at, title, simple }: { at: string; title: string; simple?: boolean }) {
  return (
    <>
      <AdminHead eyebrow={simple ? "Professional Outreach" : "Professional Outreach · Field team"} title={title} />
      {!simple && <FieldTabs base="/admin/field" at={at} owner />}
    </>
  );
}
