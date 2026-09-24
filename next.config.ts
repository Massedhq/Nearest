import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Student ID + selfie are resized on the phone (~300 KB each) before upload.
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Portfolio and profile photos are stored in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
