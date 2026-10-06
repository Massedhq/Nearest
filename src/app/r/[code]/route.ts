import { repClick } from "@/lib/rep-click";

/** usenearest.com/r/CODE — an ambassador's professional link. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return repClick(req, (await params).code, "pro");
}
