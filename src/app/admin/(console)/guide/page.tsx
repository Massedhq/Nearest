import { AdminHead } from "@/components/AdminHead";
import { GuideView } from "@/components/GuideView";
import { requireAdmin, isMainOwner } from "@/lib/admin";
import { guideFor } from "@/lib/guide";

export const metadata = { title: "How it works" };

export default async function AdminGuide() {
  const { user } = await requireAdmin();
  // Partner pages and Nearest Cards are the main owner's alone, so their topics only show for her.
  const MAIN_ONLY_TOPICS = ["Partner pages (Nearest Partners)", "Adding a partner yourself (setup, finish or approve link)", "Partner shop (downloads and products)", "Nearest Cards", "Money", "Sales Track", "Student Pricing Intelligence", "Public website content audit"];
  const PARTNER_ONLY_TOPICS = ["Your Sales Track earnings"]; // other owners only — the main owner sees the full Sales Track topic
  const main = await isMainOwner(user.id);
  const sections = (await guideFor("admin")).map((sec) => ({ ...sec, topics: main ? sec.topics.filter((t) => !PARTNER_ONLY_TOPICS.includes(t.q)) : sec.topics.filter((t) => !MAIN_ONLY_TOPICS.includes(t.q)) })).filter((sec) => sec.topics.length);
  return (
    <>
      <AdminHead eyebrow="Every admin section, explained" title="How it works" />
      <div style={{ maxWidth: 760 }}>
        <GuideView sections={sections} intro="What each part of the admin console does. Numbers come straight from Rules & Settings. The student and professional guides are inside the app only: Account → How Nearest works (students) and Business → How Nearest works (pros)." />
      </div>
    </>
  );
}
