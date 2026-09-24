/** Graduation year as tappable chips (radio buttons underneath), like the mockup. */
export function GradYears({ name = "graduationYear", value }: { name?: string; value?: number | null }) {
  const year = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => year + i);
  return (
    <fieldset className="col" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
      <legend className="lbl" style={{ marginBottom: 8 }}>Expected graduation</legend>
      <div className="chips">
        {years.map((y) => (
          <label key={y} className="chip chipradio">
            <input type="radio" name={name} value={y} defaultChecked={value === y} required />{y}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
