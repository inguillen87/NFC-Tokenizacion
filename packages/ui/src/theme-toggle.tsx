"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

type ThemeToggleProps = {
  initialTheme?: Theme;
  locale?: string;
};

const THEME_COPY = {
  es: {
    light: "Claro",
    dark: "Oscuro",
    switchToLight: "Cambiar a modo claro",
    switchToDark: "Cambiar a modo oscuro",
  },
  en: {
    light: "Light",
    dark: "Dark",
    switchToLight: "Switch to light mode",
    switchToDark: "Switch to dark mode",
  },
  pt: {
    light: "Claro",
    dark: "Escuro",
    switchToLight: "Mudar para o modo claro",
    switchToDark: "Mudar para o modo escuro",
  },
} as const;

const THEME_PREFERENCE_VERSION_KEY = "nexid-theme-preference-version";
const THEME_PREFERENCE_VERSION = "light-default-v1";

function syncBrowserChrome(theme: Theme) {
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = theme === "dark" ? "#020617" : "#fcfdfb";
  });
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
  syncBrowserChrome(theme);
  try {
    localStorage.setItem("theme", theme);
    localStorage.setItem(THEME_PREFERENCE_VERSION_KEY, THEME_PREFERENCE_VERSION);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax; domain=.nexid.lat`;
    document.cookie = `${THEME_PREFERENCE_VERSION_KEY}=${THEME_PREFERENCE_VERSION}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `${THEME_PREFERENCE_VERSION_KEY}=${THEME_PREFERENCE_VERSION}; path=/; max-age=31536000; SameSite=Lax; domain=.nexid.lat`;
  } catch {
    // ignore
  }
}

function readTheme(): Theme {
  try {
    const hasCurrentPreference =
      localStorage.getItem(THEME_PREFERENCE_VERSION_KEY) === THEME_PREFERENCE_VERSION ||
      document.cookie.split("; ").includes(`${THEME_PREFERENCE_VERSION_KEY}=${THEME_PREFERENCE_VERSION}`);
    if (hasCurrentPreference) {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;

      const serverTheme = document.documentElement.getAttribute("data-theme");
      if (serverTheme === "light" || serverTheme === "dark") return serverTheme;
    }
  } catch {
    // ignore
  }

  return "light";
}

export function ThemeToggle({ initialTheme = "light", locale = "en" }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    applyTheme(initial);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== "theme") return;
      if (event.newValue !== "dark" && event.newValue !== "light") return;
      setTheme(event.newValue);
      applyTheme(event.newValue);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const language = locale.startsWith("es") ? "es" : locale.startsWith("pt") ? "pt" : "en";
  const copy = THEME_COPY[language];
  const label = copy[theme];
  const actionLabel = nextTheme === "dark" ? copy.switchToDark : copy.switchToLight;

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
