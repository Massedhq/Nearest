import { Icon } from "./Icon";

export function ComingSoon({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="soon">
      <Icon name="clock" size="l" />
      <span className="h3" style={{ color: "#ECE8E1" }}>{title}</span>
      <span className="small">Arrives in {phase}.</span>
    </div>
  );
}
