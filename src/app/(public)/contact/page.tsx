import Link from "next/link";
import { Breadcrumbs } from "@/components/public/Breadcrumbs";
import { pageMeta } from "@/lib/public/meta";
import { HELLO_EMAIL, INSTAGRAM_URL, ROUTES, SUPPORT_EMAIL } from "@/lib/public/site";

export const metadata = pageMeta("Contact Nearest", "How to reach Nearest: support for students and professionals, Terms and privacy questions, and the official Instagram.", "/contact");

export default function Contact() {
  return (
    <div className="pub-article">
      <Breadcrumbs items={[{ name: "Contact", href: "/contact" }]} />
      <h1>Contact Nearest</h1>
      <h2>Help with an account or booking</h2>
      <p>Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. If you&apos;re signed in, you can also report a problem from inside the app — it includes the details we need. For an issue at an appointment, use Report a problem on the appointment page.</p>
      <h2>Terms and privacy</h2>
      <p>Questions about the <Link href={ROUTES.terms}>Terms of Service</Link> or <Link href={ROUTES.privacy}>Privacy Policy</Link>: <a href={`mailto:${HELLO_EMAIL}`}>{HELLO_EMAIL}</a>.</p>
      <h2>Social</h2>
      <p>Nearest&apos;s official Instagram is <a href={INSTAGRAM_URL} rel="noopener noreferrer" target="_blank">@usenearest</a>.</p>
      <h2>Before you write</h2>
      <ul>
        <li>Professionals: see <Link href="/for-professionals">how Nearest works for professionals</Link>.</li>
        <li>Students and parents: see <Link href="/student-beauty-services">student services</Link> and the <Link href="/faq#students-parents">student FAQ</Link>.</li>
      </ul>
    </div>
  );
}
