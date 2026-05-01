"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-light", theme === "light");
  try {
    localStorage.setItem("theme", theme);
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    document.cookie = `theme=${theme}; path=/; max-age=31536000; SameSite=Lax; domain=.nexid.lat`;
  } catch {
    // ignore
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") {
        setTheme(saved);
        applyTheme(saved);
        return;
      }
    } catch {
      // ignore
    }

    const serverTheme = document.documentElement.getAttribute("data-theme");
    const initial: Theme = serverTheme === "light" || serverTheme === "dark" ? serverTheme : "dark";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        setTheme(next);
        applyTheme(next);
      }}
      className="theme-toggle inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <span aria-hidden className="theme-toggle__icon">{theme === "dark" ? "☾" : "☼"}</span>
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
