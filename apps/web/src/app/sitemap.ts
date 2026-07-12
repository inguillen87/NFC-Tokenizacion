import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://nexid.lat";

const publicRoutes = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "/demo-lab", changeFrequency: "weekly", priority: 0.9 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.9 },
  { path: "/sdk", changeFrequency: "weekly", priority: 0.85 },
  { path: "/docs", changeFrequency: "weekly", priority: 0.85 },
  { path: "/sun", changeFrequency: "monthly", priority: 0.8 },
  { path: "/audiences", changeFrequency: "monthly", priority: 0.75 },
  { path: "/stack", changeFrequency: "monthly", priority: 0.7 },
  { path: "/resellers", changeFrequency: "monthly", priority: 0.7 },
  { path: "/glossary", changeFrequency: "monthly", priority: 0.65 },
  { path: "/investor-one-pager", changeFrequency: "monthly", priority: 0.55 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return publicRoutes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
