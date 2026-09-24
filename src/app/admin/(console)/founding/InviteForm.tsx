"use client";
import { useActionState } from "react";
import { createInvite, type FormState } from "@/app/admin/actions";

const CATEGORIES = ["Hair", "Braids", "Locs", "Barber", "Lashes", "Brows", "Nails", "Makeup", "Photography", "Other"];

export function InviteForm({ cities, disabled }: { cities: { id: number; name: string }[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createInvite, {});
  return (
    <form action={action} className="card" style={{ gap: 12 }}>
      <span className="eyebrow">+ Invite professional</span>
      <div className="grid2">
        <div className="field"><label htmlFor="name">Name</label><input id="name" name="name" required /></div>
        <div className="field"><label htmlFor="contact">Email or phone</label><input id="contact" name="contact" required /></div>
        <div className="field"><label htmlFor="cityId">City</label>
          <select id="cityId" name="cityId" required defaultValue="">
            <option value="" disabled>Choose city</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="category">Category</label>
          <select id="category" name="category" required defaultValue="">
            <option value="" disabled>Choose category</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      <div className="row between small">
        <span className="muted">Private code • FOUNDING pricing</span>
        <button className="btn sm" type="submit" disabled={pending || disabled}>{pending ? "Generating…" : "Generate invitation"}</button>
      </div>
    </form>
  );
}
