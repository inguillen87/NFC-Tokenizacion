// Real SUN provider, controls and header. Only the locale transport is synthetic.
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { SunLocaleProvider, SunLocaleSwitcher, useSunLocale } from "../../src/app/sun/sun-locale-provider";
import { SunPassportHeader } from "../../src/app/sun/sun-passport-header";
import { isSunLocale } from "../../src/app/sun/sun-locale";

type RequestRecord = {
  url: string;
  method?: string;
  body?: BodyInit | null;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  signal?: AbortSignal | null;
  resolve: (status: number) => void;
  reject: () => void;
};

declare global {
  interface Window {
    __localeQA: {
      requests: RequestRecord[];
      unexpectedFetches: string[];
      completedOperations: number;
      deadlines: Set<number>;
      transportAbortBehavior: "ignore" | "reject" | "resolve";
      transportAbortEvents: number;
    };
  }
}

window.__localeQA = { requests: [], unexpectedFetches: [], completedOperations: 0, deadlines: new Set(), transportAbortBehavior: "ignore", transportAbortEvents: 0 };
const nativeSetTimeout = window.setTimeout.bind(window);
const nativeClearTimeout = window.clearTimeout.bind(window);
window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
  if (delay !== 8_000 || typeof handler !== "function") return nativeSetTimeout(handler, delay, ...args);
  const id = nativeSetTimeout(() => {
    window.__localeQA.deadlines.delete(id);
    handler(...args);
  }, delay);
  window.__localeQA.deadlines.add(id);
  return id;
}) as typeof window.setTimeout;
window.clearTimeout = ((id?: number) => {
  if (id !== undefined) window.__localeQA.deadlines.delete(id);
  nativeClearTimeout(id);
}) as typeof window.clearTimeout;

window.fetch = ((input: RequestInfo | URL, options?: RequestInit) => {
  const url = String(input);
  if (url !== "/api/sun/locale" || options?.method !== "POST") {
    window.__localeQA.unexpectedFetches.push(url);
    return Promise.reject(new Error("unexpected_fixture_request"));
  }
  const abortBehavior = window.__localeQA.transportAbortBehavior;
  return new Promise<Response>((resolve, reject) => {
    window.__localeQA.requests.push({
      url, method: options.method, body: options.body, credentials: options.credentials,
      cache: options.cache, signal: options.signal,
      resolve: (status) => resolve(new Response(null, { status })),
      reject: () => reject(new TypeError("Synthetic transport failure: do not expose this detail")),
    });
    if (abortBehavior !== "ignore") options.signal?.addEventListener("abort", () => {
      window.__localeQA.transportAbortEvents++;
      if (abortBehavior === "resolve") resolve(new Response(null, { status: 200 }));
      else reject(new DOMException("Synthetic request aborted", "AbortError"));
    }, { once: true });
  });
}) as typeof window.fetch;

function Content({ standalone }: { standalone: boolean }) {
  const { locale, setLocale, localePending, localeError } = useSunLocale();
  useEffect(() => {
    const change = (event: Event) => {
      const requested = (event as CustomEvent<string>).detail;
      if (isSunLocale(requested)) void setLocale(requested).finally(() => { window.__localeQA.completedOperations++; });
    };
    window.addEventListener("fixture-locale", change);
    return () => window.removeEventListener("fixture-locale", change);
  }, [setLocale]);
  return <>
    {standalone ? <SunLocaleSwitcher /> : <SunPassportHeader isQrScan={false} livePillLabel="Muestra demo" pulseClass="" />}
    <output id="fixture-state" data-locale={locale} data-pending={String(localePending)} data-error={localeError || ""} />
    <p id="translated-copy">Controles del pasaporte</p>
    <p id="server-evidence" data-sun-server-evidence="true">Lectura NFC verificada</p>
    <button id="outside">Outside control</button>
  </>;
}

function Fixture() {
  const query = new URLSearchParams(location.search);
  const requested = query.get("locale");
  const initialLocale = isSunLocale(requested) ? requested : "es-AR";
  const [mounted, setMounted] = useState(true);
  useEffect(() => {
    const unmount = () => setMounted(false);
    window.addEventListener("fixture-unmount", unmount);
    return () => window.removeEventListener("fixture-unmount", unmount);
  }, []);
  return <StrictMode>{mounted ? <SunLocaleProvider initialLocale={initialLocale}>
    <Content standalone={query.get("standalone") === "1"} />
  </SunLocaleProvider> : <p id="fixture-unmounted">Provider unmounted</p>}</StrictMode>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
