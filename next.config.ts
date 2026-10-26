import type { NextConfig } from "next";

// Find by photo: the vision model + its runtime run on the server (src/lib/look-model.ts) — only in these routes.
const LOOK_FILES = ["./models/look-match/**/*", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm", "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs", "./node_modules/onnxruntime-web/dist/ort.node.min.mjs", "./node_modules/onnxruntime-web/package.json"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["onnxruntime-web", "sharp"],
  outputFileTracingIncludes: {
    "/api/look-match": LOOK_FILES,
    "/api/cron/sweep": LOOK_FILES,
    "/admin/photo-match": LOOK_FILES,
    "/admin/**/photo-match": LOOK_FILES,
    "/admin/**/photo-match/**": LOOK_FILES,
  },
  outputFileTracingExcludes: {
    "/*": ["./node_modules/onnxruntime-web/dist/*.map", "./node_modules/onnxruntime-web/dist/*jsep*", "./node_modules/onnxruntime-web/dist/*asyncify*", "./node_modules/onnxruntime-web/dist/*webgpu*", "./node_modules/onnxruntime-web/dist/*webgl*", "./node_modules/onnxruntime-web/dist/ort.all*", "./node_modules/onnxruntime-web/dist/ort.min*", "./node_modules/onnxruntime-web/dist/ort.bundle*", "./node_modules/onnxruntime-web/dist/ort.wasm*"],
  },
  experimental: {
    // Student ID + selfie are resized on the phone (~300 KB each) before upload.
    serverActions: { bodySizeLimit: "10mb" },
  },
  images: {
    // Portfolio and profile photos are stored in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
