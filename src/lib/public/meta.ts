import type { Metadata } from "next";
import { abs } from "./site";

/** Unique title, description and canonical for a public page (Open Graph image comes from src/app/opengraph-image.png). */
export function pageMeta(title: string, description: string, path: string, extra: Partial<Metadata> = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: abs(path) },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: abs(path), siteName: "Nearest", type: "website" },
    twitter: { card: "summary_large_image", title, description },
    ...extra,
  };
}
