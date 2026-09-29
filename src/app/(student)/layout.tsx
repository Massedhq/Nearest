import { redirect } from "next/navigation";
import { getViewer, destinationFor } from "@/lib/viewer";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  // Students — and owners using Browse & book as customers.
  if (viewer.user?.accountType !== "student" && viewer.admin?.role !== "OWNER") redirect(await destinationFor(viewer));
  if (viewer.user?.status === "deactivated") redirect("/");
  return <>{children}</>;
}
