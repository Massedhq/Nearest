import Link from "next/link";
import { abs } from "@/lib/public/site";
import { JsonLd } from "./JsonLd";

/** Visible breadcrumb trail + BreadcrumbList structured data. The last item is the current page. */
export function Breadcrumbs({ items }: { items: { name: string; href: string }[] }) {
  const all = [{ name: "Home", href: "/" }, ...items];
  return (
    <>
      <nav aria-label="Breadcrumb" className="pub-crumbs">
        <ol>
          {all.map((c, i) => (
            <li key={c.href}>{i < all.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: all.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.href) })) }} />
    </>
  );
}
