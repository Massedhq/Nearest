import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Nearest Pro", template: "%s · Nearest Pro" },
  manifest: "/pro/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Nearest Pro", statusBarStyle: "black-translucent" },
};

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
