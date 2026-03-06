"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.toggle("theme-light", theme === "light");
  try {
    localStorage.setItem("theme", theme);
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

    const prefersLight = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
    const initial: Theme = prefersLight ? "light" : "dark";
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
      className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-200 transition hover:bg-white/10"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <span aria-hidden>{theme === "dark" ? "🌙" : "☀️"}</span>
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
