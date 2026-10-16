import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

/** Top of every Lead Contributor page: the two pages they can use, and Sign out. Plain tabs, no buttons to hunt for. */
export function ContributorNav({ at }: { at: "entry" | "targets" }) {
  const tab = (on: boolean) => ({ padding: "10px 2px", borderBottom: `2px solid ${on ? "#E3C58A" : "transparent"}`, color: on ? "#ECE8E1" : "#9A958D", textDecoration: "none", fontWeight: 600, fontSize: 14 });
  return (
    <div className="col" style={{ gap: 8 }}>
      <div className="row between">
        <Image src="/brand/nearest-monogram.png" alt="Nearest" width={44} height={44} />
        <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button">Sign out</button></SignOutButton>
      </div>
      <nav className="row" style={{ gap: 22, borderBottom: "1px solid #232326" }} aria-label="Lead Contributor pages">
        <Link href="/leads" style={tab(at === "entry")} aria-current={at === "entry" ? "page" : undefined}>Add prospects</Link>
        <Link href="/leads/targets" style={tab(at === "targets")} aria-current={at === "targets" ? "page" : undefined}>Where to recruit</Link>
      </nav>
    </div>
  );
}
