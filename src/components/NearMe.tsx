"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./Icon";

/**
 * Asks the phone for its location once and keeps a rounded copy (about 100 m) in a cookie on this device
 * for a day, so the app can show "2.4 mi away" and sort nearest first. Nearest never stores it.
 */
export function NearMe({ active, href }: { active: boolean; href: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="col" style={{ gap: 4 }}>
      <button
        type="button"
        className={`card${active ? " pearl" : ""}`}
        style={{ gap: 6, textAlign: "left", cursor: "pointer", font: "inherit", color: "inherit" }}
        aria-pressed={active}
        onClick={() => {
          if (active) { router.push(href.replace(/([?&])sort=near&?/, "$1").replace(/[?&]$/, "")); return; }
          if (!("geolocation" in navigator)) { setErr("This device can't share its location."); return; }
          setBusy(true); setErr("");
          navigator.geolocation.getCurrentPosition(
            (p) => {
              document.cookie = `nearest_loc=${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}; Max-Age=86400; Path=/; SameSite=Lax`;
              setBusy(false);
              router.push(href.includes("?") ? `${href}&sort=near` : `${href}?sort=near`);
            },
            () => { setBusy(false); setErr("Turn on Location Services to sort by distance."); },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
          );
        }}
      >
        <Icon name="pin" /><span className="b">{busy ? "Finding you…" : "Near Me"}</span>
      </button>
      {err && <span className="xs err">{err}</span>}
    </div>
  );
}
