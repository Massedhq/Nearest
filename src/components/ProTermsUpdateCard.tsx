import { ActionForm } from "@/components/ActionForm";
import { ProTermsAgreement } from "@/components/ProTermsAgreement";
import { PRO_TERMS_VERSION, proTermsSections, rateLabel } from "@/lib/pro-terms";
import { acceptUpdatedProTerms } from "@/app/pro/terms-actions";

type P = { entryPaidAt: Date | null; proTermsVersion: string | null; monthlyRateCents: number | null; entryType: string | null };

/** Pro home: shown to enrolled pros until they accept the current version of the Professional Terms. */
export function ProTermsUpdateCard({ profile, owner }: { profile: P; owner: boolean }) {
  if (owner || !profile.entryPaidAt || profile.proTermsVersion === PRO_TERMS_VERSION) return null;
  return (
    <div className="card warn" style={{ gap: 10 }}>
      <span className="eyebrow">Updated Professional Terms — please review</span>
      <span className="small">We added section 6, <span className="b">Liability, insurance &amp; indemnity</span>: you&apos;re responsible for the services you provide, you agree to carry professional and general liability insurance, to tell Nearest within 48 hours if a license is suspended or expires, and to cover Nearest for claims arising from your services. Your rate and everything else stay the same.</span>
      <ActionForm action={acceptUpdatedProTerms} submitLabel="Accept updated terms" buttonClass="btn sm">
        <ProTermsAgreement sections={proTermsSections({ cents: profile.monthlyRateCents ?? 1100, label: rateLabel(profile.entryType) })} version={PRO_TERMS_VERSION} />
      </ActionForm>
    </div>
  );
}
