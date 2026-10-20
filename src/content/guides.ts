// Editorial guides for the public resource center (/resources/[slug]). Content model: plain data, rendered by
// src/app/(public)/resources/[slug]/page.tsx. To add or update a guide: edit or add an entry, keep `updated` honest,
// and add the slug to `related` lists where it helps. No invented statistics, testimonials or ratings.
import { GUIDES_A } from "./guides-a";
import { GUIDES_B } from "./guides-b";
import { GUIDES_C } from "./guides-c";

export type Block =
  | string
  | { ul: string[] }
  | { ol: string[] }
  | { copy: string; label?: string }
  | { table: { head: string[]; rows: string[][]; caption?: string } }
  | { note: string }
  // A contextual call to action inside an article. "pro" → professional sign-up + city check; "student" → student
  // sign-up + what's available; "interest" → the city checker. The text must be specific to the article.
  | { cta: "pro" | "student" | "interest"; title: string; text: string };
export type Section = { id: string; h: string; blocks: Block[] };
export type Guide = {
  slug: string;
  title: string; // <title> / headline
  h1: string;
  description: string; // meta description, ~150 characters
  intent: string; // the search intent this page answers (internal)
  topic: "Getting clients" | "Marketing" | "Pricing & operations" | "Listings & visibility" | "Student seasons" | "For students & parents";
  audience: "pro" | "student";
  published: string; // ISO date the guide first went live
  updated: string;
  summary: string; // the short answer shown at the top
  sections: Section[];
  faq?: { q: string; a: string }[];
  related: string[];
  pain?: string; // the reader's problem, in their words (shown above the summary for professional guides)
  endCta?: { title: string; text: string }; // the closing call to action, specific to this article
};

export const GUIDES: Guide[] = [...GUIDES_A, ...GUIDES_B, ...GUIDES_C];
export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
export const TOPICS = ["For students & parents", "Getting clients", "Marketing", "Pricing & operations", "Listings & visibility", "Student seasons"] as const;
