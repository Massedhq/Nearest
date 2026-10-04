/** Server time, so the sign-in screen can warn when a computer's clock is off (Clerk logins break with clock skew). */
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ now: Date.now() }, { headers: { "cache-control": "no-store" } });
}
