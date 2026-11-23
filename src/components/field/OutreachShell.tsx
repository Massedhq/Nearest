import Image from "next/image";
import { SignOutButton } from "@clerk/nextjs";
import { FieldTabs } from "./FieldViews";
import { PresencePing } from "./PresencePing";
import { stopViewAs } from "@/app/task-actions";

/**
 * The owner assistant's workspace frame (/outreach): white work screen, logo, who they work for, tabs, sign out.
 * viewAs = an owner looking at the assistant's screen (banner + way back; no time is counted).
 */
export function OutreachShell({ at, title, name, owner, viewAs = false, children }: { at: string; title: string; name: string; owner: string; viewAs?: boolean; children: React.ReactNode }) {
  return (
    <main className="scr ws" style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 40px", boxSizing: "border-box", minHeight: "100dvh" }}>
      <div className="col" style={{ gap: 18, maxWidth: 1100, width: "100%", margin: "0 auto" }}>
        {viewAs && (
          <div className="viewas" role="status">
            <span>You&apos;re seeing {name}&apos;s screen. Anything you send from here is sent as you.</span>
            <form action={stopViewAs}><button className="link xs b" type="submit">Back to my Field team</button></form>
          </div>
        )}
        <div className="row between">
          <Image src="/brand/nearest-monogram.png" alt="Nearest" width={44} height={44} style={{ filter: "invert(1)", borderRadius: 10 }} />
          {!viewAs && <SignOutButton redirectUrl="/"><button className="btn ghost sm" type="button" style={{ width: "auto" }}>Sign out</button></SignOutButton>}
        </div>
        <div className="col" style={{ gap: 4 }}>
          <span className="eyebrow">{name} · Outreach &amp; Marketing · Field team for {owner}</span>
          <h1 className="disp h1" style={{ margin: 0 }}>{title}</h1>
        </div>
        <FieldTabs base="/outreach" at={at} owner={false} />
        {children}
      </div>
      {!viewAs && <PresencePing />}
    </main>
  );
}
