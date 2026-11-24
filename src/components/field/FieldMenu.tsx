"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Field team hamburger menu (2026-11-23): closes the moment a page is tapped (before the new page loads),
 * when you tap anywhere outside it, or press Escape.
 */
export function FieldMenu({ base, on, tabs }: { base: string; on: string; tabs: [string, string][] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);
  useEffect(() => setOpen(false), [on]);
  return (
    <div className="fmenu" ref={box}>
      <button type="button" className="fmenu-btn" aria-expanded={open} aria-label="Field team menu" onClick={() => setOpen((o) => !o)}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} /></svg>
        <span>{tabs.find(([p]) => p === on)?.[1] ?? "Menu"}</span>
      </button>
      {open && (
        <nav aria-label="Field team">
          {tabs.map(([p, l]) => <Link key={p} href={`${base}${p}`} className="ftab" aria-current={on === p ? "page" : undefined} onClick={() => setOpen(false)}>{l}</Link>)}
        </nav>
      )}
    </div>
  );
}
