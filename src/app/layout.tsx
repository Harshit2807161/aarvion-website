import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aarvion Pharmaceuticals",
  description: "Aarvion Pharmaceuticals storefront",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
