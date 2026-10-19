import { getViewer } from "@/lib/viewer";
import { vapidKeys } from "@/lib/push";

/** The public half of Nearest's phone-alert key (the browser needs it to turn alerts on). Signed-in only. */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.user) return Response.json({ error: "Sign in" }, { status: 401 });
  return Response.json({ publicKey: (await vapidKeys()).publicKey }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
