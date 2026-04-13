"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    const storedDismissed = window.localStorage.getItem("nexid-pwa-prompt-dismissed") === "1";
    setDismissed(storedDismissed);

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  if (!deferredPrompt || dismissed) {
    return null;
  }

  const onInstall = async () => {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const onDismiss = () => {
    setDismissed(true);
    window.localStorage.setItem("nexid-pwa-prompt-dismissed", "1");
  };

  return (
    <div className="pwa-install-card fixed inset-x-0 bottom-[5.5rem] z-40 mx-auto w-[min(94vw,30rem)] rounded-2xl border border-cyan-300/25 bg-slate-950/90 p-3 shadow-[0_16px_40px_rgba(8,15,30,0.55)] backdrop-blur-xl md:bottom-4 md:right-4 md:left-auto">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">Install app</p>
          <p className="mt-1 text-sm text-slate-100">Launch nexID in full-screen with faster access and app-like navigation.</p>
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg border border-white/15 p-1.5 text-slate-300">
          <X className="h-4 w-4" />
        </button>
      </div>
      <button type="button" onClick={onInstall} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-500/15 px-3 py-2.5 text-sm font-semibold text-cyan-100">
        <Download className="h-4 w-4" /> Install nexID
      </button>
    </div>
  );
}
