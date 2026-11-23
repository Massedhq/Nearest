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

export function FieldHead({ at, title }: { at: string; title: string }) {
  return (
    <>
      <AdminHead eyebrow="Professional Outreach · Field team" title={title} />
      <FieldTabs base="/admin/field" at={at} owner />
    </>
  );
}
