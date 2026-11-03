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

/** True when this admin is the main owner (Avy). Partner pages and Nearest Cards are hers alone. */
export async function isMainOwner(userId: string) {
  const { mainOwnerId } = await import("./partner");
  return (await mainOwnerId()) === userId;
}

/** Main owner only — pages call this and get a 404 for anyone else; actions get an error. */
export async function requireMainOwner(opts: { page?: boolean } = {}) {
  const a = await requireAdmin();
  if (!(await isMainOwner(a.user.id))) {
    if (opts.page) { const { notFound } = await import("next/navigation"); notFound(); }
    throw new Error("Only the main owner can do this.");
  }
  return a;
}
