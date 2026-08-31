import type { Metadata } from "next";
import type { ReactNode } from "react";
import "maplibre-gl/dist/maplibre-gl.css";

export const metadata: Metadata = {
  // Dynamic SUN URLs can contain signed NFC material. External cartography
  // must never receive the passport path or query string as a referrer.
  referrer: "no-referrer",
};

export default function SunLayout({ children }: { children: ReactNode }) {
  return children;
}
