import type { Metadata, Viewport } from "next";
import { StoreFooter } from "@/components/shell/store-footer";
import { LiveRegion } from "@/components/feedback/live-region";
import { Toaster } from "@/components/feedback/toast";
import { resolveSiteMetadataBase, SITE_CONFIG } from "@/config/site";
import { fontVariables } from "@/fonts";
import { getCachedCategories } from "@/lib/catalogue/cached";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read at build time (cached, tagged `catalogue`): the build needs a seeded database.
  const live = (await getCachedCategories()).filter((c) => c.status === "live");
  return (
    <html lang="en-IN" className={fontVariables}>
      <body>
        {children}
        <StoreFooter categories={live} />
        <Toaster />
        <LiveRegion />
      </body>
    </html>
  );
}
