import Link from "next/link";

/** Sub-menu for Professional Outreach. */
export function OutreachNav({ at }: { at: "dashboard" | "prospects" | "add" | "import" | "queue" | "templates" | "conversations" | "review" | "answers" | "broadcasts" | "reports" | "markets" | "contributors" | "screenshots" | "targets" | "build" | "interest" | "growth" }) {
  const items: [typeof at, string, string][] = [["dashboard", "Dashboard", "/admin/outreach"], ["queue", "Queue", "/admin/outreach/queue"], ["templates", "Templates", "/admin/outreach/templates"], ["conversations", "Conversations", "/admin/outreach/conversations"], ["review", "Needs review", "/admin/outreach/review"], ["answers", "AI recruiter", "/admin/outreach/answers"], ["broadcasts", "Broadcasts", "/admin/outreach/broadcasts"], ["reports", "Reports", "/admin/outreach/reports"], ["prospects", "Prospects", "/admin/outreach/prospects"], ["add", "Add prospect", "/admin/outreach/add"], ["screenshots", "Add from screenshots", "/admin/outreach/screenshots"], ["import", "Bulk import", "/admin/outreach/import"], ["build", "Build a profile", "/admin/outreach/build"], ["markets", "Markets", "/admin/outreach/markets"], ["targets", "Where to recruit", "/admin/outreach/targets"], ["interest", "City interest", "/admin/outreach/interest"], ["growth", "Growth report", "/admin/outreach/growth"], ["contributors", "Lead contributors", "/admin/outreach/contributors"]];
  return (
    <div className="chips" style={{ marginBottom: 4 }}>
      {items.map(([k, label, href]) => <Link key={k} href={href} className={`chip${at === k ? " on" : ""}`}>{label}</Link>)}
    </div>
  );
}
