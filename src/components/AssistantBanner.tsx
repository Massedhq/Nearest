import Link from "next/link";
import { stopAssisting } from "@/app/pro/assistant-actions";

/** Shown on every /pro page while a partner's assistant is managing that partner's account. */
export function AssistantBanner({ business, assistant }: { business: string; assistant: string }) {
  return (
    <div role="status" style={{ position: "sticky", top: 0, zIndex: 50, background: "#E8C4C0", color: "#0A0A0A", padding: "10px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", fontSize: 14 }}>
      <span style={{ flex: 1, minWidth: 180 }}><b>You&apos;re managing {business}</b> as {assistant}. Changes show as made by you.</span>
      <Link href="/pro/assistant" style={{ background: "#0A0A0A", color: "#ECE8E1", borderRadius: 22, minHeight: 40, padding: "0 16px", display: "inline-flex", alignItems: "center", font: "700 12px var(--font-body), system-ui, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", textDecoration: "none" }}>Assistant home</Link>
      <form action={stopAssisting}>
        <button type="submit" style={{ background: "transparent", color: "#0A0A0A", border: "1px solid #0A0A0A", borderRadius: 22, minHeight: 40, padding: "0 16px", font: "700 12px var(--font-body), system-ui, sans-serif", letterSpacing: ".08em", textTransform: "uppercase", cursor: "pointer" }}>Stop</button>
      </form>
    </div>
  );
}
