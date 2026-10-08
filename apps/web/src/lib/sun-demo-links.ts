/** Public demo destinations contain no NFC material or customer context. */
export const SUN_DEMO_GALLERY_HREF = "/sun";
export const VALLE_SECRETO_DEMO_HREF = "/sun?demo=1&profile=valle-secreto&scenario=closed";
export const SYNGENTA_DEMO_HREF = "/sun?demo=1&profile=syngenta&scenario=closed";

export function sunIndustryDemoHref(profile: "agrochem" | "fragrance" | "perfume") {
  return `/sun?demo=1&source=demo-lab&profile=${profile}`;
}

export type SunGalleryDemoProfile = "valle-secreto" | "syngenta" | "agrochem" | "fragrance" | "perfume";

/** Only curated simulation destinations; never copy a physical tap's query. */
export function sunDemoScenarioHref(profile: SunGalleryDemoProfile, scenario: "closed" | "opened" | "invalid") {
  const safeScenario = scenario === "opened" || scenario === "invalid" ? scenario : "closed";
  if (profile === "valle-secreto" || profile === "syngenta") return `/sun?demo=1&profile=${profile}&scenario=${safeScenario}`;
  if (profile !== "agrochem" && profile !== "fragrance" && profile !== "perfume") return "/sun";
  return `${sunIndustryDemoHref(profile)}&scenario=${safeScenario}`;
}
