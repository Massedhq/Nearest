export function AdminHead({ eyebrow, title, right }: { eyebrow: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="ahead">
      <div><p className="eyebrow p">{eyebrow}</p><h1 className="disp" style={{ fontSize: 38, margin: "4px 0 0" }}>{title}</h1></div>
      {right && <div className="row">{right}</div>}
    </div>
  );
}
