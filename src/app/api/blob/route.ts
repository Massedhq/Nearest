import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getViewer, proAccess } from "@/lib/viewer";

// Issues short-lived upload tokens so photos go straight from the phone to Blob storage.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const viewer = await getViewer();
        const u = viewer?.user;
        // Pros upload portfolio/profile photos; students upload their appointment result photo.
        const ok = u && (((await proAccess(viewer)) && pathname.startsWith(`pros/${u.id}/`)) || ((u.accountType === "student" || viewer?.admin?.role === "OWNER") && pathname.startsWith(`students/${u.id}/`)));
        if (!ok) throw new Error("Invalid upload.");
        if (pathname.startsWith(`pros/${u!.id}/portfolio-video/`)) {
          // Portfolio videos: 15 seconds max (checked again from the file after upload), MP4 or iPhone MOV.
          return { allowedContentTypes: ["video/mp4", "video/quicktime"], maximumSizeInBytes: 100 * 1024 * 1024, addRandomSuffix: true };
        }
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
