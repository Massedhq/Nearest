"use client";
import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import { PasswordInput } from "./PasswordInput";
import { claimBuiltProfile } from "@/app/pro/claim-actions";

/**
 * Claim link: the professional creates a password (8+ characters) and is signed straight in — no code — then
 * accepts the Professional Terms on the next screen.
 */
export function ClaimProfileForm({ token, email }: { token: string; email: string }) {
  const { signIn } = useSignIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [signInHref, setSignInHref] = useState("");

  async function submit(form: FormData) {
    setError(""); setSignInHref("");
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      const r = await claimBuiltProfile(token, password);
      if (!r.ticket) { setError(r.error ?? "Something went wrong. Try again."); if (r.signIn) setSignInHref(r.signIn); setBusy(false); return; }
      const t = await signIn.ticket({ ticket: r.ticket });
      if (!t.error && signIn.status === "complete") {
        const f = await signIn.finalize({ navigate: ({ decorateUrl }) => { window.location.href = decorateUrl("/pro/welcome"); } });
        if (!f.error) return;
      }
      // Password is saved — if this browser can't finish the automatic sign-in, signing in normally works.
      setError("Your password is saved. Sign in with your email and the password you just made to finish.");
      setSignInHref("/pro/sign-in");
      setBusy(false);
    } catch (e) {
      console.error(e);
      setError("Something went wrong. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="col" style={{ gap: 14 }}>
      <div className="field"><label htmlFor="cl-email">Email</label><input id="cl-email" type="email" value={email} readOnly autoComplete="username" /></div>
      <div className="field">
        <label htmlFor="cl-password">Create a password</label>
        <PasswordInput id="cl-password" name="password" autoComplete="new-password" minLength={8} required />
        <span className="xs muted">8 or more characters. You can also sign in later with a code we email you instead.</span>
      </div>
      <div className="field"><label htmlFor="cl-confirm">Type it again</label><PasswordInput id="cl-confirm" name="confirm" autoComplete="new-password" minLength={8} required /></div>
      {error && <p className="err" role="alert">{error}</p>}
      {signInHref && <a className="btn ghost" href={signInHref}>Go to sign in</a>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Setting up…" : "Create password and continue"}</button>
    </form>
  );
}
