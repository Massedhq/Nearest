import { and, eq, inArray } from "drizzle-orm";
import { db, categories, proServices, proCredentials } from "@/db";
import { CredentialCard } from "@/components/CredentialCard";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { saveCredentials } from "@/app/pro/actions";

export const metadata = { title: "License" };

export default async function CredentialsStep({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const steps = await setupSteps(user.id);
  const needed = await db
    .selectDistinct({ id: categories.id, name: categories.name, label: categories.licenseLabel })
    .from(proServices)
    .innerJoin(categories, eq(categories.id, proServices.categoryId))
    .where(and(eq(proServices.userId, user.id), eq(proServices.active, true), eq(categories.licenseRequired, true)));
  const existing = needed.length
    ? await db.select().from(proCredentials).where(and(eq(proCredentials.userId, user.id), inArray(proCredentials.categoryId, needed.map((n) => n.id))))
    : [];
  return (
    <SetupShell steps={steps} current="credentials" title="Your professional status" edit={edit}>
      <p className="muted small p">Choose the one that describes you for each of these services.</p>
      <ActionForm action={saveCredentials} submitLabel={edit ? "Save" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        {needed.map((c) => {
          const cur = existing.find((e) => e.categoryId === c.id) ?? null;
          return <CredentialCard key={c.id} id={c.id} name={c.name} cur={cur} />;
        })}
        {needed.length === 0 && <p className="small muted p">Nothing to choose for your services. You can continue.</p>}
      </ActionForm>
    </SetupShell>
  );
}
