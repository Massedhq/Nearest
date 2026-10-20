import Link from "next/link";
import { ROUTES } from "@/lib/public/site";

/** Calls to action that point at the real sign-up routes. */
export function ProCta({ title = "List your services on Nearest", text }: { title?: string; text?: string }) {
  return (
    <aside className="pub-cta" aria-label="Join Nearest as a professional">
      <h2>{title}</h2>
      <p>{text ?? "Free for new professionals — no monthly membership fee. Keep the booking tools you already use; Nearest connects you with verified students in your city. Spots are limited per service in each city."}</p>
      <div className="pub-cta-row"><Link className="pub-btn" href={ROUTES.proSignUp}>Join Nearest free</Link><Link className="pub-btn ghost" href="/locations#check">Is my city open?</Link><Link className="pub-btn ghost" href="/for-professionals">How it works</Link></div>
    </aside>
  );
}

export function StudentCta({ title = "Find a professional near you", text }: { title?: string; text?: string }) {
  return (
    <aside className="pub-cta" aria-label="Create a student account">
      <h2>{title}</h2>
      <p>{text ?? "Create a free student account, verify you're a student, and book beauty, grooming and self-care with independent professionals near you — at student-friendly prices."}</p>
      <div className="pub-cta-row"><Link className="pub-btn" href={ROUTES.studentSignUp}>Create a student account</Link><Link className="pub-btn ghost" href="/locations#check">Check your city</Link><Link className="pub-btn ghost" href="/student-beauty-services">How it works</Link></div>
    </aside>
  );
}
