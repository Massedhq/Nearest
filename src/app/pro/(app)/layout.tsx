import { redirect } from "next/navigation";
import { getViewer, destinationFor, proAccess } from "@/lib/viewer";
import { eq } from "drizzle-orm";
import { db, professionalProfiles } from "@/db";
import { hasPaidEntry } from "@/lib/entry";

export default async function ProAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!(await proAccess(viewer))) redirect(await destinationFor(viewer));
  if (viewer.user!.status === "deactivated") redirect("/pro");
  // Pay first: no one reaches the professional side until their entry is paid.
  const profile = await db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, viewer.user!.id) });
  if (profile && !hasPaidEntry(profile) && viewer.admin?.role !== "OWNER") redirect("/pro/join"); // owners never pay
  return <>{children}</>;
}
