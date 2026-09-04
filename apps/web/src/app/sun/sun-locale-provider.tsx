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
  formatSunDateTime,
  isSunLocale,
  toDocumentLanguage,
  translateSunUiText,
  type SunLocale,
} from "./sun-locale";

type SunLocaleContextValue = {
  locale: SunLocale;
  setLocale: (locale: SunLocale) => Promise<void>;
  localePending: boolean;
  localeError: string | null;
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
    const timeZone = element.dataset.sunTimeZone || undefined;
    const formatted = formatSunDateTime(rawValue, locale, timeZone);
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
  const [localePending, setLocalePending] = useState(false);
  const [localeError, setLocaleError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const translatingRef = useRef(false);
  const localeRequestRef = useRef<{ controller: AbortController; sequence: number } | null>(null);

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

  const setLocale = useCallback(async (nextLocale: SunLocale) => {
    if (!isSunLocale(nextLocale)) return;
    if (nextLocale === locale) return;

    localeRequestRef.current?.controller.abort();
    const controller = new AbortController();
    const sequence = (localeRequestRef.current?.sequence || 0) + 1;
    localeRequestRef.current = { controller, sequence };
    setLocalePending(true);
    setLocaleError(null);

    try {
      const response = await fetch("/api/sun/locale", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("locale_preference_not_saved");
      if (localeRequestRef.current?.sequence !== sequence) return;

      setLocaleState(nextLocale);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLocaleError(error instanceof Error ? error.message : "locale_preference_not_saved");
    } finally {
      if (localeRequestRef.current?.sequence === sequence) {
        localeRequestRef.current = null;
        setLocalePending(false);
      }
    }
  }, [locale]);

  useLayoutEffect(() => () => localeRequestRef.current?.controller.abort(), []);

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
    localePending,
    localeError,
    text: (source) => translateSunUiText(source, locale),
  }), [locale, localeError, localePending, setLocale]);

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
  const { locale, setLocale, localePending, localeError } = useSunLocale();

  return (
    <label className="locale-switcher inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-0 text-xs font-semibold text-slate-200">
      <span aria-hidden className="locale-switcher__icon">ID</span>
      <select
        value={locale}
        disabled={localePending}
        aria-busy={localePending}
        data-locale-error={localeError || undefined}
        className="min-h-11 bg-transparent pr-1 text-xs font-semibold"
        aria-label={ARIA_LABELS[locale]}
        onChange={(event) => {
          const nextLocale = event.target.value;
          if (isSunLocale(nextLocale)) void setLocale(nextLocale);
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
