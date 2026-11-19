import type { Metadata, Viewport } from "next";
import { resolveSiteMetadataBase, SITE_CONFIG } from "@/config/site";
import { fontVariables } from "@/fonts";
import { getEnv } from "@/server/env";
import "./globals.css";

// metadataBase is what Next resolves opengraph-image and icon URLs against; without it they
// point at localhost. It reads APP_URL lazily (getEnv never runs at import time).
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: resolveSiteMetadataBase(getEnv().APP_URL),
    title: SITE_CONFIG.legalName,
    description: `${SITE_CONFIG.legalName} storefront`,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#172f21",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
