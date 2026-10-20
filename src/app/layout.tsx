import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bodoni-moda";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import "@fontsource-variable/manrope";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkLightAppearance } from "@/lib/clerk-appearance";
import { SwRegister } from "@/components/SwRegister";
import { InstallPrompt } from "@/components/InstallPrompt";
import { ProblemReporter } from "@/components/ProblemReporter";
import { PoweredBy } from "@/components/PoweredBy";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://www.usenearest.com"),
  title: { default: "Nearest", template: "%s · Nearest" },
  // Link previews (iMessage, Messenger, Instagram, Facebook…) always show the Nearest logo — src/app/opengraph-image.png.
  openGraph: { siteName: "Nearest", type: "website", description: "Find who's available near you." },
  twitter: { card: "summary_large_image" },
  description: "Find who's available near you.",
  applicationName: "Nearest",
  appleWebApp: { capable: true, title: "Nearest", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  // Search Console / Bing ownership (HTML-tag method). Set GOOGLE_SITE_VERIFICATION / BING_SITE_VERIFICATION in Vercel;
  // the DNS method (docs/SEO-AND-AI-DISCOVERY.md) needs nothing here.
  ...(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION ? { verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  } } : {}),
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={clerkLightAppearance}>
      <html lang="en">
        <body>
          {children}
          <PoweredBy />
          <SwRegister />
          <InstallPrompt />
          <ProblemReporter />
        </body>
      </html>
    </ClerkProvider>
  );
}
