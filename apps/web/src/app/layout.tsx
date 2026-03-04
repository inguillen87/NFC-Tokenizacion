import type { Metadata } from "next";
import "./globals.css";
import { siteConfig } from "@product/config";

export const metadata: Metadata = {
  title: `${siteConfig.productName} | Product landing`,
  description: siteConfig.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
