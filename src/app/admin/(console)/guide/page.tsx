import { AdminHead } from "@/components/AdminHead";
import { GuideView } from "@/components/GuideView";
import { requireAdmin } from "@/lib/admin";
import { guideFor } from "@/lib/guide";

export const metadata = { title: "How it works" };

export default async function AdminGuide() {
  await requireAdmin();
  const sections = await guideFor("admin");
  return (
    <>
      <AdminHead eyebrow="Every admin section, explained" title="How it works" />
      <div style={{ maxWidth: 760 }}>
        <GuideView sections={sections} intro="What each part of the admin console does. Numbers come straight from Rules & Settings. The student and professional guides are inside the app only: Account → How Nearest works (students) and Business → How Nearest works (pros)." />
      </div>
    </>
  );
}
