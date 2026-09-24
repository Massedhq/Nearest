import { redirect } from "next/navigation";
import { getViewer, destinationFor } from "@/lib/viewer";

export default async function ProAppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/pro/sign-in");
  if (viewer.user?.accountType !== "professional") redirect(await destinationFor(viewer));
  if (viewer.user.status === "deactivated") redirect("/pro");
  return <>{children}</>;
}
