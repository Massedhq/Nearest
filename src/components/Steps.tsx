/** The 5-segment progress bar used across student sign-up. */
export function Steps({ at, total = 5 }: { at: number; total?: number }) {
  return (
    <div className="steps" aria-label={`Step ${at} of ${total}`}>
      {Array.from({ length: total }, (_, i) => <span key={i} className={i < at ? "on" : ""} />)}
    </div>
  );
}
