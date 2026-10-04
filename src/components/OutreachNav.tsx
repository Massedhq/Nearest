import Link from "next/link";

/** Sub-menu for Professional Outreach. */
export function OutreachNav({ at }: { at: "dashboard" | "prospects" | "add" | "import" | "markets" }) {
  const items: [typeof at, string, string][] = [["dashboard", "Dashboard", "/admin/outreach"], ["prospects", "Prospects", "/admin/outreach/prospects"], ["add", "Add prospect", "/admin/outreach/add"], ["import", "Bulk import", "/admin/outreach/import"], ["markets", "Markets", "/admin/outreach/markets"]];
  return (
    <div className="chips" style={{ marginBottom: 4 }}>
      {items.map(([k, label, href]) => <Link key={k} href={href} className={`chip${at === k ? " on" : ""}`}>{label}</Link>)}
    </div>
  );
}
