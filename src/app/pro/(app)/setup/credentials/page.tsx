import { and, eq, inArray } from "drizzle-orm";
import { db, categories, proServices, proCredentials, studentIdDocs } from "@/db";
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
  const docs = needed.length ? (await db.select({ kind: studentIdDocs.kind }).from(studentIdDocs).where(eq(studentIdDocs.userId, user.id))).map((d) => d.kind) : [];
  return (
    <SetupShell steps={steps} current="credentials" title="Professional credentials" edit={edit}>
      <p className="muted small p">These categories require a license. Just graduated and waiting on yours? Choose &quot;license pending&quot; and add your diploma or certificate instead. Nearest reviews each one before your profile goes live.</p>
      <ActionForm action={saveCredentials} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        {needed.map((c) => {
          const cur = existing.find((e) => e.categoryId === c.id) ?? null;
          return <CredentialCard key={c.id} id={c.id} name={c.name} label={c.label} cur={cur} hasDiplomaPhoto={docs.includes(`diploma_${c.id}`)} />;
        })}
        {needed.length === 0 && <p className="small muted p">None of your services need a license. You can continue.</p>}
      </ActionForm>
    </SetupShell>
  );
}
