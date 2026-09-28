import Image from "next/image";
import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { AdminNav } from "@/components/AdminNav";
import { AdminMobileBar } from "@/components/AdminMobileBar";
import { Icon } from "@/components/Icon";
import { requireAdmin } from "@/lib/admin";
import { displayName, initials } from "@/lib/viewer";

export const metadata = { title: { default: "Admin", template: "%s · Nearest Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requireAdmin();
  return (
    <div className="adm">
      <AdminMobileBar />
      <aside className="side" id="admin-menu" aria-label="Admin menu">
        <div className="row" style={{ padding: "0 8px 14px" }}>
          <Image src="/brand/nearest-monogram.png" alt="" width={44} height={44} />
          <div className="col g4"><span className="disp" style={{ fontSize: 20 }}>Nearest</span><span className="xs muted">Administration</span></div>
        </div>
        <AdminNav />
        <div style={{ flex: 1 }} />
        <div style={{ position: "sticky", bottom: -22, background: "#050506", paddingBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <Link className="nav" href="/workspace"><Icon name="switch" />Switch workspace</Link>
          <div className="col" style={{ padding: "12px 8px 0", borderTop: "1px solid #1C1C1F", gap: 10 }}>
            <Link className="row" href="/admin/profile" style={{ textDecoration: "none", color: "inherit" }} aria-label="My profile">
              <div className="avatar sm">{initials(user) || "N"}</div>
              <div className="col g4 grow" style={{ minWidth: 0 }}>
                <span className="small b">{displayName(user) || user.email}</span>
                <span className="xs muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={user.email ?? ""}>{user.email}</span>
                <span className="xs muted">{role === "OWNER" ? "Owner" : role} • <span className="link xs">My profile</span></span>
              </div>
            </Link>
            <SignOutButton redirectUrl="/admin/sign-in"><button className="btn ghost sm" type="button" style={{ width: "100%" }}>Sign out</button></SignOutButton>
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
