import { GUIDES } from "@/content/guides";
import { PUBLIC_PAGES, SITE_URL, SITE_TAGLINE, SUPPORT_EMAIL } from "@/lib/public/site";

export const revalidate = 86400;

/**
 * llms.txt — an optional, experimental summary for AI tools. It isn't a ranking signal or a substitute for the
 * crawlable HTML pages it links to.
 */
export function GET() {
  const body = [
    `# Nearest — ${SITE_TAGLINE}`,
    "",
    "> Nearest (usenearest.com) is a booking platform that connects verified students with independent beauty, wellness and self-care professionals — high school, college, trade school and online students — at student-friendly prices. It is open to professionals and students nationwide and activates city by city: appointments are bookable only in cities where professionals are live, and each service category opens with a limited number of professional spots per city. New professionals list free with no monthly membership fee. Nearest is not affiliated with any school or school district.",
    "",
    "## Key pages",
    ...PUBLIC_PAGES.map((p) => `- [${p.slice(1).replace(/-/g, " ")}](${SITE_URL}${p})`),
    "",
    "## Guides",
    ...GUIDES.map((g) => `- [${g.title}](${SITE_URL}/resources/${g.slug}): ${g.description}`),
    "",
    "## Contact",
    `- Support: ${SUPPORT_EMAIL}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
