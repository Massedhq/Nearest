import { ActionForm } from "@/components/ActionForm";
import { ProProtectionFields } from "@/components/ProProtectionFields";
import { saveProtection } from "@/app/pro/protection-actions";

type P = { entryPaidAt: Date | null; reviewStatus: string; insuranceChoiceAt: Date | null };

/**
 * Pro home: professionals who are already registered (or submitted) and haven't answered Professional Protection yet.
 * One tap answers it; it then disappears. Changing it later: Business → Professional Protection.
 */
export function ProProtectionCard({ profile }: { profile: P }) {
  if (profile.insuranceChoiceAt) return null;
  if (!profile.entryPaidAt && profile.reviewStatus === "draft") return null; // still registering — it's on the last setup page
  return (
    <div className="card" style={{ gap: 10 }}>
      <span className="eyebrow">New — please answer</span>
      <ActionForm action={saveProtection} submitLabel="Continue with this selection" buttonClass="btn sm">
        <ProProtectionFields />
      </ActionForm>
    </div>
  );
}
