import { redirect } from "next/navigation";
import { getViewer, ensureOwner, destinationFor } from "@/lib/viewer";

// Everyone lands here after signing in; we send them to their own door.
export default async function Go() {
  const viewer = await ensureOwner(await getViewer());
  redirect(await destinationFor(viewer));
}
