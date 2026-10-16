import { requirePro } from "@/lib/pro";
import { TopBar } from "@/components/TopBar";
import { ActionForm } from "@/components/ActionForm";
import { ProProtectionFields } from "@/components/ProProtectionFields";
import { saveProtection } from "@/app/pro/protection-actions";
import { protectionLabel } from "@/lib/insurance";
import { fmtDate } from "@/lib/time";

export const metadata = { title: "Professional Protection" };

/** Business → Professional Protection: see or change your self-reported insurance preference. */
export default async function ProtectionPage() {
  const { profile: p } = await requirePro();
  return (
    <div className="scr">
      <TopBar title="Professional Protection" back="/pro/business" />
      <div className="body">
        {p.insuranceChoiceAt && <div className="card ok small"><span>Your answer: <span className="b">{protectionLabel(p.insuranceChoice, p.insuranceInterest)}</span> (saved {fmtDate(p.insuranceChoiceAt)}). You can change it below.</span></div>}
        <ActionForm action={saveProtection} submitLabel={p.insuranceChoiceAt ? "Save my choice" : "Continue with this selection"}>
          <ProProtectionFields choice={p.insuranceChoice} interest={p.insuranceInterest} />
        </ActionForm>
      </div>
    </div>
  );
}
