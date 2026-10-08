/** Public demo destinations contain no NFC material or customer context. */
export const SUN_DEMO_GALLERY_HREF = "/sun";
export const VALLE_SECRETO_DEMO_HREF = "/sun?demo=1&profile=valle-secreto&scenario=closed";

export function sunIndustryDemoHref(profile: "agrochem" | "fragrance" | "perfume") {
  return `/sun?demo=1&source=demo-lab&profile=${profile}`;
}

export type SunGalleryDemoProfile = "valle-secreto" | "agrochem" | "fragrance" | "perfume";

/** Only curated simulation destinations; never copy a physical tap's query. */
export function sunDemoScenarioHref(profile: SunGalleryDemoProfile, scenario: "closed" | "opened" | "invalid") {
  const safeScenario = scenario === "opened" || scenario === "invalid" ? scenario : "closed";
  if (profile === "valle-secreto") return `/sun?demo=1&profile=valle-secreto&scenario=${safeScenario}`;
  if (profile !== "agrochem" && profile !== "fragrance" && profile !== "perfume") return "/sun";
  return `${sunIndustryDemoHref(profile)}&scenario=${safeScenario}`;
}
