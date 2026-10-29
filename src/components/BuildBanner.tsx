import { stopBuilding } from "@/app/admin/build-actions";

/** Shown on every /pro page while a Nearest owner is building a professional's profile for them. */
export function BuildBanner({ userId, name }: { userId: string; name: string }) {
  return (
    <div role="status" style={{ position: "sticky", top: 0, zIndex: 50, background: "#E3C58A", color: "#0A0A0A", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 180 }}><b>Building {name}&apos;s profile.</b> Everything you save goes on their profile. They accept the Terms, verify their ID and set up payouts themselves.</span>
      <form action={stopBuilding}>
        <input type="hidden" name="userId" value={userId} />
        <button type="submit" style={{ background: "#0A0A0A", color: "#ECE8E1", border: 0, borderRadius: 22, minHeight: 44, padding: "0 20px", font: "700 13px var(--font-body), system-ui, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" }}>Back to admin</button>
      </form>
    </div>
  );
}
