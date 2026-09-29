"use client";
import { useEffect, useState } from "react";

/** Live elapsed time since the service started (mm:ss, or h:mm:ss). */
export function ServiceTimer({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const text = h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  return <span className="disp" style={{ fontSize: 64, lineHeight: 1, textAlign: "center" }} aria-live="off" aria-label={`Elapsed ${h} hours ${m} minutes`}>{text}</span>;
}
