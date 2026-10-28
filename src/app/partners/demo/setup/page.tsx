import { SetupDemo } from "@/components/partner-demo/SetupDemo";

export const metadata = {
  title: "Nearest Partner demo — how setup works",
  description: "Tap through how a Nearest Partner sets up their page: apply, sign in, page and links, services, portfolio, travel and hours, and sharing.",
  robots: { index: false, follow: true },
};

/** Public demo (sample data): how a partner sets up their page. */
export default function PartnerSetupDemo() {
  return <SetupDemo />;
}
