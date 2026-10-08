import type { SunEntry } from "./sun-availability";

type SunQuery = Record<string, string | string[] | undefined>;

/** Only a genuinely empty entry may show the gallery. Unknown or malformed
 * reading parameters must keep their original unavailable/incomplete flow. */
export function isSunDemoGalleryEntry(entry: SunEntry, params: SunQuery): boolean {
  return entry === "empty" && Object.keys(params).every((key) =>
    (key === "lang" || key === "locale") && (params[key] === undefined || typeof params[key] === "string"));
}

/** Default the plain public demo only. Explicit profiles, malformed values and
 * legacy Demo Lab handoffs retain their existing selector behavior. */
export function resolveSunDemoProfile(isDemoPreview: boolean, params: SunQuery): string {
  if (params.profile !== undefined) return typeof params.profile === "string" ? params.profile.trim() : "";
  const source = params.source;
  const plainDemo = Object.keys(params).every((key) => ["demo", "source", "scenario", "lang", "locale"].includes(key) && !Array.isArray(params[key]));
  if (isDemoPreview && plainDemo && (typeof source !== "string" || source.trim() !== "demo-lab")) return "valle-secreto";
  return "";
}
