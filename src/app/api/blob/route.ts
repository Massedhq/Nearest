import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { proAccess } from "@/lib/viewer";
import { getProViewer } from "@/lib/build-mode";

// Issues short-lived upload tokens so photos go straight from the phone to Blob storage.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const viewer = await getProViewer();
        const u = viewer?.user;
        // Pros upload portfolio/profile photos; students upload their appointment result photo.
        const ok = u && (((await proAccess(viewer)) && pathname.startsWith(`pros/${u.id}/`)) || ((u.accountType === "student" || viewer?.admin?.role === "OWNER") && pathname.startsWith(`students/${u.id}/`)));
        if (!ok) throw new Error("Invalid upload.");
        if (viewer?.admin?.role === "OWNER" && pathname.startsWith(`students/${u!.id}/explainer-video/`)) {
          // Owners: the supporter explainer video (shown on the supporter invitation form).
          return { allowedContentTypes: ["video/mp4", "video/quicktime", "video/webm"], maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true };
        }
        if (pathname.startsWith(`pros/${u!.id}/shop-file/`)) {
          // Partner shop digital downloads (workbooks, guides, presets…). Never shown publicly — served by /api/shop/download.
          return { allowedContentTypes: ["application/pdf", "application/zip", "application/x-zip-compressed", "application/epub+zip", "image/jpeg", "image/png", "video/mp4", "audio/mpeg", "audio/mp4"], maximumSizeInBytes: 200 * 1024 * 1024, addRandomSuffix: true };
        }
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
