"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, Share, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  return isIos && isSafari;
}

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const inStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(inStandalone);
    setDismissed(window.localStorage.getItem("nexid-pwa-prompt-dismissed") === "1");

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const showIosHint = useMemo(() => !isStandalone && !deferredPrompt && isIosSafari(), [deferredPrompt, isStandalone]);

  if (pathname === "/" || isStandalone || dismissed || (!deferredPrompt && !showIosHint)) return null;

  const onInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") setDeferredPrompt(null);
  };

  const onDismiss = () => {
    setDismissed(true);
    window.localStorage.setItem("nexid-pwa-prompt-dismissed", "1");
  };

  return (
    <div className="pwa-install-card fixed inset-x-0 bottom-[11rem] z-40 mx-auto w-[min(94vw,30rem)] rounded-2xl border border-cyan-300/25 bg-slate-950/90 p-3 shadow-[0_16px_40px_rgba(8,15,30,0.55)] backdrop-blur-xl md:bottom-4 md:right-4 md:left-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Install app</p>
          <p className="mt-1 text-sm text-slate-100">
            {showIosHint
              ? "On iPhone/iPad: tap Share and choose Add to Home Screen for full-screen mode."
              : "Launch nexID in full-screen with faster access and app-like navigation."}
          </p>
        </div>
        <button suppressHydrationWarning type="button" onClick={onDismiss} className="rounded-lg border border-white/15 p-1.5 text-slate-300" aria-label="Dismiss install prompt">
          <X className="h-4 w-4" />
        </button>
      </div>

      {showIosHint ? (
        <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100">
          <Share className="h-4 w-4" /> Share - Add to Home Screen
        </div>
      ) : (
        <button suppressHydrationWarning type="button" onClick={onInstall} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100">
          <Download className="h-4 w-4" /> Install nexID
        </button>
      )}
    </div>
  );
}
