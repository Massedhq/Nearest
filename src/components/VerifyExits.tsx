import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { Icon } from "./Icon";

/** Ways out of the verification screens while a student can't browse yet: account, guide, sign out. */
export function VerifyExits() {
  return (
    <div className="card" style={{ gap: 0, padding: "4px 14px" }}>
      <span className="eyebrow" style={{ padding: "10px 0 4px" }}>While you&apos;re here</span>
      <Link className="item" href="/account"><Icon name="user" /><span className="grow">My account</span><Icon name="right" size="s" /></Link>
      <Link className="item" href="/guide"><Icon name="sparkle" /><span className="grow">How Nearest works</span><Icon name="right" size="s" /></Link>
      <SignOutButton redirectUrl="/"><button className="item" type="button" style={{ background: "none", border: 0, width: "100%", textAlign: "left", color: "inherit", font: "inherit", cursor: "pointer" }}><Icon name="switch" /><span className="grow">Sign out</span></button></SignOutButton>
    </div>
  );
}
