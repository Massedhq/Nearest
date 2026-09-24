import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { AdminNav } from "@/components/AdminNav";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { displayName, initials } from "@/lib/viewer";

export const metadata = { title: { default: "Admin", template: "%s · Nearest Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdmin();
  return (
    <div className="adm">
      <aside className="side">
        <div className="row" style={{ padding: "0 8px 14px" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={44} height={44} />
          <div className="col g4"><span className="disp" style={{ fontSize: 20 }}>Nearest</span><span className="xs muted">Administration</span></div>
        </div>
        <AdminNav />
        <div style={{ flex: 1 }} />
        {user.accountType === "professional" && <Link className="nav" href="/workspace"><Icon name="switch" />Switch workspace</Link>}
        <div className="row" style={{ padding: "12px 8px 0", borderTop: "1px solid #1C1C1F", marginTop: 8 }}>
          <div className="avatar sm">{initials(user) || "N"}</div>
          <div className="col g4 grow"><span className="small b">{displayName(user) || user.email}</span><span className="xs muted">{role}</span></div>
          <SignOutButton redirectUrl="/admin/sign-in"><button className="iconbtn" type="button" aria-label="Sign out" style={{ width: 36, height: 36 }}><Icon name="back" size="s" /></button></SignOutButton>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
