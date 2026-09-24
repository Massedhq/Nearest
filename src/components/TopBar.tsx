import Link from "next/link";
import { Icon } from "./Icon";

export function TopBar({ title = "", back }: { title?: string; back?: string }) {
  return (
    <div className="top">
      {back ? (
        <Link className="iconbtn" href={back} aria-label="Back"><Icon name="back" /></Link>
      ) : (
        <span className="sp" />
      )}
      <div className="t">{title}</div>
      <span className="sp" />
    </div>
  );
}
