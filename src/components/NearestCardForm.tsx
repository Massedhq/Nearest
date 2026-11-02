"use client";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { addNearestCard } from "@/app/card-actions";

/** Add a Nearest Card: 16-digit number from the front + the 3 or 4 digit code from the back. */
export function NearestCardForm({ back, label = "Save card to my account" }: { back: string; label?: string }) {
  const [num, setNum] = useState("");
  const [code, setCode] = useState("");
  const show = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
  return (
    <ActionForm action={addNearestCard} submitLabel={label} buttonClass="btn sm" className="col g12">
      <input type="hidden" name="back" value={back} />
      <div className="field">
        <label htmlFor="nc-number">Card number (front, 16 digits)</label>
        <input id="nc-number" name="number" inputMode="numeric" autoComplete="off" placeholder="8877 0000 0000 0000" value={num} onChange={(e) => setNum(show(e.target.value))} required />
      </div>
      <div className="field">
        <label htmlFor="nc-code">Code (back, 3 or 4 digits)</label>
        <input id="nc-code" name="code" inputMode="numeric" autoComplete="off" placeholder="327" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} required style={{ maxWidth: 140 }} />
      </div>
    </ActionForm>
  );
}
