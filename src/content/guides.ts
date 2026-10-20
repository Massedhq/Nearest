// Editorial guides for the public resource center (/resources/[slug]). Content model: plain data, rendered by
// src/app/(public)/resources/[slug]/page.tsx. To add or update a guide: edit or add an entry, keep `updated` honest,
// and add the slug to `related` lists where it helps. No invented statistics, testimonials or ratings.
import { GUIDES_A } from "./guides-a";
import { GUIDES_B } from "./guides-b";

export type Block =
  | string
  | { ul: string[] }
  | { ol: string[] }
  | { copy: string; label?: string }
  | { table: { head: string[]; rows: string[][]; caption?: string } }
  | { note: string };
export type Section = { id: string; h: string; blocks: Block[] };
export type Guide = {
  slug: string;
  title: string; // <title> / headline
  h1: string;
  description: string; // meta description, ~150 characters
  intent: string; // the search intent this page answers (internal)
  topic: "Getting clients" | "Marketing" | "Pricing & operations" | "Listings & visibility" | "Student seasons";
  audience: "pro" | "student";
  published: string; // ISO date the guide first went live
  updated: string;
  summary: string; // the short answer shown at the top
  sections: Section[];
  faq?: { q: string; a: string }[];
  related: string[];
};

export const GUIDES: Guide[] = [...GUIDES_A, ...GUIDES_B];
export const guideBySlug = (slug: string) => GUIDES.find((g) => g.slug === slug) ?? null;
export const TOPICS = ["Getting clients", "Marketing", "Pricing & operations", "Listings & visibility", "Student seasons"] as const;
