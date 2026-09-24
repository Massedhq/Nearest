import { SignOutButton } from "@clerk/nextjs";

export const metadata = { title: "Not on the owner list" };

export default function NotAuthorized() {
  return (
    <div className="scr" style={{ justifyContent: "center" }}>
      <div className="body" style={{ flex: "none" }}>
        <h1 className="disp h2">This email isn&apos;t on the owner list</h1>
        <p className="muted p">Admin access is limited to the emails set in OWNER_EMAILS. If this is a mistake, have an owner add your email and redeploy.</p>
        <SignOutButton redirectUrl="/admin/sign-in"><button className="btn ghost" type="button">Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
