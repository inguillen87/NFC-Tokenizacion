import {
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_COOKIE,
  THEME_PREFERENCE_VERSION_STORAGE,
  type Theme,
} from "../../../../packages/ui/src/theme-preference";

export function isOfflineRecoveryPath(pathname: string) {
  return pathname === "/offline" || pathname === "/offline/" ||
    pathname === "/offline/certificate" || pathname === "/offline/certificate/";
}

function readUniqueCookie(cookies: string, name: string) {
  const prefix = `${name}=`;
  const values = cookies.split(";").map((part) => part.trim())
    .filter((part) => part.startsWith(prefix)).map((part) => part.slice(prefix.length));
  return values.length > 0 && values.every((value) => value === values[0]) ? values[0] : null;
}

function explicitTheme(theme: unknown, version: unknown): Theme | null {
  return version === THEME_PREFERENCE_VERSION && (theme === "light" || theme === "dark") ? theme : null;
}

// The shared cache has no credentials and may contain light SSR. Restore only
// an explicit current preference; inaccessible/missing storage is not a choice.
export function readExplicitOfflineTheme(access: {
  readCookies: () => string;
  readStorage: (key: string) => string | null;
}): Theme | null {
  try {
    const cookies = access.readCookies();
    const preferred = explicitTheme(readUniqueCookie(cookies, "theme"), readUniqueCookie(cookies, THEME_PREFERENCE_VERSION_COOKIE));
    if (preferred) return preferred;
  } catch {
    // A valid explicit local preference can still recover blocked cookies.
  }
  try {
    return explicitTheme(access.readStorage("theme"), access.readStorage(THEME_PREFERENCE_VERSION_STORAGE));
  } catch {
    return null;
  }
}
