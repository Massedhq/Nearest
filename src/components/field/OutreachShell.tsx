import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { FieldTabs } from "./FieldViews";

/** The owner assistant's workspace frame (/outreach): logo, who they work for, tabs, sign out. */
export function OutreachShell({ at, title, name, owner, children }: { at: string; title: string; name: string; owner: string; children: React.ReactNode }) {
  return (
    <main className="scr" style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 40px", boxSizing: "border-box" }}>
      <div className="col" style={{ gap: 18 }}>
        <div className="row between">
          <Image src="/brand/nearest-monogram.png" alt="Nearest" width={44} height={44} />
          <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button" style={{ width: "auto" }}>Sign out</button></SignOutButton>
        </div>
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">{name} · Field team for {owner}</span>
          <h1 className="disp h1" style={{ margin: 0 }}>{title}</h1>
        </div>
        <FieldTabs base="/outreach" at={at} owner={false} />
        {children}
      </div>
    </main>
  );
}
