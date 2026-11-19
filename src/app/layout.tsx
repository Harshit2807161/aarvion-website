import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aarvion Pharmaceuticals",
  description: "Aarvion Pharmaceuticals storefront",
};

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
