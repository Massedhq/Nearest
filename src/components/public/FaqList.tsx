import Link from "next/link";
import type { Faq } from "@/content/faq";

/**
 * Accessible question list: native <details>/<summary> (keyboard + screen-reader friendly, no JavaScript), with the
 * answer in the server HTML so it's readable and crawlable even when collapsed.
 */
export function FaqList({ items, open = false }: { items: Faq[]; open?: boolean }) {
  return (
    <div className="pub-faq">
      {items.map((f) => (
        <details key={f.id} id={f.id} open={open}>
          <summary><h3>{f.q}</h3></summary>
          <div className="pub-faq-a">
            {f.a.map((p, i) => <p key={i}>{p}</p>)}
            {f.tips && f.tips.length > 0 && <ul>{f.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
            {f.link && <p className="pub-more"><Link href={f.link.href}>{f.link.label}</Link></p>}
          </div>
        </details>
      ))}
    </div>
  );
}
