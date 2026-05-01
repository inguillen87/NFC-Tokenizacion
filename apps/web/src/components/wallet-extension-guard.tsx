"use client";

import { useEffect } from "react";

function walletExtensionMessage(value: unknown) {
  if (!value) return "";
  if (value instanceof Error) return `${value.message}\n${value.stack || ""}`;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "message" in value) {
    const errorLike = value as { message?: unknown; stack?: unknown };
    return `${String(errorLike.message || "")}\n${String(errorLike.stack || "")}`;
  }
  return String(value);
}

function isKnownWalletExtensionNoise(message: string, source?: string) {
  const normalized = `${message} ${source || ""}`.toLowerCase();
  return (
    normalized.includes("fdprocessedid") ||
    normalized.includes("failed to connect to metamask") ||
    (normalized.includes("metamask") && normalized.includes("already pending")) ||
    (normalized.includes("unexpected error") && normalized.includes("chrome-extension://")) ||
    (normalized.includes("chrome-extension://") && normalized.includes("inpage.js")) ||
    normalized.includes("evmask.js") ||
    normalized.includes("contentscript.js") ||
    normalized.includes("lockdown-install.js") ||
    normalized.includes("polkadot{.js}") ||
    normalized.includes("[phantom] failed to send message") ||
    normalized.includes("attempting to use a disconnected port object") ||
    normalized.includes("no matching tab found") ||
    normalized.includes("ses removing unpermitted intrinsics")
  );
}

export function WalletExtensionGuard() {
  useEffect(() => {
    const originalError = console.error;
    const originalWarn = console.warn;
    const shouldSilenceConsole = (args: unknown[]) => isKnownWalletExtensionNoise(args.map(walletExtensionMessage).join("\n"));

    console.error = (...args: unknown[]) => {
      if (shouldSilenceConsole(args)) return;
      originalError(...args);
    };
    console.warn = (...args: unknown[]) => {
      if (shouldSilenceConsole(args)) return;
      originalWarn(...args);
    };

    const onError = (event: ErrorEvent) => {
      const message = walletExtensionMessage(event.error) || event.message;
      if (!isKnownWalletExtensionNoise(message, event.filename)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      console.info("[nexID] Wallet extension warning silenced:", message);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const message = walletExtensionMessage(event.reason);
      if (!isKnownWalletExtensionNoise(message)) return;
      event.preventDefault();
      console.info("[nexID] Wallet extension rejection silenced:", message);
    };

    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
