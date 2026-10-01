"use client";
import { useAlreadySignedIn, SignedInBanner, rememberedEmail } from "./AlreadySignedIn";
import { PasswordInput } from "./PasswordInput";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";

const msg = (e: { longMessage?: string; message: string } | null) => (e ? e.longMessage ?? e.message : "");

type Stage = "password" | "code" | "device" | "reset";

/**
 * Nearest's own sign-in (no Clerk branding). Email + password, or a one-time email code instead.
 * Handles Clerk's new-device check (an emailed code) and "Forgot password".
 */
export function NearestSignIn({ signUpHref, signUpLabel = "Create an account", afterSignIn = "/go" }: { signUpHref?: string; signUpLabel?: string; afterSignIn?: string }) {
  const { signIn, fetchStatus } = useSignIn();
  const router = useRouter();
  const alreadySignedIn = useAlreadySignedIn();
  const [stage, setStage] = useState<Stage>("password");
  const [email, setEmail] = useState("");
  useEffect(() => { const e = rememberedEmail(); if (e) setEmail(e); }, []);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [wait, setWait] = useState(0);
  const codeBox = useRef<HTMLInputElement>(null);
  const busy = fetchStatus === "fetching";

  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);
  useEffect(() => { if (stage !== "password") setTimeout(() => codeBox.current?.focus(), 50); }, [stage]);

  async function finish() {
    const res = await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(afterSignIn);
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (res.error) setError(msg(res.error));
  }

  /** After a password or code, either we're in, or Clerk wants a code for this new device. */
  async function next() {
    if (signIn.status === "complete") return finish();
    if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
      setWait(45); setCode(""); setNote(`New device — we emailed a 6-digit code to ${email}.`); setStage("device");
      return;
    }
    setError("Something went wrong signing in. Please try again.");
  }

  async function withPassword(form: FormData) {
    setError(""); setNote("");
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!emailAddress || !password) return setError("Enter your email and password.");
    setEmail(emailAddress);
    await signIn.reset(); // a fresh attempt every time
    let { error } = await signIn.password({ identifier: emailAddress, password });
    if (error && /signed out/i.test(msg(error))) { await signIn.reset(); ({ error } = await signIn.password({ identifier: emailAddress, password })); }
    if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
    await next();
  }

  async function sendLoginCode() {
    setError(""); setNote("");
    const input = document.getElementById("si-email") as HTMLInputElement | null;
    const emailAddress = (input?.value ?? email).trim();
    if (!emailAddress) return setError("Enter your email first.");
    setEmail(emailAddress);
    await signIn.reset();
    let { error } = await signIn.emailCode.sendCode({ emailAddress });
    if (error && /signed out/i.test(msg(error))) { await signIn.reset(); ({ error } = await signIn.emailCode.sendCode({ emailAddress })); }
    if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
    setWait(45); setCode(""); setNote(`We emailed a 6-digit code to ${emailAddress}.`); setStage("code");
  }

  async function startReset() {
    setError(""); setNote("");
    const input = document.getElementById("si-email") as HTMLInputElement | null;
    const emailAddress = (input?.value ?? email).trim();
    if (!emailAddress) return setError("Enter your email first, then tap Forgot password.");
    setEmail(emailAddress);
    await signIn.reset();
    const created = await signIn.create({ identifier: emailAddress });
    if (created.error) { if (!(await alreadySignedIn(msg(created.error)))) setError(msg(created.error)); return; };
    const { error } = await signIn.resetPasswordEmailCode.sendCode();
    if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
    setWait(45); setCode(""); setNewPassword(""); setNote(`We emailed a 6-digit code to ${emailAddress}.`); setStage("reset");
  }

  async function verify() {
    setError("");
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) return setError("Enter the 6-digit code.");
    if (stage === "code") {
      const { error } = await signIn.emailCode.verifyCode({ code: c });
      if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
      return next();
    }
    if (stage === "device") {
      const { error } = await signIn.mfa.verifyEmailCode({ code: c });
      if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
      return next();
    }
    if (stage === "reset") {
      if (newPassword.length < 8) return setError("Choose a new password with at least 8 characters.");
      const v = await signIn.resetPasswordEmailCode.verifyCode({ code: c });
      if (v.error && !/already been verified/i.test(msg(v.error))) { if (!(await alreadySignedIn(msg(v.error)))) setError(msg(v.error)); return; };
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword, signOutOfOtherSessions: true });
      if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
      return next();
    }
  }

  async function resend() {
    setError("");
    const r = stage === "code" ? await signIn.emailCode.sendCode({ emailAddress: email })
      : stage === "device" ? await signIn.mfa.sendEmailCode()
      : await signIn.resetPasswordEmailCode.sendCode();
    if (r.error) { if (!(await alreadySignedIn(msg(r.error)))) setError(msg(r.error)); return; };
    setWait(45);
  }

  if (stage !== "password") {
    return (
      <div className="col" style={{ gap: 14 }}>
        <h2 className="disp h2">{stage === "reset" ? "Reset your password" : "Enter your code"}</h2>
        {note && <p className="small p" style={{ margin: 0 }}>{note}</p>}
        <div className="field">
          <label htmlFor="si-code">6-digit code</label>
          <input id="si-code" ref={codeBox} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </div>
        {stage === "reset" && (
          <div className="field"><label htmlFor="si-newpw">New password</label><PasswordInput id="si-newpw" autoComplete="new-password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        )}
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" type="button" disabled={busy} onClick={verify}>{busy ? "Checking…" : stage === "reset" ? "Save new password" : "Continue"}</button>
        <div className="row between small">
          <button type="button" className="link small" onClick={() => { setStage("password"); setError(""); setNote(""); }}>Back</button>
          <button type="button" className="link small" disabled={wait > 0 || busy} onClick={resend}>{wait > 0 ? `Resend code (0:${String(wait).padStart(2, "0")})` : "Resend code"}</button>
        </div>
      </div>
    );
  }

  return (
    <form action={withPassword} className="col" style={{ gap: 14 }}>
      <h2 className="disp h2">Sign in</h2>
      <SignedInBanner />
      <div className="field"><label htmlFor="si-email">Email</label><input id="si-email" name="email" type="email" autoComplete="email" key={email} defaultValue={email} required /></div>
      <div className="field"><label htmlFor="si-password">Password</label><PasswordInput id="si-password" name="password" autoComplete="current-password" /></div>
      {error && <p className="err" role="alert">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <div className="row between small" style={{ flexWrap: "wrap", gap: 8 }}>
        <button type="button" className="link small" onClick={sendLoginCode} disabled={busy}>Email me a code instead</button>
        <button type="button" className="link small" onClick={startReset} disabled={busy}>Forgot password?</button>
      </div>
      {signUpHref && <p className="small muted" style={{ textAlign: "center", margin: 0 }}>{signUpHref.startsWith("/admin") ? "First time here?" : "New to Nearest?"} <Link className="link" href={signUpHref}>{signUpLabel}</Link></p>}
    </form>
  );
}
