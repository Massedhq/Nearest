import { ActionForm } from "./ActionForm";
import { deleteAccountAction } from "@/app/admin/people-actions";

/** "Delete" in admin people tables. Opens a small confirm box; nothing happens until DELETE is typed. */
export function DeleteAccount({ userId, name, ownerPro = false }: { userId: string; name: string; ownerPro?: boolean }) {
  return (
    <details>
      <summary className="link small" style={{ cursor: "pointer", color: "#F2A38F" }}>{ownerPro ? "Remove pro business" : "Delete"}</summary>
      <div className="card bad" style={{ gap: 8, marginTop: 8, minWidth: 260 }}>
        <span className="small">
          {ownerPro
            ? `Removes ${name}'s professional business. Their owner login stays.`
            : `Permanently deletes ${name}'s account and login. This can't be undone.`}
        </span>
        <ActionForm action={deleteAccountAction} submitLabel="Delete permanently" buttonClass="btn danger sm">
          <input type="hidden" name="userId" value={userId} />
          <div className="field"><label htmlFor={`del_${userId}`}>Type DELETE to confirm</label><input id={`del_${userId}`} name="confirm" autoComplete="off" /></div>
        </ActionForm>
      </div>
    </details>
  );
}
