import { RepDemo } from "@/components/rep-demo/RepDemo";

export const metadata = {
  title: "Nearest sales rep dashboard — demo",
  description: "A demo of the Nearest sales rep dashboard with sample data: sales link, sign-ups, professionals by status, cities and categories, earnings and the Campaign Guide.",
  robots: { index: false, follow: false },
};

/** Public demo (sample data only): the sales rep dashboard, for prospective reps. Separate from the partner program. */
export default function RepDashboardDemo() {
  return <RepDemo />;
}
