"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
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
import styles from "./sun-locale-feedback.module.css";

type SunLocaleContextValue = {
  locale: SunLocale;
  setLocale: (locale: SunLocale) => Promise<void>;
  localePending: boolean;
  localeError: string | null;
  localeTarget: SunLocale | null;
  text: (value: string) => string;
};

const SunLocaleContext = createContext<SunLocaleContextValue | null>(null);

const TRANSLATED_ATTRIBUTES = ["aria-label", "placeholder", "title"] as const;
const LOCALE_REQUEST_TIMEOUT_MS = 8_000;

type LocaleRequest = {
  controller: AbortController;
  sequence: number;
  cancel: () => void;
};

function shouldSkipTextNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  if (["SCRIPT", "STYLE", "CODE", "PRE"].includes(parent.tagName)) return true;
  return Boolean(parent.closest("[data-sun-server-evidence='true']"));
}

function localizeTree(root: HTMLElement, locale: SunLocale) {
  if (root.closest("[data-sun-server-evidence='true']")) return;
  const nodes = (selector: string) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll<HTMLElement>(selector)];
  for (const element of nodes("[data-sun-datetime]")) {
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

  for (const element of nodes("[aria-label], [placeholder], [title]")) {
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
  const [localeTarget, setLocaleTarget] = useState<SunLocale | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const translatingRef = useRef(false);
  const committedLocaleRef = useRef(initialLocale);
  const mountedRef = useRef(true);
  const localeSequenceRef = useRef(0);
  const localeRequestRef = useRef<LocaleRequest | null>(null);

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
    if (!mountedRef.current || !isSunLocale(nextLocale)) return;

    localeRequestRef.current?.cancel();
    localeRequestRef.current = null;
    if (nextLocale === committedLocaleRef.current) {
      setLocalePending(false);
      setLocaleError(null);
      setLocaleTarget(null);
      return;
    }

    const controller = new AbortController();
    const sequence = ++localeSequenceRef.current;
    let rejectRequest!: (reason: Error) => void;
    let timedOut = false;
    const interrupted = new Promise<never>((_, reject) => { rejectRequest = reject; });
    // Abort is advisory: a stalled transport must still release the control on time.
    const timeout = window.setTimeout(() => {
      timedOut = true;
      rejectRequest(new Error("locale_preference_timeout"));
      controller.abort();
    }, LOCALE_REQUEST_TIMEOUT_MS);
    const request: LocaleRequest = {
      controller,
      sequence,
      cancel: () => {
        window.clearTimeout(timeout);
        controller.abort();
        rejectRequest(new Error("locale_request_cancelled"));
      },
    };
    localeRequestRef.current = request;
    const isCurrent = () => mountedRef.current && localeSequenceRef.current === sequence && localeRequestRef.current === request;
    setLocalePending(true);
    setLocaleError(null);
    setLocaleTarget(nextLocale);

    try {
      const response = await Promise.race([fetch("/api/sun/locale", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
        cache: "no-store",
        signal: controller.signal,
      }), interrupted]);
      if (!isCurrent() || controller.signal.aborted) return;
      if (!response.ok) throw new Error("locale_preference_not_saved");

      committedLocaleRef.current = nextLocale;
      setLocaleState(nextLocale);
      setLocaleTarget(null);
    } catch {
      if (!isCurrent()) return;
      setLocaleError(timedOut ? "locale_preference_timeout" : "locale_preference_not_saved");
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent()) {
        localeRequestRef.current = null;
        setLocalePending(false);
      }
    }
  }, []);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const request = localeRequestRef.current;
      localeRequestRef.current = null;
      request?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    applyLocale(locale);
    const root = rootRef.current;
    if (!root) return;

    // Only mutated subtrees need translation; consent/map updates must not traverse the whole passport.
    const observer = new MutationObserver((records) => {
      if (translatingRef.current) return;
      const roots = new Set<HTMLElement>();
      for (const record of records) {
        const changed = record.type === "characterData" ? [record.target] : [...record.addedNodes];
        for (const node of changed) {
          const element = node instanceof HTMLElement ? node : node.parentElement;
          if (!element || !root.contains(element) || element.closest("[data-sun-server-evidence='true']")) continue;
          roots.add(element);
        }
      }
      if (!roots.size) return;
      observer.disconnect();
      try { for (const element of roots) if (![...roots].some(parent => parent !== element && parent.contains(element))) localizeTree(element, locale); }
      finally { observer.observe(root, { childList: true, subtree: true, characterData: true }); }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [applyLocale, locale]);

  const value = useMemo<SunLocaleContextValue>(() => ({
    locale,
    setLocale,
    localePending,
    localeError,
    localeTarget,
    text: (source) => translateSunUiText(source, locale),
  }), [locale, localeError, localePending, localeTarget, setLocale]);

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

const FEEDBACK: Record<SunLocale, { pending: string; error: string; retry: string }> = {
  "es-AR": { pending: "Cambiando a", error: "No pudimos confirmar el idioma. Reintentá.", retry: "Reintentar:" },
  "pt-BR": { pending: "Mudando para", error: "Não foi possível confirmar o idioma. Tente novamente.", retry: "Tentar novamente:" },
  en: { pending: "Changing to", error: "We could not confirm the language. Please try again.", retry: "Retry:" },
};

export function SunLocaleSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale, localePending, localeError, localeTarget } = useSunLocale();
  const feedbackId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const initiatedHereRef = useRef(false);
  const copy = FEEDBACK[locale];
  const hasFeedback = localePending || Boolean(localeError && localeTarget);

  useLayoutEffect(() => {
    if (localePending || !initiatedHereRef.current) return;
    initiatedHereRef.current = false;
    const active = document.activeElement;
    // Restore the local keyboard path without taking focus from another action.
    if (active !== document.body && active !== document.documentElement && active !== selectRef.current && active !== retryRef.current) return;
    if (localeError && localeTarget) retryRef.current?.focus();
    else selectRef.current?.focus();
  }, [localePending, localeError, localeTarget]);

  return (
    <div className={`${styles.switcher} ${className}`}>
      <label className={`locale-switcher inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-0 text-xs font-semibold text-slate-200 ${styles.control}`}>
        <span aria-hidden className="locale-switcher__icon">ID</span>
        <select
          ref={selectRef}
          value={locale}
          disabled={localePending}
          aria-busy={localePending}
          data-locale-error={localeError || undefined}
          className="min-h-11 bg-transparent pr-1 text-xs font-semibold"
          aria-label={ARIA_LABELS[locale]}
          aria-describedby={hasFeedback ? feedbackId : undefined}
          onChange={(event) => {
            const nextLocale = event.target.value;
            if (isSunLocale(nextLocale)) {
              initiatedHereRef.current = true;
              void setLocale(nextLocale);
            }
          }}
        >
          {SUN_LOCALES.map((item) => (
            <option key={item} value={item} className="locale-switcher__option">
              {LABELS[item]}
            </option>
          ))}
        </select>
      </label>
      {hasFeedback && <div className={styles.feedback} data-sun-locale-feedback data-locale-state={localePending ? "pending" : "error"}>
        <p id={feedbackId} className={styles.message} role="status" aria-live="polite" aria-atomic="true">
          {localePending && localeTarget ? copy.pending + " " + LABELS[localeTarget] + "…" : copy.error}
        </p>
        {!localePending && localeError && localeTarget && <button
          ref={retryRef}
          type="button"
          className={styles.retry}
          onClick={() => {
            initiatedHereRef.current = true;
            void setLocale(localeTarget);
          }}
        >{copy.retry + " " + LABELS[localeTarget]}</button>}
      </div>}
    </div>
  );
}
