import { redirect } from "next/navigation";
import { getViewer, destinationFor, proAccess } from "@/lib/viewer";

export default async function ProAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (!(await proAccess(viewer))) redirect(await destinationFor(viewer));
  if (viewer.user!.status === "deactivated") redirect("/pro");
  return <>{children}</>;
}
