// Public site (SEO + resource center) — shared constants. Only facts confirmed in the codebase live here.
export const SITE_URL = (process.env.APP_URL || "https://www.usenearest.com").replace(/\/+$/, "");
export const SITE_NAME = "Nearest";
export const SITE_TAGLINE = "Student Beauty, Wellness & Self-Care Booking Platform";
export const SUPPORT_EMAIL = "support@usenearest.com"; // used across the app for help
export const HELLO_EMAIL = "hello@usenearest.com"; // Terms & Privacy questions
export const INSTAGRAM_URL = "https://www.instagram.com/usenearest/"; // the official account linked in the pro app
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
