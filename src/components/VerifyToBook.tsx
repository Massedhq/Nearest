"use client";
import { useState } from "react";
import Link from "next/link";

/** Not verified yet: a greyed-out Book button that points them to finish verifying. */
export function VerifyToBook({ href }: { href: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
      <button className="btn dis sm" type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>Book</button>
      {open && (
        <span role="status" className="card small" style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 230, zIndex: 5, gap: 4, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          <span className="b">Verify your student account to book.</span>
          <Link className="link small" href={href}>Finish verifying</Link>
        </span>
      )}
    </span>
  );
}
