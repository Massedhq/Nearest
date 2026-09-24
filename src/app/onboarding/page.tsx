import Image from "next/image";
import { redirect } from "next/navigation";
import { getViewer, ensureOwner, clerkContact } from "@/lib/viewer";
import { TopBar } from "@/components/TopBar";
import { StudentForm } from "./StudentForm";

export const metadata = { title: "Finish your account" };

export default async function Onboarding() {
  // An owner who signed up through the student door still lands in Admin, never as a student.
  const viewer = await ensureOwner(await getViewer());
  if (!viewer) redirect("/sign-in");
  if (viewer.user) redirect("/go");
  const c = await clerkContact();
  if (c?.door === "pro") redirect(c.invite ? `/pro/onboarding?invite=${encodeURIComponent(c.invite)}` : "/pro/onboarding");
  return (
    <div className="scr light">
      <TopBar title="Welcome to Nearest" />
      <div className="body">
        <Image src="/brand/nearest-wordmark-dark.png" alt="Nearest" width={150} height={100} style={{ alignSelf: "center", height: "auto" }} />
        <div className="steps" aria-label="Step 2 of 2"><span className="on" /><span className="on" /></div>
        <h1 className="disp h2">A little about you</h1>
        <StudentForm firstName={c?.clerkUser.firstName ?? ""} lastName={c?.clerkUser.lastName ?? ""} />
      </div>
    </div>
  );
}
