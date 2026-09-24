import { and, eq, inArray } from "drizzle-orm";
import { db, categories, proServices, proCredentials } from "@/db";
import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { saveCredentials } from "@/app/pro/actions";

export const metadata = { title: "License" };

const TAG: Record<string, string> = { pending: "", verified: "ok", rejected: "bad" };

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
    <SetupShell steps={steps} current="credentials" title="Professional credentials" edit={edit}>
      <p className="muted small p">These categories require a license. Nearest reviews each one before your profile goes live.</p>
      <ActionForm action={saveCredentials} submitLabel={edit ? "Save" : "Save & continue"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        {needed.map((c) => {
          const cur = existing.find((e) => e.categoryId === c.id);
          return (
            <div key={c.id} className="card">
              <input type="hidden" name="categoryId" value={c.id} />
              <div className="row between"><span className="eyebrow">{c.name}</span>{cur && <span className={`tag ${TAG[cur.status]}`}>{cur.status}</span>}</div>
              {cur?.status === "rejected" && cur.reviewNote && <p className="err">{cur.reviewNote}</p>}
              <div className="field"><label htmlFor={`type_${c.id}`}>License type</label><input id={`type_${c.id}`} name={`type_${c.id}`} defaultValue={cur?.licenseType ?? c.label ?? ""} required /></div>
              <div className="field"><label htmlFor={`number_${c.id}`}>License number</label><input id={`number_${c.id}`} name={`number_${c.id}`} defaultValue={cur?.licenseNumber ?? ""} required /></div>
              <div className="grid2">
                <div className="field"><label htmlFor={`state_${c.id}`}>Issuing state</label><input id={`state_${c.id}`} name={`state_${c.id}`} defaultValue={cur?.issuingState ?? "Texas"} /></div>
                <div className="field"><label htmlFor={`expires_${c.id}`}>Expiration</label><input id={`expires_${c.id}`} name={`expires_${c.id}`} type="date" defaultValue={cur?.expiresOn ?? ""} /></div>
              </div>
            </div>
          );
        })}
        {needed.length === 0 && <p className="small muted p">None of your services need a license. You can continue.</p>}
      </ActionForm>
    </SetupShell>
  );
}
