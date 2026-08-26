"use client";

/**
 * DemoLabHubTheme
 * ----------------
 * Uses the same versioned, white-first preference as the marketing site and keeps
 * <html> plus the Demo Lab roots in sync without a full page reload.
 * Also renders the sun/moon ThemeToggle button to be slotted into the hub nav.
 */

import { useCallback, useEffect, useState } from "react";
import type { MouseEvent } from "react";
import { Sun, Moon } from "lucide-react";
import {
  applyTheme as applySiteTheme,
  THEME_PREFERENCE_VERSION,
  THEME_PREFERENCE_VERSION_STORAGE,
  type Theme,
} from "@product/ui";

type DemoLabThemeToggleProps = {
  initialTheme?: Theme;
  initialReturnTo?: string;
};

function readTheme(fallback: Theme = "light"): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;

  try {
    const version = localStorage.getItem(THEME_PREFERENCE_VERSION_STORAGE);
    const saved = localStorage.getItem("theme");
    if (version === THEME_PREFERENCE_VERSION && (saved === "dark" || saved === "light")) return saved;
  } catch {
    // SSR / private-browse guard
  }

  return fallback;
}

function syncDemoLabRootTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  document.querySelectorAll<HTMLElement>(".demo-lab-hub-root").forEach((node) => {
    node.classList.toggle("demo-lab-hub-root--light", theme === "light");
  });

  document.querySelectorAll<HTMLElement>(".demo-lab-fullscreen-root").forEach((node) => {
    node.classList.toggle("demo-lab-fullscreen-root--light", theme === "light");
  });
}

function applyDemoLabTheme(theme: Theme) {
  applySiteTheme(theme);
  syncDemoLabRootTheme(theme);
}

/**
 * Mount this once in the hub nav.  It reads the persisted theme on mount,
 * applies it to <html>, and listens for cross-tab storage events so the hub
 * stays in sync when the user toggles theme on the landing page in another tab.
 */
export function DemoLabThemeToggle({ initialTheme = "light", initialReturnTo = "/demo-lab" }: DemoLabThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [mounted, setMounted] = useState(false);
  const [returnTo, setReturnTo] = useState(initialReturnTo);

  const syncReturnTo = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("theme");
      setReturnTo(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      setReturnTo(initialReturnTo);
    }
  }, [initialReturnTo]);

  useEffect(() => {
    let initial = readTheme(initialTheme);
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
    applyDemoLabTheme(initial);
    syncReturnTo();
    setMounted(true);

    const onStorage = (e: StorageEvent) => {
      if (e.key !== "theme") return;
      if (e.newValue !== "dark" && e.newValue !== "light") return;
      if (localStorage.getItem(THEME_PREFERENCE_VERSION_STORAGE) !== THEME_PREFERENCE_VERSION) return;
      const next = e.newValue as Theme;
      setTheme(next);
      applyDemoLabTheme(next);
      syncReturnTo();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [initialTheme, syncReturnTo]);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const initialNextTheme: Theme = initialTheme === "dark" ? "light" : "dark";

  const onToggle = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyDemoLabTheme(next);
    syncReturnTo();
  }, [syncReturnTo, theme]);

  // Render a placeholder during SSR / before mount to avoid hydration mismatch
  if (!mounted) {
    return (
      <form action="/api/theme" method="get" className="m-0 inline-flex">
        <input type="hidden" name="theme" value={initialNextTheme} />
        <input type="hidden" name="returnTo" value={initialReturnTo} />
        <button
          suppressHydrationWarning
          type="submit"
          data-demo-lab-theme-toggle
          aria-label={initialNextTheme === "light" ? "Activar modo claro" : "Activar modo oscuro"}
          title={initialNextTheme === "light" ? "Activar modo claro" : "Activar modo oscuro"}
          className="demo-lab-theme-toggle theme-toggle inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-500 transition hover:bg-white/10 md:h-8 md:w-8 md:min-h-8 md:min-w-8"
        >
          {initialTheme === "dark" ? (
            <Sun className="w-3.5 h-3.5" />
          ) : (
            <Moon className="w-3.5 h-3.5" />
          )}
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
        data-demo-lab-theme-toggle
        onClick={onToggle}
        aria-label={nextTheme === "light" ? "Activar modo claro" : "Activar modo oscuro"}
        title={nextTheme === "light" ? "Activar modo claro" : "Activar modo oscuro"}
        className="demo-lab-theme-toggle theme-toggle inline-flex h-11 w-11 min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-cyan-400/30 hover:bg-white/10 hover:text-cyan-300 md:h-8 md:w-8 md:min-h-8 md:min-w-8"
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

