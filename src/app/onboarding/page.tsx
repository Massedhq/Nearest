import { redirect } from "next/navigation";
import { getViewer, ensureOwner, clerkContact } from "@/lib/viewer";
import { TopBar } from "@/components/TopBar";
import { Steps } from "@/components/Steps";
import { StudentForm } from "./StudentForm";
import { createStudentFromSignUp } from "./actions";

export const metadata = { title: "Finish your account" };

export default async function Onboarding() {
  // An owner who signed up through the student door still lands in Admin, never as a student.
  const viewer = await ensureOwner(await getViewer());
  if (!viewer) redirect("/sign-in");
  if (viewer.user) redirect("/go");
  const c = await clerkContact();
  if (c?.door === "pro") redirect(c.invite ? `/pro/onboarding?invite=${encodeURIComponent(c.invite)}` : "/pro/onboarding");
  // Normal path: everything was entered on the sign-up screen, so go straight to step 2.
  if (await createStudentFromSignUp()) redirect("/verify");
  // Fallback (e.g. signed up another way): ask for the missing details.
  return (
    <div className="scr light">
      <TopBar title="Welcome to Nearest" />
      <div className="body">
        <Steps at={1} />
        <h1 className="disp h2">A little about you</h1>
        <StudentForm firstName={c?.clerkUser.firstName ?? ""} lastName={c?.clerkUser.lastName ?? ""} />
      </div>
    </div>
  );
}
