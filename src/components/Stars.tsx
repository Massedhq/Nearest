const STAR = "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z";
/** Read-only star display (supporter ratings). */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="row" style={{ gap: 2 }} role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d={STAR} fill={n <= value ? "#ECE8E1" : "none"} stroke="#ECE8E1" strokeWidth="1.4" strokeLinejoin="round" /></svg>
      ))}
    </span>
  );
}
