"use client";
import { useState } from "react";
import { MAX_PRICE_DOLLARS } from "@/lib/pricing";

/** Clean a typed price: digits and one decimal point, at most 2 decimals. */
export function cleanPrice(v: string) {
  const s = v.replace(/[^0-9.]/g, "");
  const [whole, ...rest] = s.split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

/** True if the price is allowed on Nearest (the $150 student cap). */
export const underCap = (v: string) => !v || Number(v) <= MAX_PRICE_DOLLARS;

/** A dollar box that refuses anything above $150 — the keystroke simply doesn't go in. */
export function PriceInput({ name, id, defaultValue = "", placeholder = "15", label }: { name: string; id: string; defaultValue?: string; placeholder?: string; label: string }) {
  const [value, setValue] = useState(defaultValue);
  const [warn, setWarn] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        inputMode="decimal"
        placeholder={placeholder}
        required
        value={value}
        aria-describedby={`${id}_cap`}
        onChange={(e) => {
          const next = cleanPrice(e.target.value);
          if (!underCap(next)) { setWarn(true); return; } // over $150: ignore the keystroke
          setWarn(false);
          setValue(next);
        }}
      />
      <span id={`${id}_cap`} className={warn ? "err xs" : "xs muted"}>{warn ? `Student prices can't be more than $${MAX_PRICE_DOLLARS}.` : `Up to $${MAX_PRICE_DOLLARS}`}</span>
    </div>
  );
}
