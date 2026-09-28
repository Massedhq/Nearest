"use client";
import { PasswordInput } from "./PasswordInput";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

const msg = (e: { longMessage?: string; message: string } | null) => (e ? e.longMessage ?? e.message : "");

/** Professional sign-up: email + password → 6-digit email code → name and birthday (existing next step). */
export function ProSignUpForm({ invite, refCode, redirectTo }: { invite: string | null; refCode: string | null; redirectTo: string }) {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const [stage, setStage] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [wait, setWait] = useState(0);
  const busy = fetchStatus === "fetching";
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  async function sendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) { setError(msg(error)); return false; }
    setWait(45);
    return true;
  }

  async function onDetails(form: FormData) {
    setError("");
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (form.get("agree") !== "on") return setError("Please agree to the Terms and Privacy Policy.");
    const { error } = await signUp.password({
      emailAddress, password, legalAccepted: true,
      unsafeMetadata: { door: "pro", ...(invite ? { invite } : {}), ...(refCode ? { ref: refCode } : {}) },
    });
    if (error) return setError(msg(error));
    setEmail(emailAddress);
    if (await sendCode()) setStage("code");
  }

  async function onCode() {
    setError("");
    if (signUp.unverifiedFields.includes("email_address")) {
      const c = code.replace(/\D/g, "");
      if (c.length !== 6) return setError("Enter the 6-digit code.");
      const { error } = await signUp.verifications.verifyEmailCode({ code: c });
      if (error && !/already been verified/i.test(msg(error))) return setError(msg(error));
    }
    if (signUp.status !== "complete" && signUp.missingFields.includes("username")) {
      const local = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "pro";
      for (let i = 0; i < 4; i++) { const { error } = await signUp.update({ username: `${local.padEnd(4, "0")}_${Math.random().toString(36).slice(2, 7)}` }); if (!error) break; }
    }
    if (signUp.status !== "complete") return setError(`Sign-up still needs: ${signUp.missingFields.join(", ") || "unknown"}.`);
    const res = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl(redirectTo);
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
        <div className="field"><label htmlFor="pro-code">6-digit code</label><input id="pro-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus /></div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" type="button" disabled={busy} onClick={onCode}>{busy ? "Checking…" : signUp.unverifiedFields.includes("email_address") ? "Verify" : "Finish creating my account"}</button>
        <div className="row between small">
          <button type="button" className="link small" onClick={() => { setStage("details"); setCode(""); }}>Change email</button>
          <button type="button" className="link small" disabled={wait > 0 || busy} onClick={() => sendCode()}>{wait > 0 ? `Resend code (0:${String(wait).padStart(2, "0")})` : "Resend code"}</button>
        </div>
      </div>
    );
  }

  return (
    <form action={onDetails} className="col" style={{ gap: 14 }}>
      <h2 className="disp h2">Create your account</h2>
      <div className="field"><label htmlFor="pro-email">Email</label><input id="pro-email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="pro-password">Password</label><PasswordInput id="pro-password" name="password" autoComplete="new-password" minLength={8} required /></div>
      <label className="check" style={{ fontSize: 13 }}><input type="checkbox" name="agree" required /><span>I agree to the <Link className="link" href="/terms" target="_blank" style={{ fontSize: "inherit" }}>Terms</Link> and <Link className="link" href="/privacy" target="_blank" style={{ fontSize: "inherit" }}>Privacy Policy</Link></span></label>
      <p className="xs muted p" style={{ margin: 0 }}>We&apos;ll email you a 6-digit code to verify your account. Your email is never shown to customers.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div id="clerk-captcha" />
      <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Continue"}</button>
      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Already have an account? <Link className="link" href="/pro/sign-in">Sign in</Link></p>
    </form>
  );
}
