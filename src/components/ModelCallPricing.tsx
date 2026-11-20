"use client";
import { useState } from "react";
import { cleanPrice } from "@/components/PriceInput";

type D = { showOn?: string; price?: string; publicPrice?: string; payMode?: string; deposit?: string };

/**
 * Where a Model Call shows + its prices + how models pay (2026-11-20, owner).
 * Partners pick Student side / Partner page / Both; everyone else is student side only.
 * Student price ≤ $150 with the booking fee; public (partner page) price has no limit.
 * Payment: in full, or a deposit to book (the rest is paid to the pro at the appointment).
 */
export function ModelCallPricing({ partner, fee, cap, d = {} }: { partner: boolean; fee: number; cap: number; d?: D }) {
  const [showOn, setShowOn] = useState(partner ? d.showOn ?? "both" : "student");
  const [price, setPrice] = useState(d.price ?? "");
  const [publicPrice, setPublicPrice] = useState(d.publicPrice ?? "");
  const [mode, setMode] = useState(d.payMode ?? "full");
  const [deposit, setDeposit] = useState(d.deposit ?? "");
  const student = showOn !== "partner", pub = showOn !== "student";
  const $ = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0)}`;
  const shown = (v: string) => (v === "" ? null : Number(v) + fee / 100);
  const over = student && shown(price) !== null && shown(price)! > cap;
  const sides = [student && price !== "" ? Number(price) : null, pub && publicPrice !== "" ? Number(publicPrice) : null].filter((x): x is number => x !== null);
  const lowest = sides.length ? Math.min(...sides) : null;
  return (
    <div className="col" style={{ gap: 12 }}>
      {partner ? (
        <div className="field" style={{ marginBottom: 0 }}>
          <span className="lbl">Where should it show?</span>
          <input type="hidden" name="showOn" value={showOn} />
          <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            {[["student", "Student side"], ["partner", "Partner page"], ["both", "Both"]].map(([v, l]) => (
              <button key={v} type="button" className={`chip${showOn === v ? " on" : ""}`} onClick={() => setShowOn(v)} aria-pressed={showOn === v}>{l}</button>
            ))}
          </div>
          <span className="xs muted">Student side = verified students on Nearest. Partner page = anyone 18+ from your partner link.</span>
        </div>
      ) : <input type="hidden" name="showOn" value="student" />}

      <div className="grid2">
        {student && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="price">Student price ($)</label>
            <input id="price" name="price" inputMode="decimal" placeholder="15" value={price} onChange={(e) => setPrice(cleanPrice(e.target.value))} required />
            <span className={`xs ${over ? "err" : "muted"}`}>{over ? `Students can't be charged over ${$(cap)} — keep your price at ${$(cap - fee / 100)} or less.` : price !== "" ? `Students see ${$(shown(price)!)}` : "0 for free"}</span>
          </div>
        )}
        {pub && (
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="publicPrice">Public price ($)</label>
            <input id="publicPrice" name="publicPrice" inputMode="decimal" placeholder="25" value={publicPrice} onChange={(e) => setPublicPrice(cleanPrice(e.target.value))} required />
            <span className="xs muted">{publicPrice !== "" ? `Your partner page shows ${$(shown(publicPrice)!)}` : "Shown on your partner page — no limit"}</span>
          </div>
        )}
      </div>
      <span className="xs muted" style={{ marginTop: -4 }}>A {$(fee / 100)} booking fee is added to each price shown. You receive your price, minus card processing.</span>

      <div className="field" style={{ marginBottom: 0 }}>
        <span className="lbl">How do models pay?</span>
        <input type="hidden" name="payMode" value={mode} />
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button type="button" className={`chip${mode === "full" ? " on" : ""}`} onClick={() => setMode("full")} aria-pressed={mode === "full"}>Pay in full to book</button>
          <button type="button" className={`chip${mode === "deposit" ? " on" : ""}`} onClick={() => setMode("deposit")} aria-pressed={mode === "deposit"}>Deposit to book</button>
        </div>
        {mode === "deposit" && (
          <div className="field" style={{ marginTop: 8, marginBottom: 0 }}>
            <label htmlFor="deposit">Deposit ($)</label>
            <input id="deposit" name="deposit" inputMode="decimal" placeholder="10" value={deposit} onChange={(e) => setDeposit(cleanPrice(e.target.value))} required />
            <span className="xs muted">
              {deposit !== "" && lowest !== null && Number(deposit) >= lowest ? "The deposit has to be less than your price."
                : deposit !== "" ? `Models pay ${$(Number(deposit) + fee / 100)} now (deposit + booking fee) and the rest to you at the appointment.`
                : "Models pay this + the booking fee to book, and the rest to you at the appointment."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
