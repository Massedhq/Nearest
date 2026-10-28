import { ClientDemo } from "@/components/partner-demo/ClientDemo";

export const metadata = {
  title: "Nearest Partner demo — what clients see",
  description: "Tap through a sample Nearest Partner page: link page, booking profile, booking, Bundle my booking, Model Calls and saving it to your phone.",
  robots: { index: false, follow: true },
};

/** Public demo (sample data): a partner page the way clients see it. */
export default function PartnerClientDemo() {
  return <ClientDemo />;
}
