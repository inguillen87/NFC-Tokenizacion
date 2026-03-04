import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { siteConfig } from "@product/config";

export const metadata: Metadata = {
  title: `${siteConfig.productName} | Dashboard`,
  description: "Multi-tenant operations dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
