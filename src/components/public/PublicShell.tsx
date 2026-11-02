import Image from "next/image";
import Link from "next/link";
import { FACEBOOK_URL, HELLO_EMAIL, INSTAGRAM_PRO_URL, INSTAGRAM_URL, ROUTES, SUPPORT_EMAIL, TIKTOK_URL } from "@/lib/public/site";

const NAV = [
  { href: "/about-nearest", label: "About" },
  { href: "/for-professionals", label: "Professionals" },
  { href: "/student-beauty-services", label: "Students" },
  { href: "/resources", label: "Resources" },
  { href: "/locations", label: "Locations" },
  { href: "/faq", label: "FAQ" },
];

/** Header, navigation and footer for the public resource center (the app's own screens are untouched). */
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub">
      <a className="pub-skip" href="#main">Skip to content</a>
      <header className="pub-head">
        <div className="pub-wrap pub-head-row">
          <Link href="/about-nearest" className="pub-brand" aria-label="Nearest — about">
            <Image src="/brand/nearest-monogram.png" alt="" width={36} height={36} />
            <span>Nearest</span>
          </Link>
          <nav aria-label="Main" className="pub-nav">
            <ul>{NAV.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}</ul>
          </nav>
          <Link className="pub-btn sm" href={ROUTES.studentSignIn}>Sign in</Link>
        </div>
      </header>
      <main id="main" className="pub-wrap pub-main">{children}</main>
      <footer className="pub-foot">
        <div className="pub-wrap pub-foot-grid">
          <div>
            <p className="pub-foot-brand">Nearest</p>
            <p className="pub-muted">Student Beauty, Wellness &amp; Self-Care Booking Platform · usenearest.com</p>
          </div>
          <nav aria-label="Footer">
            <ul>
              {NAV.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </nav>
          <nav aria-label="Get started">
            <ul>
              <li><Link href={ROUTES.studentSignUp}>Student sign up</Link></li>
              <li><Link href={ROUTES.proSignUp}>Professional sign up</Link></li>
              <li><Link href={ROUTES.terms}>Terms of Service</Link></li>
              <li><Link href={ROUTES.privacy}>Privacy Policy</Link></li>
            </ul>
          </nav>
          <div>
            <p className="pub-muted">Help: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a></p>
            <p className="pub-muted">Terms &amp; privacy: <a href={`mailto:${HELLO_EMAIL}`}>{HELLO_EMAIL}</a></p>
            <p className="pub-muted"><a href={INSTAGRAM_URL} rel="noopener noreferrer" target="_blank">@usenearest on Instagram</a></p>
            <p className="pub-muted"><a href={INSTAGRAM_PRO_URL} rel="noopener noreferrer" target="_blank">@use_nearest for professionals</a></p>
            <p className="pub-muted"><a href={FACEBOOK_URL} rel="noopener noreferrer" target="_blank">Nearest on Facebook</a></p>
            <p className="pub-muted"><a href={TIKTOK_URL} rel="noopener noreferrer" target="_blank">@usenearest on TikTok</a></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
