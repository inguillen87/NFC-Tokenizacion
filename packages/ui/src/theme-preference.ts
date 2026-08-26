export type Theme = "dark" | "light";

export const THEME_PREFERENCE_VERSION = "white-first-v1";
export const THEME_PREFERENCE_VERSION_COOKIE = "nexid_theme_version";
export const THEME_PREFERENCE_VERSION_STORAGE = "nexid-theme-version";

export function resolveThemePreference(themeCookie?: string, versionCookie?: string): Theme {
  if (versionCookie !== THEME_PREFERENCE_VERSION) return "light";
  return themeCookie === "dark" ? "dark" : "light";
}

export function themeCookieDomainForHostname(hostname: string): ".nexid.lat" | ".nexid.com.ar" | null {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (normalized === "nexid.lat" || normalized.endsWith(".nexid.lat")) return ".nexid.lat";
  if (normalized === "nexid.com.ar" || normalized.endsWith(".nexid.com.ar")) return ".nexid.com.ar";
  return null;
}
