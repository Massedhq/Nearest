import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/viewer";

// Issues short-lived upload tokens so photos go straight from the phone to Blob storage.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const viewer = await getViewer();
        if (viewer?.user?.accountType !== "professional") throw new Error("Only professionals can upload.");
        if (!pathname.startsWith(`pros/${viewer.user.id}/`)) throw new Error("Invalid upload path.");
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 15 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
