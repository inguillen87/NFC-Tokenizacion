"use client";

import { useEffect, useState } from "react";
import {
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_COOKIE,
  THEME_PREFERENCE_VERSION_STORAGE,
  themeCookieDomainForHostname,
  type Theme,
} from "./theme-preference";

export type { Theme } from "./theme-preference";

const themeCopy = {
  "es-AR": { dark: "Oscuro", light: "Claro", toDark: "Cambiar a modo oscuro", toLight: "Cambiar a modo claro" },
  "pt-BR": { dark: "Escuro", light: "Claro", toDark: "Mudar para o modo escuro", toLight: "Mudar para o modo claro" },
  en: { dark: "Dark", light: "Light", toDark: "Switch to dark mode", toLight: "Switch to light mode" },
} as const;

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;

  try {
    localStorage.setItem(THEME_PREFERENCE_VERSION_STORAGE, THEME_PREFERENCE_VERSION);
    localStorage.setItem("theme", theme);
  } catch {
    // ignore
  }

  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    const cookieBase = `path=/; SameSite=Lax${secure}`;
    const persistentCookie = `${cookieBase}; max-age=31536000`;
    const domain = themeCookieDomainForHostname(window.location.hostname);

    if (domain) {
      // Remove the old host-only values before persisting one shared value for apex + www.
      document.cookie = `theme=; ${cookieBase}; max-age=0`;
      document.cookie = `${THEME_PREFERENCE_VERSION_COOKIE}=; ${cookieBase}; max-age=0`;
      document.cookie = `theme=${theme}; ${persistentCookie}; domain=${domain}`;
      document.cookie = `${THEME_PREFERENCE_VERSION_COOKIE}=${THEME_PREFERENCE_VERSION}; ${persistentCookie}; domain=${domain}`;
    } else {
      document.cookie = `theme=${theme}; ${persistentCookie}`;
      document.cookie = `${THEME_PREFERENCE_VERSION_COOKIE}=${THEME_PREFERENCE_VERSION}; ${persistentCookie}`;
    }
  } catch {
    // ignore
  }
}

function readTheme(): Theme {
  const serverTheme = document.documentElement.getAttribute("data-theme");
  if (serverTheme === "light" || serverTheme === "dark") return serverTheme;

  try {
    const version = localStorage.getItem(THEME_PREFERENCE_VERSION_STORAGE);
    const saved = localStorage.getItem("theme");
    if (version === THEME_PREFERENCE_VERSION && (saved === "dark" || saved === "light")) return saved;
  } catch {
    // ignore
  }

  return "light";
}

export function ThemeToggle({ initialTheme = "light", locale = "en" }: { initialTheme?: Theme; locale?: string }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    applyTheme(initial);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      if (event.newValue !== "dark" && event.newValue !== "light") return;
      if (localStorage.getItem(THEME_PREFERENCE_VERSION_STORAGE) !== THEME_PREFERENCE_VERSION) return;
      setTheme(event.newValue);
      applyTheme(event.newValue);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const copy = locale === "es-AR" ? themeCopy["es-AR"] : locale === "pt-BR" ? themeCopy["pt-BR"] : themeCopy.en;
  const label = theme === "dark" ? copy.dark : copy.light;
  const actionLabel = nextTheme === "dark" ? copy.toDark : copy.toLight;

  return (
    <button
      suppressHydrationWarning
      type="button"
      onClick={() => {
        setTheme(nextTheme);
        applyTheme(nextTheme);
      }}
      className="theme-toggle inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
      aria-label={actionLabel}
      title={actionLabel}
    >
      <span aria-hidden className={`theme-toggle__glyph theme-toggle__glyph--${theme}`} />
      <span>{label}</span>
    </button>
  );
}
