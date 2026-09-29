"use client";
import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { Icon } from "./Icon";
import { deleteMyAccount } from "@/app/account-actions";

/** "Delete account" card: locked with the reason when something must be finished first. */
export function DeleteMyAccount({ blocked, owner = false }: { blocked: string | null; owner?: boolean }) {
  const [open, setOpen] = useState(false);
  const title = owner ? "Remove my professional business" : "Delete account";
  return (
    <div className="card" style={{ gap: 8 }}>
      <div className="row between">
        <span className="row small" style={{ gap: 8 }}><Icon name="trash" size="s" /> {title}</span>
        {blocked ? <span className="tag">Locked</span> : !open && <button type="button" className="link small" onClick={() => setOpen(true)}>Start</button>}
      </div>
      {blocked ? <span className="xs muted">{blocked}</span> : open ? (
        <ActionForm action={deleteMyAccount} submitLabel="Delete permanently" buttonClass="btn danger sm">
          <span className="xs muted">{owner ? "Your professional business (services, portfolio, hours) is removed. Your owner login stays." : "Your account, profile and saved info are removed and you'll be signed out. Past appointment and payment records are kept as required."}</span>
          <div className="field"><label htmlFor="confirm-del">Type DELETE to confirm</label><input id="confirm-del" name="confirm" autoCapitalize="characters" autoComplete="off" /></div>
        </ActionForm>
      ) : <span className="xs muted">Permanently remove your account.</span>}
    </div>
  );
}
