import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { destinationFor, proAccess } from "@/lib/viewer";
import { getProViewer } from "@/lib/build-mode";
import { BuildBanner } from "@/components/BuildBanner";

/** Professionals build their profile first — no payment to get in (the membership activates at their first accepted booking). */
export default async function ProAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getProViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!(await proAccess(viewer))) redirect(await destinationFor(viewer));
  if (viewer.user!.status === "deactivated") redirect("/pro");
  const p = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, viewer.user!.id), columns: { builtBy: true, entryPaidAt: true, businessName: true } });
  // A profile Nearest built for them: the professional accepts the Terms before they see their account.
  // Partners sent a "set up" or "finish setting up" link use the normal setup pages instead.
  if (!viewer.building && p?.builtBy && !p.entryPaidAt && !(await (await import("@/lib/partner-handoff")).selfSetupPartner(viewer.user!.id))) redirect("/pro/welcome");
  if (viewer.building) {
    const name = [viewer.user!.firstName, viewer.user!.lastName].filter(Boolean).join(" ") || p?.businessName || "this professional";
    return <><BuildBanner userId={viewer.user!.id} name={name} />{children}</>;
  }
  return <>{children}</>;
}
