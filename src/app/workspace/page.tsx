import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignOutButton } from "@clerk/nextjs";
import { db, professionalProfiles } from "@/db";
import { Icon } from "@/components/Icon";
import { getViewer, ensureOwner, destinationFor, displayName, initials } from "@/lib/viewer";
import { createOwnerBusiness } from "@/app/workspace-actions";

export const metadata = { title: "Choose workspace" };

export default async function Workspace() {
  const viewer = await ensureOwner(await getViewer());
  if (!viewer) redirect("/sign-in");
  if (!viewer.admin || !viewer.user) redirect(await destinationFor(viewer));
  const u = viewer.user;
  const pro = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, u.id) });
  return (
    <div className="scr">
      <div className="top"><span className="sp" /><div className="t" /><span className="sp" /></div>
      <div className="body">
        <div className="row"><div className="avatar lg">{initials(u) || "N"}</div><div className="col g4"><span className="disp h2">{displayName(u) || u.email}</span><span className="muted small">Partner • {viewer.admin.role === "OWNER" ? "Owner" : viewer.admin.role}</span></div></div>
        <h1 className="disp h1" style={{ marginTop: 10 }}>Choose workspace</h1>
        <Link className="card" href="/admin" style={{ textDecoration: "none", padding: 22 }}>
          <div className="row"><span className="iconbtn"><Icon name="shield" /></span><div className="col g4 grow"><span className="h3">Nearest Administration</span><span className="muted small">Marketplace, people, bookings, money</span></div><Icon name="right" /></div>
        </Link>
        <Link className="card" href="/home" style={{ textDecoration: "none", padding: 22 }}>
          <div className="row"><span className="iconbtn"><Icon name="search" /></span><div className="col g4 grow"><span className="h3">Browse &amp; book</span><span className="small muted">Find professionals and book them as a customer</span></div><Icon name="right" /></div>
        </Link>
        {pro ? (
          <Link className="card" href="/pro/home" style={{ textDecoration: "none", padding: 22 }}>
            <div className="row"><span className="iconbtn"><Icon name="store" /></span><div className="col g4 grow"><span className="h3">My Professional Business</span><span className="muted small">{pro.businessName ? `${pro.businessName} — calendar, clients, earnings` : "Calendar, clients, model calls, earnings"}</span></div><Icon name="right" /></div>
          </Link>
        ) : (
          <form action={createOwnerBusiness}>
            <button type="submit" className="card" style={{ width: "100%", textAlign: "left", padding: 22, cursor: "pointer", font: "inherit", color: "inherit" }}>
              <div className="row"><span className="iconbtn"><Icon name="plus" /></span><div className="col g4 grow"><span className="h3">Set up my professional business</span><span className="muted small">Run your own services on Nearest from this same login</span></div><Icon name="right" /></div>
            </button>
          </form>
        )}
        <div style={{ flex: 1 }} />
        <div className="card small"><div className="row"><Icon name="log" /><span className="grow muted">Every admin action is logged to your name. Your professional activity stays separate from company administration.</span></div></div>
        <SignOutButton redirectUrl="/admin/sign-in"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
