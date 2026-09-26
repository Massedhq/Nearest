"use client";
import { useEffect, useState } from "react";

/**
 * Date of birth typed as MM / DD / YYYY with the number keypad (works on every phone,
 * unlike the built-in date picker). Sends YYYY-MM-DD in a hidden field named "dob".
 */
export function DobInput({ id = "dob", label = "Date of birth", onDate }: { id?: string; label?: string; onDate?: (iso: string) => void }) {
  const [text, setText] = useState("");
  const digits = text.replace(/\D/g, "");
  const mm = digits.slice(0, 2), dd = digits.slice(2, 4), yyyy = digits.slice(4, 8);
  let iso = "";
  if (yyyy.length === 4) {
    const m = Number(mm), d = Number(dd), y = Number(yyyy);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (m >= 1 && m <= 12 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) iso = `${yyyy}-${mm}-${dd}`;
  }
  const bad = digits.length === 8 && !iso;
  useEffect(() => { onDate?.(iso); }, [iso, onDate]);

  function format(v: string) {
    const n = v.replace(/\D/g, "").slice(0, 8);
    if (n.length <= 2) return n;
    if (n.length <= 4) return `${n.slice(0, 2)} / ${n.slice(2)}`;
    return `${n.slice(0, 2)} / ${n.slice(2, 4)} / ${n.slice(4)}`;
  }

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        placeholder="MM / DD / YYYY"
        value={text}
        onChange={(e) => setText(format(e.target.value))}
        aria-invalid={bad || undefined}
        aria-describedby={bad ? `${id}-err` : undefined}
        maxLength={14}
        required
      />
      <input type="hidden" name="dob" value={iso} />
      {bad && <span id={`${id}-err`} className="err">That date doesn&apos;t exist — check the month and day.</span>}
    </div>
  );
}
