"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type ThemeToggleLocale = "es-AR" | "pt-BR" | "en";

const themeLabels = {
  "es-AR": {
    dark: "Oscuro",
    light: "Claro",
    switchToDark: "Cambiar a modo oscuro",
    switchToLight: "Cambiar a modo claro",
  },
  "pt-BR": {
    dark: "Escuro",
    light: "Claro",
    switchToDark: "Mudar para o modo escuro",
    switchToLight: "Mudar para o modo claro",
  },
  en: {
    dark: "Dark",
    light: "Light",
    switchToDark: "Switch to dark mode",
    switchToLight: "Switch to light mode",
  },
} as const;

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-light", theme === "light");
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem("theme", theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax; domain=.nexid.lat`;
  } catch {
    // ignore
  }
}

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // ignore
  }

  const serverTheme = document.documentElement.getAttribute("data-theme");
  return serverTheme === "light" || serverTheme === "dark" ? serverTheme : "dark";
}

export function ThemeToggle({
  initialTheme = "dark",
  locale = "en",
}: {
  initialTheme?: Theme;
  locale?: ThemeToggleLocale;
}) {
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
  const copy = themeLabels[locale];
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
