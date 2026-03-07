import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nexID — NFC Authentication & Product Identity",
    short_name: "nexID",
    description: "Enterprise-grade NFC authentication, traceability and product identity cloud.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#06b6d4",
    lang: "es-AR",
    icons: [
      { src: "/nexid-mark-64.png", sizes: "64x64", type: "image/png" },
      { src: "/nexid-mark-128.png", sizes: "128x128", type: "image/png" },
      { src: "/nexid-mark-256.png", sizes: "256x256", type: "image/png" },
      { src: "/nexid-mark-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
