import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Portfolio and profile photos are stored in Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
  },
};

export default nextConfig;
