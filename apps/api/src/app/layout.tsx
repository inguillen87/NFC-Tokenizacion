import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Identity Gateway API",
  description: "NFC SUN validation and admin operations API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
