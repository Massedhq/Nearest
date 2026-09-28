import Image from "next/image";
import { Icon } from "./Icon";

export const NEAREST_INSTAGRAM = "https://www.instagram.com/usenearest/";

/** Invite professionals to follow Nearest on Instagram so we can tag and feature them. */
export function FollowNearest() {
  return (
    <a href={NEAREST_INSTAGRAM} target="_blank" rel="noopener noreferrer" className="card pearl" style={{ textDecoration: "none", gap: 10 }}>
      <div className="row" style={{ gap: 12 }}>
        <div style={{ position: "relative", width: 48, height: 48, flex: "none" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={48} height={48} style={{ borderRadius: 24, background: "#000" }} />
          <span style={{ position: "absolute", right: -4, bottom: -4, width: 24, height: 24, borderRadius: 12, background: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="insta" size="s" /></span>
        </div>
        <div className="col grow" style={{ gap: 2 }}>
          <span className="b">Nearest</span>
          <span className="xs muted">@usenearest on Instagram</span>
        </div>
        <span className="btn sm" style={{ background: "#0A0A0A", color: "#ECE8E1" }}>Follow</span>
      </div>
      <span className="small">Follow us so we can tag you and feature your work to students on Nearest&apos;s Instagram.</span>
    </a>
  );
}
