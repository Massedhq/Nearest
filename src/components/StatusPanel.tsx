import { toggleStatus } from "@/app/admin/actions";
import { SETTINGS, STATUS_KEYS } from "@/lib/settings-defaults";
import type { Settings } from "@/lib/settings";

const ON_LABEL: Record<string, [string, string]> = {
  "status.pro_registration": ["Open", "Closed"],
  "status.founding_invitations": ["Open", "Closed"],
  "status.student_registration": ["Open", "Closed"],
  "status.bookings": ["Active", "Paused"],
};

export function StatusPanel({ settings, canEdit }: { settings: Settings; canEdit: boolean }) {
  return (
    <div className="card" style={{ gap: 14 }}>
      <div className="row between"><span className="eyebrow">Marketplace status</span><span className="xs muted">{canEdit ? "Owner only" : "View only"}</span></div>
      {STATUS_KEYS.map((key) => {
        const on = settings[key] === true;
        return (
          <form key={key} action={toggleStatus} className="row between">
            <input type="hidden" name="key" value={key} />
            <span>{SETTINGS[key].label}</span>
            <div className="row">
              <span className={`tag ${on ? "ok" : "bad"}`}>{on ? ON_LABEL[key][0] : ON_LABEL[key][1]}</span>
              <button className={`toggle${on ? " on" : ""}`} type="submit" disabled={!canEdit} aria-label={`Turn ${SETTINGS[key].label} ${on ? "off" : "on"}`} aria-pressed={on} />
            </div>
          </form>
        );
      })}
    </div>
  );
}
