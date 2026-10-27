import { INDEXNOW_KEY } from "@/lib/indexnow";

/** IndexNow ownership check: search engines read this key to confirm the pings really come from usenearest.com. */
export function GET() {
  return new Response(INDEXNOW_KEY, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
