import { RepDemo } from "@/components/partner-demo/RepDemo";

export const metadata = {
  title: "Nearest sales rep dashboard — demo",
  description: "A demo of the Nearest sales rep dashboard with sample data: sales link, sign-ups, professionals by status, cities and categories, earnings and the Campaign Guide.",
  robots: { index: false, follow: false },
};

/** Public demo (sample data only): the sales rep dashboard, for prospective reps and partners. */
export default function RepDashboardDemo() {
  return <RepDemo />;
}
