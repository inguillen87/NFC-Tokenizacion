"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PromptLocale = "es-AR" | "pt-BR" | "en";

const promptCopy = {
  "es-AR": {
    title: "Instalá nexID",
    nativeDescription: "Abrí nexID como una app, con acceso más rápido y una experiencia optimizada.",
    iosDescription: "En iPhone o iPad, tocá Compartir y después Agregar a inicio.",
    install: "Instalar nexID",
    iosAction: "Compartir · Agregar a inicio",
    dismiss: "Cerrar sugerencia de instalación",
    region: "Instalar la aplicación nexID",
  },
  "pt-BR": {
    title: "Instale a nexID",
    nativeDescription: "Abra a nexID como um aplicativo, com acesso mais rápido e uma experiência otimizada.",
    iosDescription: "No iPhone ou iPad, toque em Compartilhar e depois em Adicionar à Tela de Início.",
    install: "Instalar nexID",
    iosAction: "Compartilhar · Adicionar à tela inicial",
    dismiss: "Fechar sugestão de instalação",
    region: "Instalar o aplicativo nexID",
  },
  en: {
    title: "Install nexID",
    nativeDescription: "Open nexID as an app for faster access and an experience optimized for your device.",
    iosDescription: "On iPhone or iPad, tap Share and then Add to Home Screen.",
    install: "Install nexID",
    iosAction: "Share · Add to Home Screen",
    dismiss: "Close install suggestion",
    region: "Install the nexID app",
  },
} as const;

function normalizeLocale(locale: string): PromptLocale {
  if (locale === "pt-BR" || locale.toLowerCase().startsWith("pt")) return "pt-BR";
  if (locale === "en" || locale.toLowerCase().startsWith("en")) return "en";
  return "es-AR";
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && isSafari;
}

export function PwaInstallPrompt({ locale = "es-AR" }: { locale?: string }) {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [ready, setReady] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const copy = useMemo(() => promptCopy[normalizeLocale(locale)], [locale]);
  const criticalJourney = pathname === "/sun"
    || pathname.startsWith("/s/")
    || pathname.startsWith("/r/")
    || pathname.startsWith("/offline")
    || pathname.startsWith("/me")
    || pathname.startsWith("/login")
    || pathname.startsWith("/web3/");

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
    const updateStandalone = () => {
      const standalone = displayMode.matches || standaloneNavigator.standalone === true;
      setIsStandalone(standalone);
      setShowIosHint(!standalone && isIosSafari());
    };

    updateStandalone();
    try {
      setDismissed(window.localStorage.getItem("nexid-pwa-prompt-dismissed") === "1");
    } catch {
      // Private browsing can make storage unavailable; installation should still work.
    }
    setReady(true);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setShowIosHint(false);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };
    const engagementTimer = window.setTimeout(() => setEngaged(true), 12_000);
    const onScroll = () => {
      if (window.scrollY < Math.max(480, window.innerHeight * 0.7)) return;
      setEngaged(true);
      window.removeEventListener("scroll", onScroll);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    window.addEventListener("scroll", onScroll, { passive: true });
    displayMode.addEventListener?.("change", updateStandalone);
    return () => {
      window.clearTimeout(engagementTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      window.removeEventListener("scroll", onScroll);
      displayMode.removeEventListener?.("change", updateStandalone);
    };
  }, []);

  const onDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem("nexid-pwa-prompt-dismissed", "1");
    } catch {
      // Dismissing the prompt must remain possible without storage access.
    }
  };

  const onInstall = async () => {
    if (!deferredPrompt) return;
    const prompt = deferredPrompt;
    setDeferredPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "dismissed") onDismiss();
    } catch {
      // The browser owns the install UI. If it becomes unavailable, hide this stale prompt.
    }
  };

  if (criticalJourney || !ready || !engaged || isStandalone || dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:flex md:justify-end md:p-4 md:pb-[max(1rem,env(safe-area-inset-bottom))] md:pl-[max(1rem,env(safe-area-inset-left))] md:pr-[max(1rem,env(safe-area-inset-right))]">
      <section
        className="pwa-install-card pointer-events-auto w-full max-w-[30rem] rounded-2xl border border-slate-200/90 bg-white/95 p-4 text-slate-950 shadow-[0_18px_55px_rgba(15,23,42,0.18)] backdrop-blur-xl"
        role="region"
        aria-label={copy.region}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 py-1">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">{copy.title}</p>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              {showIosHint ? copy.iosDescription : copy.nativeDescription}
            </p>
          </div>
          <button
            suppressHydrationWarning
            type="button"
            onClick={onDismiss}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-cyan-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/25"
            aria-label={copy.dismiss}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {showIosHint ? (
          <div className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-center text-sm font-bold text-cyan-900">
            <Share className="h-5 w-5 shrink-0" aria-hidden /> {copy.iosAction}
          </div>
        ) : (
          <button
            suppressHydrationWarning
            type="button"
            onClick={onInstall}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-700 bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white transition hover:border-cyan-800 hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-500/30"
          >
            <Download className="h-5 w-5" aria-hidden /> {copy.install}
          </button>
        )}
      </section>
    </div>
  );
}
