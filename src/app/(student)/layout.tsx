import { redirect } from "next/navigation";
import { getViewer, destinationFor } from "@/lib/viewer";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  // Students — owners using Browse & book as customers — and partner clients (bookings with partners only; other
  // student pages send them back to /bookings through requireStudent → destinationFor).
  if (viewer.user?.accountType !== "student" && viewer.user?.accountType !== "customer" && viewer.admin?.role !== "OWNER") redirect(await destinationFor(viewer));
  if (viewer.user?.status === "deactivated") redirect("/");
  return <>{children}</>;
}
