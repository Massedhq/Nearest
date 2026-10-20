import Link from "next/link";
import { ROUTES } from "@/lib/public/site";

/** Calls to action that point at the real sign-up routes. */
export function ProCta({ title = "List your services on Nearest", text }: { title?: string; text?: string }) {
  return (
    <aside className="pub-cta" aria-label="Join Nearest as a professional">
      <h2>{title}</h2>
      <p>{text ?? "Free for new professionals — no monthly membership fee. Keep the booking tools you already use; Nearest adds a student audience in the cities where it's live."}</p>
      <div className="pub-cta-row"><Link className="pub-btn" href={ROUTES.proSignUp}>Join as a professional</Link><Link className="pub-btn ghost" href="/for-professionals">How it works</Link></div>
    </aside>
  );
}

export function StudentCta({ title = "Find a professional near you", text }: { title?: string; text?: string }) {
  return (
    <aside className="pub-cta" aria-label="Create a student account">
      <h2>{title}</h2>
      <p>{text ?? "Nearest is for verified students in the cities where it's live. Create an account, verify you're a student, and book with independent professionals near you."}</p>
      <div className="pub-cta-row"><Link className="pub-btn" href={ROUTES.studentSignUp}>Create a student account</Link><Link className="pub-btn ghost" href="/locations">Where Nearest is live</Link></div>
    </aside>
  );
}
