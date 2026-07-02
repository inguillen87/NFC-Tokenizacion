-"use client";

/**
 * DemoLabHubTheme
 * ----------------
 * Reads the site-wide theme from localStorage ("theme" key, values "dark" | "light")
 * and keeps <html> class + data-theme in sync without a full page reload.
 * Also renders the sun/moon ThemeToggle button to be slotted into the hub nav.
 *
 * The key is "theme" - same key used by packages/ui/src/theme-toggle.tsx and
 * set as a cookie by applyTheme() for SSR hydration.
 */

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // SSR / private-browse guard
  }
  // Fallback: read the data-theme attribute already set by the server
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
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

/**
 * Mount this once in the hub nav.  It reads the persisted theme on mount,
 * applies it to <html>, and listens for cross-tab storage events so the hub
 * stays in sync when the user toggles theme on the landing page in another tab.
 */
export function DemoLabThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return;
      if (e.newValue !== "dark" && e.newValue !== "light") return;
      const next = e.newValue as Theme;
      setTheme(next);
      applyTheme(next);
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  const handleToggle = () => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
  };

  // Render a placeholder during SSR / before mount to avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        suppressHydrationWarning
        type="button"
        aria-label="Toggle theme"
        className="theme-toggle inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-white/5 text-slate-500 transition hover:bg-white/10"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <button
      suppressHydrationWarning
      type="button"
      onClick={handleToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className="theme-toggle inline-flex items-center justify-center w-8 h-8 rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-cyan-300 hover:border-cyan-400/30"
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

