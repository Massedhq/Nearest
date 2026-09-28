"use client";
import { useState } from "react";

/** Password box with a Show / Hide button so people can check what they typed. */
export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={show ? "text" : "password"} style={{ ...(props.style ?? {}), paddingRight: 72, width: "100%" }} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="link small"
        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: 0, cursor: "pointer" }}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
