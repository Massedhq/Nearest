import { repClick } from "@/lib/rep-click";

/** usenearest.com/r/CODE/students — an ambassador's student link. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  return repClick(req, (await params).code, "student");
}
