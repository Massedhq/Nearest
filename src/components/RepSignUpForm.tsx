"use client";
import { useAlreadySignedIn, SignedInBanner } from "./AlreadySignedIn";
import { PasswordInput } from "./PasswordInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

const msg = (e: { longMessage?: string; message: string } | null) => (e ? e.longMessage ?? e.message : "");

/** Sales rep sign-up: the email is the one the invitation was sent to and can't be changed. */
export function RepSignUpForm({ email, token, firstName, lastName }: { email: string; token: string; firstName: string; lastName: string }) {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const alreadySignedIn = useAlreadySignedIn();
  const [stage, setStage] = useState<"details" | "code">("details");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const busy = fetchStatus === "fetching";
  const accept = `/api/rep/accept?token=${encodeURIComponent(token)}`;
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function sendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) { if (!(await alreadySignedIn(msg(error), email))) setError(msg(error)); return false; }
    setWait(45);
    return true;
  }

  async function onDetails(form: FormData) {
    setError("");
    const password = String(form.get("password") ?? "");
    const first = String(form.get("first") ?? "").trim();
    const last = String(form.get("last") ?? "").trim();
    if (!first || !last) return setError("Enter your first and last name.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    const params = { emailAddress: email, password, firstName: first, lastName: last, legalAccepted: true, unsafeMetadata: { door: "rep", repToken: token } };
    await signUp.reset();
    let { error } = await signUp.password(params);
    if (error && /signed out/i.test(msg(error))) { await signUp.reset(); ({ error } = await signUp.password(params)); }
    if (error) {
      if (/taken|already exists/i.test(msg(error))) return setError("There's already a Nearest login for this email. Sign in below instead — your dashboard opens after.");
      if (!(await alreadySignedIn(msg(error), email))) setError(msg(error));
      return;
    }
    if (await sendCode()) setStage("code");
  }

  async function onCode() {
    setError("");
    if (signUp.unverifiedFields.includes("email_address")) {
      const c = code.replace(/\D/g, "");
      if (c.length !== 6) return setError("Enter the 6-digit code.");
      const { error } = await signUp.verifications.verifyEmailCode({ code: c });
      if (error && !/already been verified/i.test(msg(error))) { if (!(await alreadySignedIn(msg(error), email))) setError(msg(error)); return; }
    }
    if (signUp.status !== "complete" && signUp.missingFields.includes("username")) {
      const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "rep";
      for (let i = 0; i < 4; i++) { const { error } = await signUp.update({ username: `${local.padEnd(4, "0")}_${Math.random().toString(36).slice(2, 7)}` }); if (!error) break; }
    }
    if (signUp.status !== "complete") return setError(`Sign-up still needs: ${signUp.missingFields.join(", ") || "unknown"}.`);
    const res = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(accept);
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
        <div className="field"><label htmlFor="rep-code">6-digit code</label><input id="rep-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" type="button" disabled={busy} onClick={onCode}>{busy ? "Checking…" : "Verify and open my dashboard"}</button>
        <button type="button" className="link small" disabled={wait > 0 || busy} onClick={() => sendCode()}>{wait > 0 ? `Resend code (0:${String(wait).padStart(2, "0")})` : "Resend code"}</button>
      </div>
    );
  }

  return (
    <form action={onDetails} className="col" style={{ gap: 14 }}>
      <h2 className="disp h2">Create your account</h2>
      <SignedInBanner />
      <div className="field"><label htmlFor="rep-email">Email</label><input id="rep-email" type="email" value={email} readOnly aria-readonly="true" style={{ opacity: 0.75 }} /></div>
      <span className="xs muted" style={{ marginTop: -8 }}>Your account uses the email your invitation was sent to.</span>
      <div className="grid2">
        <div className="field"><label htmlFor="rep-first">First name</label><input id="rep-first" name="first" defaultValue={firstName} autoComplete="given-name" required /></div>
        <div className="field"><label htmlFor="rep-last">Last name</label><input id="rep-last" name="last" defaultValue={lastName} autoComplete="family-name" required /></div>
      </div>
      <div className="field"><label htmlFor="rep-password">Choose a password</label><PasswordInput id="rep-password" name="password" autoComplete="new-password" minLength={8} required /></div>
      {error && <p className="err" role="alert">{error}</p>}
      <div id="clerk-captcha" />
      <button className="btn" type="submit" disabled={busy}>{busy ? "Checking…" : "Continue"}</button>
      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Already have a Nearest login with this email? <Link className="link" href={`/sign-in?redirect_url=${encodeURIComponent(accept)}`}>Sign in</Link></p>
    </form>
  );
}
