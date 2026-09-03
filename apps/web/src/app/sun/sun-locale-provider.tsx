"use client";

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  SUN_LOCALES,
  SUN_LOCALE_COOKIE,
  isSunLocale,
  toDocumentLanguage,
  translateSunUiText,
  type SunLocale,
} from "./sun-locale";

type SunLocaleContextValue = {
  locale: SunLocale;
  setLocale: (locale: SunLocale) => void;
  text: (value: string) => string;
};

const SunLocaleContext = createContext<SunLocaleContextValue | null>(null);

const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;

function shouldSkipTextNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (["SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)) return true;
  return Boolean(parent.closest("[data-sun-server-evidence='true']"));
}

function localizeTree(root: HTMLElement, locale: SunLocale) {
  for (const element of root.querySelectorAll<HTMLElement>("[data-sun-datetime]")) {
    if (element.closest("[data-sun-server-evidence='true']")) continue;
    const rawValue = element.dataset.sunDatetime;
    if (!rawValue) continue;
    const date = new Date(rawValue);
    if (!Number.isFinite(date.getTime())) continue;
    const timeZone = element.dataset.sunTimeZone || undefined;
    const formatted = new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone,
    }).format(date);
    if (element.textContent !== formatted) element.textContent = formatted;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    if (!shouldSkipTextNode(current)) {
      const value = current.nodeValue || "";
      const translated = translateSunUiText(value, locale);
      if (translated !== value) current.nodeValue = translated;
    }
    current = walker.nextNode();
  }

  for (const element of root.querySelectorAll<HTMLElement>("[aria-label], [placeholder], [title]")) {
    if (element.closest("[data-sun-server-evidence='true']")) continue;
    for (const attribute of TRANSLATED_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      const translated = translateSunUiText(value, locale);
      if (translated !== value) element.setAttribute(attribute, translated);
    }
  }
}

export function SunLocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: SunLocale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<SunLocale>(initialLocale);
  const rootRef = useRef<HTMLDivElement>(null);
  const translatingRef = useRef(false);

  const applyLocale = useCallback((nextLocale: SunLocale) => {
    const root = rootRef.current;
    if (!root || translatingRef.current) return;
    translatingRef.current = true;
    try {
      localizeTree(root, nextLocale);
      document.documentElement.lang = toDocumentLanguage(nextLocale);
    } finally {
      translatingRef.current = false;
    }
  }, []);

  const setLocale = useCallback((nextLocale: SunLocale) => {
    if (!isSunLocale(nextLocale)) return;
    document.cookie = `${SUN_LOCALE_COOKIE}=${encodeURIComponent(nextLocale)}; path=/; max-age=31536000; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("lang", nextLocale);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    setLocaleState(nextLocale);
  }, []);

  useLayoutEffect(() => {
    applyLocale(locale);
    const root = rootRef.current;
    if (!root) return;

    const observer = new MutationObserver(() => {
      if (translatingRef.current) return;
      applyLocale(locale);
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [applyLocale, locale]);

  const value = useMemo<SunLocaleContextValue>(() => ({
    locale,
    setLocale,
    text: (source) => translateSunUiText(source, locale),
  }), [locale, setLocale]);

  return (
    <SunLocaleContext.Provider value={value}>
      <div ref={rootRef} className="contents" data-sun-locale={locale}>
        {children}
      </div>
    </SunLocaleContext.Provider>
  );
}

export function useSunLocale() {
  const value = useContext(SunLocaleContext);
  if (!value) {
    throw new Error("useSunLocale must be used inside SunLocaleProvider");
  }
  return value;
}

const LABELS: Record<SunLocale, string> = {
  "es-AR": "Español (AR)",
  "pt-BR": "Português (BR)",
  en: "English",
};

const ARIA_LABELS: Record<SunLocale, string> = {
  "es-AR": "Seleccionar idioma del pasaporte",
  "pt-BR": "Selecionar idioma do passaporte",
  en: "Select passport language",
};

export function SunLocaleSwitcher() {
  const { locale, setLocale } = useSunLocale();

  return (
    <label className="locale-switcher inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-0 text-xs font-semibold text-slate-200">
      <span aria-hidden className="locale-switcher__icon">ID</span>
      <select
        value={locale}
        className="min-h-11 bg-transparent pr-1 text-xs font-semibold"
        aria-label={ARIA_LABELS[locale]}
        onChange={(event) => {
          const nextLocale = event.target.value;
          if (isSunLocale(nextLocale)) setLocale(nextLocale);
        }}
      >
        {SUN_LOCALES.map((item) => (
          <option key={item} value={item} className="locale-switcher__option">
            {LABELS[item]}
          </option>
        ))}
      </select>
    </label>
  );
}
