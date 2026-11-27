import type { Metadata, Viewport } from "next";
import { LiveRegion } from "@/components/feedback/live-region";
import { Toaster } from "@/components/feedback/toast";
import { resolveSiteMetadataBase, SITE_CONFIG } from "@/config/site";
import { fontVariables } from "@/fonts";
import "./globals.css";

// metadataBase is what Next resolves opengraph-image and icon URLs against; without it they
// point at localhost. It reads the raw APP_URL, not getEnv(): getEnv validates every variable, and
// a bad unrelated one (or a bad APP_URL) must not take down the build and every page, the 404
// included. resolveSiteMetadataBase validates the value and falls back to localhost.
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: resolveSiteMetadataBase(process.env.APP_URL),
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

/**
 * The document shell for every route: <html>, the toast region and the page's single polite
 * live region (exactly one <LiveRegion/> may exist, so it lives here and nowhere else).
 * Chrome that only some routes want, such as the store footer, belongs in a route-group layout:
 * `(store)` for customer pages; admin and staff routes go in their own group and get none of it.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        {children}
        <Toaster />
        <LiveRegion />
      </body>
    </html>
  );
}
