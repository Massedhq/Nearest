"use client";
import { useAlreadySignedIn, SignedInBanner } from "./AlreadySignedIn";
import { PasswordInput } from "./PasswordInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { isOwnerEmail } from "@/app/admin/owner-signup-actions";

const msg = (e: { longMessage?: string; message: string } | null) => (e ? e.longMessage ?? e.message : "");

/** Owners (Avy, Kisses, Kee) create their own login here — only their @usenearest.com owner emails are accepted. */
export function OwnerSignUpForm() {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const alreadySignedIn = useAlreadySignedIn();
  const [stage, setStage] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const [checking, setChecking] = useState(false);
  const busy = fetchStatus === "fetching" || checking;
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function sendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return false; }
    setWait(45);
    return true;
  }

  async function onDetails(form: FormData) {
    setError("");
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setChecking(true);
    const allowed = await isOwnerEmail(emailAddress);
    setChecking(false);
    if (!allowed) return setError("This email isn't a Nearest owner email. Owner logins can only be created for the owner addresses.");
    const params = { emailAddress, password, legalAccepted: true, unsafeMetadata: { door: "admin" } };
    // Always start a brand-new sign-up (an old, unfinished one is rejected as "signed out").
    await signUp.reset();
    let { error } = await signUp.password(params);
    if (error && /signed out/i.test(msg(error))) { await signUp.reset(); ({ error } = await signUp.password(params)); }
    if (error) {
      if (/taken|already exists/i.test(msg(error))) return setError("There's already a login for this email. Go back and sign in, or use Forgot password.");
      { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
    }
    setEmail(emailAddress);
    if (await sendCode()) setStage("code");
  }

  async function onCode() {
    setError("");
    if (signUp.unverifiedFields.includes("email_address")) {
      const c = code.replace(/\D/g, "");
      if (c.length !== 6) return setError("Enter the 6-digit code.");
      const { error } = await signUp.verifications.verifyEmailCode({ code: c });
      if (error && !/already been verified/i.test(msg(error))) { if (!(await alreadySignedIn(msg(error), (document.querySelector('input[type="email"]') as HTMLInputElement | null)?.value ?? ""))) setError(msg(error)); return; };
    }
    if (signUp.status !== "complete" && signUp.missingFields.includes("username")) {
      const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "owner";
      for (let i = 0; i < 4; i++) { const { error } = await signUp.update({ username: `${local.padEnd(4, "0")}_${Math.random().toString(36).slice(2, 7)}` }); if (!error) break; }
    }
    if (signUp.status !== "complete") return setError(`Sign-up still needs: ${signUp.missingFields.join(", ") || "unknown"}.`);
    const res = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/go");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (res.error) setError(msg(res.error));
  }

  if (stage === "code") {
    return (
      <div className="col" style={{ gap: 14 }}>
        <h2 className="disp h2">Verify your email</h2>
        <p className="small p" style={{ margin: 0 }}>We sent a 6-digit code to <span className="b">{email}</span>.</p>
        <div className="field"><label htmlFor="own-code">6-digit code</label><input id="own-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" type="button" disabled={busy} onClick={onCode}>{busy ? "Checking…" : signUp.unverifiedFields.includes("email_address") ? "Verify" : "Finish setting up my login"}</button>
        <div className="row between small">
          <button type="button" className="link small" onClick={() => { setStage("details"); setCode(""); }}>Change email</button>
          <button type="button" className="link small" disabled={wait > 0 || busy} onClick={() => sendCode()}>{wait > 0 ? `Resend code (0:${String(wait).padStart(2, "0")})` : "Resend code"}</button>
        </div>
      </div>
    );
  }

  return (
    <form action={onDetails} className="col" style={{ gap: 14 }}>
      <h2 className="disp h2">Create your owner login</h2>
      <SignedInBanner />
      <p className="xs muted p" style={{ margin: 0 }}>For Nearest owners only. Use your @usenearest.com owner email.</p>
      <div className="field"><label htmlFor="own-email">Owner email</label><input id="own-email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="own-password">Choose a password</label><PasswordInput id="own-password" name="password" autoComplete="new-password" minLength={8} required /></div>
      {error && <p className="err" role="alert">{error}</p>}
      <div id="clerk-captcha" />
      <button className="btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Already set up? <Link className="link" href="/admin/sign-in">Sign in</Link></p>
    </form>
  );
}
