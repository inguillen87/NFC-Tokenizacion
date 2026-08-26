"use client";

import { useEffect, useState } from "react";

export type Theme = "dark" | "light";

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
  return serverTheme === "light" || serverTheme === "dark" ? serverTheme : "light";
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
