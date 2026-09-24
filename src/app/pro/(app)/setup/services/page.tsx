import { asc, eq } from "drizzle-orm";
import { db, categories, catalogServices, proServices } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { ServicesEditor } from "@/components/ServicesEditor";
import { saveServices } from "@/app/pro/actions";

export const metadata = { title: "Services" };

export default async function ServicesStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const [steps, cats, sugg, mine] = await Promise.all([
    setupSteps(user.id),
    db.select().from(categories).where(eq(categories.active, true)).orderBy(asc(categories.sort)),
    db.select().from(catalogServices).orderBy(asc(catalogServices.sort)),
    db.select().from(proServices).where(eq(proServices.userId, user.id)).orderBy(asc(proServices.sort)),
  ]);
  const catProps = cats.map((c) => ({ id: c.id, name: c.name, licenseRequired: c.licenseRequired, suggestions: sugg.filter((s) => s.categoryId === c.id).map((s) => s.name) }));
  const initial = mine.map((s) => ({ categoryId: s.categoryId, name: s.name, price: String(s.priceCents / 100), duration: String(s.durationMin) }));
  return (
    <SetupShell steps={steps} current="services" title="What do you do?" edit={edit}>
      <p className="muted small p">Customers search the actual service, not just your category.</p>
      <ActionForm action={saveServices} submitLabel={edit ? "Save services" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <ServicesEditor categories={catProps} initial={initial} />
      </ActionForm>
    </SetupShell>
  );
}
