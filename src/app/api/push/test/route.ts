import { getViewer } from "@/lib/viewer";
import { pushTo } from "@/lib/push";

/** "Send a test alert" — to the signed-in person's own phones only. */
export async function POST() {
  const viewer = await getViewer();
  if (!viewer?.user) return Response.json({ error: "Sign in" }, { status: 401 });
  const sent = await pushTo(viewer.user.id, { title: "Nearest alerts are on", body: "This is how new booking requests will show up.", href: "/pro/notifications", tag: "test" });
  return Response.json({ ok: sent > 0, sent });
}
