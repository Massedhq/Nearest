"use client";
import { useState } from "react";

/** Small "Copy" button for a username or link. */
export function CopyText({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn ghost sm" onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}>
      {done ? "Copied" : label}
    </button>
  );
}
