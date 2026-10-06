import { requirePro, setupSteps } from "@/lib/pro";
import { SetupShell } from "@/components/SetupShell";
import { ActionForm } from "@/components/ActionForm";
import { ProStatusPicker } from "@/components/CredentialCard";
import { saveProfessionalStatus } from "@/app/pro/actions";

export const metadata = { title: "Professional status" };

/** One question for the whole account — self-reported, never reviewed, never shown to students. */
export default async function ProfessionalStatus({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { user, profile } = await requirePro();
  const edit = (await searchParams).edit === "1";
  const steps = await setupSteps(user.id);
  return (
    <SetupShell steps={steps} current="credentials" title="Professional status" edit={edit}>
      <ActionForm action={saveProfessionalStatus} submitLabel={edit ? "Save" : "Save & continue"} laterLabel={edit ? undefined : "Save & finish later"}>
        {edit && <input type="hidden" name="edit" value="1" />}
        <ProStatusPicker current={profile.professionalStatus} />
      </ActionForm>
    </SetupShell>
  );
}
