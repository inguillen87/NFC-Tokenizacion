import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://nexid.lat";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/login",
        "/register",
        "/me/",
        "/web3/",
        "/proof/",
        "/certificado/",
        "/r/",
        "/s/",
        "/demo-sandbox",
        "/investor-snapshot",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
