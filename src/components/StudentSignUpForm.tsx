"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";

const msg = (e: { longMessage?: string; message: string } | null) => (e ? e.longMessage ?? e.message : "");

/** Step 1 of student sign-up, matching the M_Signup mockup: all details on one screen, then a 6-digit email code. */
export function StudentSignUpForm() {
  const { signUp, fetchStatus } = useSignUp();
  const router = useRouter();
  const [stage, setStage] = useState<"details" | "code">("details");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [wait, setWait] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const busy = fetchStatus === "fetching";

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode() {
    const { error } = await signUp.verifications.sendEmailCode();
    if (error) { setError(msg(error)); return false; }
    setWait(45);
    return true;
  }

  async function onDetails(form: FormData) {
    setError("");
    const firstName = String(form.get("firstName") ?? "").trim();
    const lastName = String(form.get("lastName") ?? "").trim();
    const dob = String(form.get("dob") ?? "");
    const phone = String(form.get("phone") ?? "").trim();
    const emailAddress = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!firstName || !lastName) return setError("Enter your first and last name.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return setError("Enter your date of birth.");
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    if (form.get("agree") !== "on") return setError("Please agree to the Terms and Privacy Policy.");
    const { error } = await signUp.password({
      emailAddress, password, firstName, lastName, legalAccepted: true,
      unsafeMetadata: { door: "student", dob, phone },
    });
    if (error) return setError(msg(error));
    setEmail(emailAddress);
    if (await sendCode()) setStage("code");
  }

  async function onCode() {
    setError("");
    const code = digits.join("");
    if (code.length !== 6) return setError("Enter all 6 digits.");
    const { error } = await signUp.verifications.verifyEmailCode({ code });
    if (error) return setError(msg(error));
    if (signUp.status !== "complete") {
      return setError(`Sign-up needs more info (${signUp.requiredFields.join(", ") || "unknown"}). In Clerk, make sure Username and Phone number are turned off.`);
    }
    const res = await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/onboarding");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
    if (res.error) setError(msg(res.error));
  }

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code
      const next = clean.slice(0, 6).split("");
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      boxes.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    setDigits((d) => d.map((x, j) => (j === i ? clean : x)));
    if (clean && i < 5) boxes.current[i + 1]?.focus();
  }

  if (stage === "code") {
    return (
      <div className="col g16">
        <h1 className="disp h1">Verify your email</h1>
        <p className="muted p">We sent a 6-digit code to <span className="b" style={{ color: "#ECE8E1" }}>{email}</span>.</p>
        <div className="otp" role="group" aria-label="6-digit code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { boxes.current[i] = el; }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              value={d}
              maxLength={6}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus(); }}
            />
          ))}
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" type="button" disabled={busy} onClick={onCode}>{busy ? "Checking…" : "Verify"}</button>
        <div className="row between small">
          <span className="muted">Didn&apos;t get it? Check spam.</span>
          <button className="link small" type="button" disabled={wait > 0 || busy} onClick={() => sendCode()}>{wait > 0 ? `Resend code (0:${String(wait).padStart(2, "0")})` : "Resend code"}</button>
        </div>
        <button className="link small" type="button" style={{ alignSelf: "center" }} onClick={() => { setStage("details"); setDigits(["", "", "", "", "", ""]); }}>Change email</button>
      </div>
    );
  }

  return (
    <form action={onDetails} className="col" style={{ gap: 14 }}>
      <h1 className="disp h2">Create your account</h1>
      <div className="grid2">
        <div className="field"><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div>
        <div className="field"><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" autoComplete="family-name" required /></div>
      </div>
      <div className="field"><label htmlFor="dob">Date of birth</label><input id="dob" name="dob" type="date" autoComplete="bday" required /></div>
      <div className="field"><label htmlFor="phone">Mobile number (optional)</label><input id="phone" name="phone" type="tel" autoComplete="tel" /></div>
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
      <label className="check" style={{ fontSize: 13 }}><input type="checkbox" name="agree" required />I agree to the Terms and Privacy Policy</label>
      <p className="xs muted p">We&apos;ll email a code to verify your account. Your date of birth, phone and email are never shown publicly.</p>
      {error && <p className="err" role="alert">{error}</p>}
      <div id="clerk-captcha" />
      <button className="btn" type="submit" disabled={busy}>{busy ? "Creating…" : "Continue"}</button>
      <p className="small muted" style={{ textAlign: "center", margin: 0 }}>Already have an account? <Link className="link" href="/sign-in">Sign in</Link></p>
    </form>
  );
}
