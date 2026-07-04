"use client";

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

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Sun, Moon } from "lucide-react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // SSR / private-browse guard
  }

  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;

  return "dark";
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
  const [returnTo, setReturnTo] = useState("/demo-lab");

  const syncReturnTo = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("theme");
      setReturnTo(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      setReturnTo("/demo-lab");
    }
  }, []);

  useEffect(() => {
    let initial = readTheme();
    try {
      const url = new URL(window.location.href);
      const requested = url.searchParams.get("theme");
      if (requested === "dark" || requested === "light") {
        initial = requested;
        url.searchParams.delete("theme");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {
      // ignore
    }

    setTheme(initial);
    applyTheme(initial);
    syncReturnTo();
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return;
      if (e.newValue !== "dark" && e.newValue !== "light") return;
      const next = e.newValue as Theme;
      setTheme(next);
      applyTheme(next);
      syncReturnTo();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [syncReturnTo]);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";

  const onToggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    syncReturnTo();
  }, [syncReturnTo, theme]);

  // Render a placeholder during SSR / before mount to avoid hydration mismatch
  if (!mounted) {
    return (
      <form action="/api/theme" method="get" className="m-0 inline-flex">
        <input type="hidden" name="theme" value="light" />
        <input type="hidden" name="returnTo" value={returnTo} />
        <button
          suppressHydrationWarning
          type="submit"
          aria-label="Toggle theme"
          className="theme-toggle inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition hover:bg-white/10 md:h-8 md:w-8 md:min-h-8 md:min-w-8"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
      </form>
    );
  }

  return (
    <form action="/api/theme" method="get" className="m-0 inline-flex">
      <input type="hidden" name="theme" value={nextTheme} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        suppressHydrationWarning
        type="submit"
        onClick={onToggle}
        aria-label={`Switch to ${nextTheme} mode`}
        title={`Switch to ${nextTheme} mode`}
        className="theme-toggle inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-400/30 hover:bg-white/10 hover:text-cyan-300 md:h-8 md:w-8 md:min-h-8 md:min-w-8"
      >
        {theme === "dark" ? (
          <Sun className="w-3.5 h-3.5" />
        ) : (
          <Moon className="w-3.5 h-3.5" />
        )}
      </button>
    </form>
  );
}

