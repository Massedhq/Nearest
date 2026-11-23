"use client";
import { useEffect } from "react";
import { pingPresence } from "@/app/task-actions";

/** Counts time worked: one ping a minute while the Field team page is open and in front (never in the background). */
export function PresencePing() {
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") pingPresence().catch(() => undefined); };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  return null;
}
