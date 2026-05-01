"use client";

import { useEffect } from "react";

function walletExtensionMessage(value: unknown) {
  if (!value) return "";
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message || "");
  return String(value);
}

function isKnownWalletExtensionNoise(message: string, source?: string) {
  const normalized = `${message} ${source || ""}`.toLowerCase();
  return (
    normalized.includes("failed to connect to metamask") ||
    normalized.includes("metamask") && normalized.includes("already pending") ||
    normalized.includes("chrome-extension://") && normalized.includes("inpage.js")
  );
}

export function WalletExtensionGuard() {
  useEffect(() => {
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
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
