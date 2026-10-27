import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/public/site";

/**
 * Crawlers may read the public site; account areas are excluded. (Private pages are protected by sign-in on the
 * server — robots.txt is only a crawl hint, never security.)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/", "/admin", "/pro/", "/sign-in", "/sign-up", "/go", "/workspace", "/onboarding", "/verify", "/home", "/account", "/book", "/bookings",
        "/bundle", "/campaign", "/connections", "/credits", "/favorites", "/messages", "/notifications", "/model-calls", "/appeal", "/guide", "/p/",
        "/leads", "/rep", "/r/", "/guardian/", "/unsubscribe/", "/invite-expired", "/not-authorized", "/supporters/invite/", "/supporters/manage/", "/ocr/", "/meet",
      ],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
