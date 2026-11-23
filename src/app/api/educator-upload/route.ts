import { createHash } from "node:crypto";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, educatorContracts } from "@/db";

/**
 * Upload tokens for a video educator's training video (public — no account). The browser sends the agreement link's
 * token as clientPayload; we only issue a token when it matches a SIGNED agreement and the path is that agreement's own
 * folder (educators/<contractId>/). MP4/MOV/WebM up to 2 GB, uploaded in parts; stored private when the store allows.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body, request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const token = String(clientPayload ?? "");
        if (!/^[0-9a-f]{48}$/.test(token)) throw new Error("Invalid upload.");
        const c = await db.query.educatorContracts.findFirst({ where: eq(educatorContracts.tokenHash, createHash("sha256").update(token).digest("hex")) });
        if (!c || !["signed", "uploaded"].includes(c.status) || !pathname.startsWith(`educators/${c.id}/`)) throw new Error("Invalid upload.");
        return { allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"], maximumSizeInBytes: 2 * 1024 * 1024 * 1024, addRandomSuffix: true };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
