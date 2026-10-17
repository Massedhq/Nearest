"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ProTermsAgreement } from "@/components/ProTermsAgreement";
import { acceptUpdatedProTerms } from "@/app/pro/terms-actions";

type Section = { h: string; p: string[] };

/**
 * One update in Business → Updates. Tap Open: it fills the screen with what changed and the full Professional Terms.
 * There is no close button, Escape and the back button don't close it — it closes only after the professional ticks
 * the acknowledgment and accepts.
 */
export function UpdateViewer({ title, date, changes, sections, version }: { title: string; date: string; changes: string[]; sections: Section[]; version: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    // Keep the back button from leaving while it's open.
    history.pushState({ nearestUpdate: true }, "");
    const stay = () => history.pushState({ nearestUpdate: true }, "");
    window.addEventListener("popstate", stay);
    return () => { window.removeEventListener("popstate", stay); document.body.style.overflow = ""; };
  }, [open]);
  return (
    <>
      <div className="card warn" style={{ gap: 8 }}>
        <div className="row between" style={{ gap: 8 }}><span className="b">{title}</span><span className="tag warn">Needs your acknowledgment</span></div>
        <span className="xs muted">{date}</span>
        <button className="btn sm" type="button" onClick={() => setOpen(true)} style={{ alignSelf: "flex-start" }}>Open</button>
      </div>
      {open && (
        <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0A0A0A", overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <div className="body" style={{ maxWidth: 640, margin: "0 auto", padding: "24px 16px 48px", gap: 14 }}>
            <span className="eyebrow">{date}</span>
            <h1 className="disp h2" style={{ margin: 0 }}>{title}</h1>
            <div className="card" style={{ gap: 6 }}>
              <span className="b small">What changed</span>
              <ul className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
            </div>
            <span className="small">Read the full Professional Terms below, then tick the box and accept. This screen closes once you&apos;ve acknowledged it.</span>
            <ActionForm action={acceptUpdatedProTerms} submitLabel="Acknowledge and accept" buttonClass="btn"
              afterOk={<Link className="btn ghost" href="/pro/updates" onClick={() => setOpen(false)}>Done</Link>}>
              <ProTermsAgreement sections={sections} version={version} />
            </ActionForm>
          </div>
        </div>
      )}
    </>
  );
}
