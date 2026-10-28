import { NextResponse } from "next/server";
import { downloadFor } from "@/lib/shop";
import { readEvidence } from "@/lib/campaign-storage";

export const dynamic = "force-dynamic";

/** A buyer's digital download (link from the thank-you page or their email). Counts each download. */
export async function GET(req: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const r = await downloadFor(orderId, token);
  if ("error" in r) return new NextResponse(r.error, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  const file = await readEvidence(r.product.fileUrl!, r.product.fileAccess ?? "private");
  if (!file) return new NextResponse("This file isn't available right now. Contact the seller.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const name = (r.product.fileName || "download").replace(/[^\w.\- ]+/g, "_");
  return new NextResponse(file.body, {
    headers: {
      "content-type": file.type || "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
