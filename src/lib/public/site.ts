// Public site (SEO + resource center) — shared constants. Only facts confirmed in the codebase live here.
/**
 * The ONE address search engines should index. usenearest.com (no www) redirects to www, so every canonical link,
 * sitemap entry and structured-data URL must use https://www.usenearest.com — pointing Google at an address that
 * redirects tells it the page isn't the real one. Local/preview builds keep their own APP_URL.
 */
export const CANONICAL_ORIGIN = "https://www.usenearest.com";
export const SITE_URL = (() => {
  const raw = (process.env.APP_URL || CANONICAL_ORIGIN).replace(/\/+$/, "");
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === "usenearest.com" || host === "www.usenearest.com" ? CANONICAL_ORIGIN : raw;
  } catch {
    return CANONICAL_ORIGIN;
  }
})();
export const SITE_NAME = "Nearest";
export const SITE_TAGLINE = "Student Beauty, Wellness & Self-Care Booking Platform";
export const SUPPORT_EMAIL = "support@usenearest.com"; // used across the app for help
export const HELLO_EMAIL = "hello@usenearest.com"; // Terms & Privacy questions
export const INSTAGRAM_URL = "https://www.instagram.com/usenearest/"; // the official account linked in the pro app
export const FACEBOOK_URL = "https://www.facebook.com/usenearest"; // Nearest on Facebook — shown in the rep Campaign Guide ("Follow us")
export const LOGO_PATH = "/brand/nearest-monogram.png";

// Real routes in the app (checked in code) — used for calls to action.
export const ROUTES = {
  studentSignUp: "/sign-up",
  studentSignIn: "/sign-in",
  proLanding: "/pro",
  proSignUp: "/pro/sign-up",
  proSignIn: "/pro/sign-in",
  terms: "/terms",
  privacy: "/privacy",
} as const;

/** Every public resource-center path (proxy exemptions, sitemap, install-banner suppression). */
export const PUBLIC_PAGES = [
  "/about-nearest", "/for-professionals", "/grow-your-beauty-business", "/free-business-listing", "/get-more-clients",
  "/beauty-marketing-resources", "/student-beauty-services", "/resources", "/locations", "/contact", "/faq",
] as const;

export const abs = (path: string) => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
