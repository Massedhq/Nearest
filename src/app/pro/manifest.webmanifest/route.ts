export const dynamic = "force-static";

export function GET() {
  return Response.json(
    {
      id: "/pro",
      name: "Nearest Pro",
      short_name: "Nearest Pro",
      description: "Your Nearest business — calendar, clients and model calls.",
      start_url: "/pro/home",
      scope: "/pro",
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
