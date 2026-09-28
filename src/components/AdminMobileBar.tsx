"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";

/** Phones/tablets: a slim top bar with a Menu button; the admin menu slides in only when opened. */
export function AdminMobileBar() {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]); // close after picking a page
  useEffect(() => {
    document.body.classList.toggle("admnav-open", open);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); document.body.classList.remove("admnav-open"); };
  }, [open]);
  return (
    <>
      <div className="admtop">
        <div className="row" style={{ gap: 10 }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={32} height={32} />
          <span className="disp" style={{ fontSize: 18 }}>Nearest <span className="xs muted" style={{ fontFamily: "inherit" }}>Admin</span></span>
        </div>
        <button type="button" className="btn ghost sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="admin-menu">{open ? "Close" : "Menu"}</button>
      </div>
      <div className="admscrim" onClick={() => setOpen(false)} aria-hidden="true" />
    </>
  );
}
