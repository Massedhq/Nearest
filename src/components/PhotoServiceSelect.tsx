"use client";
import { useRef } from "react";
import { setPortfolioService } from "@/app/pro/actions";

/** "Which service is this?" under a portfolio photo — saves as soon as it's changed. */
export function PhotoServiceSelect({ id, value, services }: { id: string; value: string | null; services: { id: string; name: string }[] }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={setPortfolioService}>
      <input type="hidden" name="id" value={id} />
      <select name="serviceId" defaultValue={value ?? ""} aria-label="Service shown in this photo" onChange={() => form.current?.requestSubmit()}
        style={{ width: "100%", fontSize: 12, padding: "6px 8px", borderRadius: 10 }}>
        <option value="">Which service is this?</option>
        {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
    </form>
  );
}
