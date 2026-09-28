"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";

const FIXED = "nearest-stale-session-cleared";
const recentlyFixed = () => Date.now() - Number(sessionStorage.getItem(FIXED) || 0) < 120_000;

/**
 * Sign-in/sign-up pages only render when Nearest's SERVER sees no one signed in (otherwise they redirect to the account).
 * So if Clerk on this device still thinks someone is signed in, that session is stale (e.g. from before a key switch).
 * Clear it automatically and reload the page, ready for a fresh sign-in. Guarded so it can never loop.
 */
async function clearStale(clerk: ReturnType<typeof useClerk>, email?: string) {
  sessionStorage.setItem(FIXED, String(Date.now()));
  if (email) sessionStorage.setItem("nearest-signin-email", email);
  try { await clerk.signOut({ redirectUrl: window.location.href }); } catch { window.location.reload(); }
}

/** For error handling inside the forms: turns "You're already signed in" into an automatic fresh start. */
export function useAlreadySignedIn() {
  const clerk = useClerk();
  return async (message: string, email?: string) => {
    if (!/already signed in|session already exists|already have an active session/i.test(message)) return false;
    if (recentlyFixed()) return false; // already tried once — show the message instead of looping
    await clearStale(clerk, email);
    return true;
  };
}

/** Placed at the top of each form: clears a stale session on arrival, then shows a short note. */
export function SignedInBanner() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [clearing, setClearing] = useState(false);
  const [note, setNote] = useState(false);
  const checked = useRef(false);
  const openedSignedIn = useRef(false);
  useEffect(() => {
    // Only when the page first opens — never react to a sign-in that just succeeded on this page.
    if (!isLoaded || checked.current) return;
    checked.current = true;
    openedSignedIn.current = Boolean(isSignedIn);
    if (isSignedIn && !recentlyFixed()) { setClearing(true); void clearStale(clerk); return; }
    if (!isSignedIn && sessionStorage.getItem(FIXED) && recentlyFixed()) setNote(true);
  }, [isLoaded, isSignedIn, clerk]);
  if (clearing) return <p className="small p" style={{ margin: 0 }}>One moment…</p>;
  if (isSignedIn && !openedSignedIn.current) return null; // just signed in here — the page is moving on
  if (isSignedIn && recentlyFixed() && !clearing) {
    return (
      <div className="col" style={{ gap: 8 }}>
        <p className="small p" style={{ margin: 0 }}>This device still has an old sign-in that needs to be cleared.</p>
        <button type="button" className="btn sm" onClick={() => { sessionStorage.removeItem(FIXED); void clearStale(clerk); }}>Clear it and sign in</button>
      </div>
    );
  }
  return note ? <p className="small p" style={{ margin: 0 }}>Ready — sign in below.</p> : null;
}

/** The email they typed before the automatic reset, so they don't have to type it again. */
export function rememberedEmail() {
  if (typeof window === "undefined") return "";
  const e = sessionStorage.getItem("nearest-signin-email") || "";
  sessionStorage.removeItem("nearest-signin-email");
  return e;
}
