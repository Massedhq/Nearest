import { redirect } from "next/navigation";
import { getViewer, destinationFor, proAccess } from "@/lib/viewer";

/** Professionals build their profile first — no payment to get in (the membership activates at their first accepted booking). */
export default async function ProAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!(await proAccess(viewer))) redirect(await destinationFor(viewer));
  if (viewer.user!.status === "deactivated") redirect("/pro");
  return <>{children}</>;
}
