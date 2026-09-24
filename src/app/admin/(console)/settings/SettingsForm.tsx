"use client";
import { useActionState } from "react";
import { saveSettings, type FormState } from "@/app/admin/actions";
import type { SettingDef } from "@/lib/settings-defaults";

type Row = { key: string; def: SettingDef; value: number | string | boolean };

export function SettingsForm({ groups, canEdit }: { groups: [string, Row[]][]; canEdit: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettings, {});
  return (
    <form action={action} className="col g16">
      <div className="grid3" style={{ gap: 18 }}>
        {groups.map(([group, rows]) => (
          <fieldset key={group} className="card" style={{ margin: 0 }} disabled={!canEdit}>
            <legend className="eyebrow" style={{ padding: 0, float: "left", marginBottom: 6 }}>{group}</legend>
            {rows.map(({ key, def, value }) => {
              const shown = def.type === "cents" ? (Number(value) / 100).toFixed(2) : String(value);
              return (
                <div key={key} className="row between" style={{ padding: "6px 0", clear: "both" }}>
                  <label className="small" htmlFor={key}>{def.label}{def.unit ? ` (${def.unit})` : def.type === "cents" ? " ($)" : ""}</label>
                  <input id={key} name={key} className="ainput num" style={{ width: 110, textAlign: "right" }} type={def.type === "time" ? "time" : "text"} inputMode={def.type === "time" ? undefined : "decimal"} defaultValue={shown} />
                </div>
              );
            })}
          </fieldset>
        ))}
      </div>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {state.ok && <p className="okmsg" role="status">{state.ok}</p>}
      <div className="row">
        <button className="btn" type="submit" disabled={!canEdit || pending} style={{ maxWidth: 260 }}>{pending ? "Saving…" : "Save changes"}</button>
        <span className="xs muted">{canEdit ? "Every change is written to the activity log." : "Only an owner can change rules."}</span>
      </div>
    </form>
  );
}
