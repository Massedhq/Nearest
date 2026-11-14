import Image from "next/image";

/**
 * The digital Nearest GRANTED card (matte black, Nearest logo, GRANTED, debit-card style). It's a Nearest benefit
 * credential, not a bank card. Without `number` it shows only the reward (the wheel result — no number or code is
 * shown before the reward is on an account).
 */
export function GrantedCard({ label, kind, number, code, validThru }: { label: string; kind: string; number?: string; code?: string; validThru?: string }) {
  const grouped = number ? number.replace(/(\d{4})(?=\d)/g, "$1 ") : null;
  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 360, aspectRatio: "1.586 / 1", margin: "0 auto", borderRadius: 18, padding: "16px 18px", boxSizing: "border-box",
      background: "radial-gradient(120% 140% at 0% 0%, #2A2A2D 0%, #121214 45%, #050506 100%)", border: "1px solid #3A3A3E", boxShadow: "0 18px 40px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)",
      color: "#ECE8E1", display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Image src="/brand/nearest-wordmark.png" alt="Nearest" width={104} height={30} style={{ objectFit: "contain", objectPosition: "left" }} />
        <span style={{ font: "800 11px var(--font-body), sans-serif", letterSpacing: "0.32em", color: "#C9C6C0" }}>GRANTED</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ font: "700 26px var(--font-display), serif", letterSpacing: "0.02em" }}>{label}</span>
        <span style={{ font: "600 10px var(--font-body), sans-serif", letterSpacing: "0.18em", color: "#9C9A95", textTransform: "uppercase" }}>{kind === "free" ? "One eligible free service" : "Eligible service"}</span>
      </div>
      {grouped ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
          <span style={{ font: "600 15px ui-monospace, Menlo, monospace", letterSpacing: "0.08em" }}>{grouped}</span>
          <span style={{ textAlign: "right", font: "600 10px var(--font-body), sans-serif", color: "#9C9A95" }}>CODE <b style={{ color: "#ECE8E1", fontSize: 13 }}>{code}</b>{validThru ? <><br />THRU <b style={{ color: "#ECE8E1" }}>{validThru}</b></> : null}</span>
        </div>
      ) : (
        <span style={{ font: "600 12px ui-monospace, Menlo, monospace", letterSpacing: "0.12em", color: "#6E6C68" }}>•••• •••• •••• ••••</span>
      )}
    </div>
  );
}
