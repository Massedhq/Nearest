import "server-only";
import { redirect } from "next/navigation";
import { getViewer, ensureOwner, destinationFor } from "./viewer";

/** Use at the top of every admin page and admin server action. */
export async function requireAdmin(opts: { owner?: boolean } = {}) {
  const viewer = await ensureOwner(await getViewer());
  if (!viewer) redirect("/admin/sign-in");
  if (!viewer.admin || !viewer.user) redirect(await destinationFor(viewer));
  if (opts.owner && viewer.admin.role !== "OWNER") throw new Error("Only an owner can do this.");
  return { user: viewer.user, role: viewer.admin.role, viewer };
}
