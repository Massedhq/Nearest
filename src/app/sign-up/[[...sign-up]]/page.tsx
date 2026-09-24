import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TopBar } from "@/components/TopBar";
import { Steps } from "@/components/Steps";
import { StudentSignUpForm } from "@/components/StudentSignUpForm";
import { getFlag } from "@/lib/settings";

export const metadata = { title: "Create account" };

export default async function StudentSignUp() {
  const { userId } = await auth();
  if (userId) redirect("/go");
  const open = await getFlag("status.student_registration");
  return (
    <div className="scr light">
      <TopBar title="Welcome to Nearest" back="/" />
      <div className="body">
        <Steps at={1} />
        {open ? (
          <StudentSignUpForm />
        ) : (
          <div className="card warn"><span className="b">Registration is closed right now.</span><span className="small muted">Check back soon.</span></div>
        )}
      </div>
    </div>
  );
}
