"use client";

import { useClerk } from "@clerk/nextjs";
import { useMemo, useState } from "react";
import { ExternalLink, Loader2, WalletCards } from "lucide-react";

function toAbsoluteUrl(path: string) {
  if (typeof window === "undefined") return path;
  try {
    return new URL(path, window.location.origin).toString();
  } catch {
    return window.location.origin + "/web3/complete?next=%2Fme%2Fwallet";
  }
}

function metamaskMobileLink(path: string) {
  if (typeof window === "undefined") return "";
  const url = new URL(path, window.location.origin);
  return `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}${url.hash}`;
}

function signInErrorMessage(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("metamask") && (normalized.includes("not found") || normalized.includes("not installed"))) {
    return "MetaMask no está disponible en este navegador. Abrí esta pantalla desde MetaMask Mobile o desbloqueá la extensión.";
  }
  if (normalized.includes("already pending") || normalized.includes("already processing")) {
    return "MetaMask ya tiene una firma pendiente. Abrí la extensión, confirmá o cancelá, y volvé a intentar.";
  }
  if (normalized.includes("user rejected") || normalized.includes("rejected")) {
    return "Firma cancelada. No se vinculó ninguna wallet.";
  }
  return message || "No se pudo iniciar la firma Web3 con Clerk.";
}

export function MetamaskPrimaryButton({ redirectUrl }: { redirectUrl: string }) {
  const clerk = useClerk();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const absoluteRedirectUrl = useMemo(() => toAbsoluteUrl(redirectUrl), [redirectUrl]);
  const mobileUrl = useMemo(() => metamaskMobileLink(redirectUrl), [redirectUrl]);

  async function signWithMetamask() {
    setPending(true);
    setMessage("Abriendo MetaMask para firmar ownership...");
    try {
      await clerk.authenticateWithMetamask({
        redirectUrl: absoluteRedirectUrl,
        signUpContinueUrl: absoluteRedirectUrl,
        legalAccepted: true,
        customNavigate: async (to) => {
          window.location.assign(toAbsoluteUrl(to));
        },
      });
    } catch (error) {
      setMessage(signInErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => void signWithMetamask()}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_18px_45px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-75"
        title="Firmar con MetaMask y volver al Passport nexID."
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <WalletCards className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Esperando firma..." : "Firmar con MetaMask"}
      </button>
      <a
        href={mobileUrl || "#"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/65 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-cyan-300/35 hover:text-cyan-100"
        title="Abrir esta pantalla dentro del navegador de MetaMask Mobile."
      >
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        Abrir en MetaMask Mobile
      </a>
      {message ? <p className="rounded-xl border border-white/10 bg-slate-950/55 px-3 py-2 text-xs leading-5 text-cyan-50/80">{message}</p> : null}
    </div>
  );
}
