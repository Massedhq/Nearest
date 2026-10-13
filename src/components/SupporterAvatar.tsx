/** Circular portrait (only when the supporter allowed it) or their initials. Ivory ring on black, no box. */
export function SupporterAvatar({ id, portrait, initials, size }: { id: string; portrait: boolean; initials: string; size: number }) {
  const ring = { width: size, height: size, borderRadius: size / 2, border: "1.5px solid #ECE8E1", flex: "none" } as const;
  if (portrait) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/supporters/portrait/${id}`} alt="" width={size} height={size} style={{ ...ring, objectFit: "cover" }} />;
  }
  return (
    <span aria-hidden="true" className="disp" style={{ ...ring, display: "flex", alignItems: "center", justifyContent: "center", fontSize: Math.round(size * 0.34), color: "#ECE8E1", background: "#0A0A0A" }}>
      {initials}
    </span>
  );
}
