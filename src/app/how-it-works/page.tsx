import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { GuideView } from "@/components/GuideView";
import { guideFor } from "@/lib/guide";

export const metadata = { title: "How Nearest works" };

// Public guide (no sign-in): for students, parents and professionals deciding whether to join.
export default async function HowItWorks({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const forPro = (await searchParams).for === "pro";
  const sections = await guideFor(forPro ? "pro" : "student");
  return (
    <div className="scr">
      <TopBar title="How Nearest works" back={forPro ? "/pro" : "/"} />
      <div className="body">
        <h1 className="disp h1">How Nearest works</h1>
        <div className="guide-tabs" role="tablist" aria-label="Guide for">
          <Link className={`chip${forPro ? "" : " on"}`} href="/how-it-works" role="tab" aria-selected={!forPro}>Students &amp; parents</Link>
          <Link className={`chip${forPro ? " on" : ""}`} href="/how-it-works?for=pro" role="tab" aria-selected={forPro}>Professionals</Link>
        </div>
        <GuideView
          sections={sections}
          intro={forPro
            ? "How professionals join, get booked and get paid on Nearest. Tap a question to open it."
            : "How students find and book verified beauty professionals — and how Nearest keeps them safe. Tap a question to open it."}
        />
        <Link className="btn" href={forPro ? "/pro" : "/sign-up"}>{forPro ? "Get started as a professional" : "Create a student account"}</Link>
      </div>
    </div>
  );
}
