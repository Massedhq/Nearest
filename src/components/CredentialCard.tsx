"use client";
import { useState } from "react";
import { Shot } from "./IdCapture";

type Cur = { kind: string; licenseType: string; licenseNumber: string; issuingState: string; expiresOn: string | null; schoolName: string | null; completedOn: string | null; status: string; reviewNote: string | null } | null;

/** One licensed category: "I have my license" or "I just graduated — license pending" (diploma photo or number). */
export function CredentialCard({ id, name, label, cur, hasDiplomaPhoto }: { id: number; name: string; label: string | null; cur: Cur; hasDiplomaPhoto: boolean }) {
  const [mode, setMode] = useState<"license" | "diploma">(cur?.kind === "diploma" ? "diploma" : "license");
  const [photo, setPhoto] = useState("");
  const tag = cur ? (cur.status === "verified" ? "ok" : cur.status === "rejected" ? "bad" : "") : "";
  return (
    <div className="card">
      <input type="hidden" name="categoryId" value={id} />
      <input type="hidden" name={`mode_${id}`} value={mode} />
      <div className="row between"><span className="eyebrow">{name}</span>{cur && <span className={`tag ${tag}`}>{cur.status}</span>}</div>
      {cur?.status === "rejected" && cur.reviewNote && <p className="err">{cur.reviewNote}</p>}
      <div className="grid2" role="radiogroup" aria-label={`${name} credential`} style={{ gap: 6 }}>
        <button type="button" role="radio" aria-checked={mode === "license"} className={`chip${mode === "license" ? " on" : ""}`} onClick={() => setMode("license")}>I have my license</button>
        <button type="button" role="radio" aria-checked={mode === "diploma"} className={`chip${mode === "diploma" ? " on" : ""}`} onClick={() => setMode("diploma")}>Graduated — license pending</button>
      </div>
      {mode === "license" ? (
        <>
          <div className="field"><label htmlFor={`type_${id}`}>License type</label><input id={`type_${id}`} name={`type_${id}`} defaultValue={cur?.kind === "license" ? cur.licenseType : label ?? ""} required /></div>
          <div className="field"><label htmlFor={`number_${id}`}>License number</label><input id={`number_${id}`} name={`number_${id}`} defaultValue={cur?.kind === "license" ? cur.licenseNumber : ""} required /></div>
          <div className="grid2">
            <div className="field"><label htmlFor={`state_${id}`}>Issuing state</label><input id={`state_${id}`} name={`state_${id}`} defaultValue={cur?.issuingState ?? "Texas"} /></div>
            <div className="field"><label htmlFor={`expires_${id}`}>Expiration</label><input id={`expires_${id}`} name={`expires_${id}`} type="date" defaultValue={cur?.kind === "license" ? cur.expiresOn ?? "" : ""} /></div>
          </div>
        </>
      ) : (
        <>
          <span className="xs muted">Finished your program and waiting on your license? Add your diploma or certificate of completion. Nearest reviews it, and your profile shows &quot;Recent graduate — license pending&quot; for {name.toLowerCase()} until you add your license number.</span>
          <div className="field"><label htmlFor={`school_${id}`}>School or program</label><input id={`school_${id}`} name={`school_${id}`} defaultValue={cur?.schoolName ?? ""} required maxLength={120} /></div>
          <div className="grid2">
            <div className="field"><label htmlFor={`completed_${id}`}>Graduation date</label><input id={`completed_${id}`} name={`completed_${id}`} type="date" defaultValue={cur?.completedOn ?? ""} required /></div>
            <div className="field"><label htmlFor={`dipnum_${id}`}>Diploma / certificate number</label><input id={`dipnum_${id}`} name={`dipnum_${id}`} defaultValue={cur?.kind === "diploma" ? cur.licenseNumber : ""} maxLength={40} placeholder="If it has one" /></div>
          </div>
          <Shot name={`diploma_${id}`} label="Photo of your diploma or certificate" hint={hasDiplomaPhoto && !photo ? "Already sent — add a new one to replace it" : "Your name, school and date clearly visible"} facing="environment" value={photo} onPick={setPhoto} icon="file" allowUpload />
          <span className="xs muted">Add the photo, the number, or both.</span>
        </>
      )}
    </div>
  );
}
