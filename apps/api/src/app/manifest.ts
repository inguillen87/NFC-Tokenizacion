import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "nexID API Gateway",
    short_name: "nexID API",
    description: "SUN validation, tenant operations and Polygon tokenization for verified physical products.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      {
        src: "/nexid-mark-128.png",
        sizes: "128x128",
        type: "image/png",
      },
      {
        src: "/nexid-mark-256.png",
        sizes: "256x256",
        type: "image/png",
      },
      {
        src: "/nexid-mark-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/nexid-mark-transparent-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
