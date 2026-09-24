import Link from "next/link";
import { TopBar } from "./TopBar";
import type { SetupStep } from "@/lib/pro";

/** Frame for each setup step. In edit mode (?edit=1) it returns to My Business instead of the next step. */
export function SetupShell({ steps, current, title, edit, children }: { steps: SetupStep[]; current: string; title: string; edit: boolean; children: React.ReactNode }) {
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="scr">
      <TopBar title={edit ? "Edit" : "Set up your business"} back={edit ? "/pro/business" : "/pro/home"} />
      <div className="body">
        {!edit && (
          <>
            <div className="steps" aria-label={`Step ${idx + 1} of ${steps.length}`}>
              {steps.map((s, i) => <span key={s.key} className={i <= idx ? "on" : ""} />)}
            </div>
            <p className="eyebrow p">Step {idx + 1} of {steps.length} • {steps[idx]?.label}</p>
          </>
        )}
        <h1 className="disp h2">{title}</h1>
        {children}
        {!edit && <Link className="link small" href="/pro/home" style={{ alignSelf: "center" }}>Finish later</Link>}
      </div>
    </div>
  );
}
