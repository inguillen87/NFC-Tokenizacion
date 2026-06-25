"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2, ShieldAlert, WalletCards } from "lucide-react";

type SyncPayload = {
  ok?: boolean;
  error?: string;
  wallet?: { addressMasked?: string | null; chainId?: string | null; network?: string | null } | null;
  consumer?: { displayName?: string | null; email?: string | null; status?: string | null } | null;
};

export function Web3CompleteClient({ nextPath }: { nextPath: string }) {
  const [status, setStatus] = useState<"syncing" | "ready" | "error">("syncing");
  const [payload, setPayload] = useState<SyncPayload | null>(null);

  const safeNext = useMemo(() => {
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) return "/me/wallet";
    return nextPath;
  }, [nextPath]);

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: number | undefined;
    async function sync() {
      setStatus("syncing");
      const response = await fetch("/api/consumer/auth/web3", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }).catch(() => null);
      const data = await response?.json().catch(() => null) as SyncPayload | null;
      if (cancelled) return;
      setPayload(data);
      if (!response?.ok || !data?.ok) {
        setStatus("error");
        return;
      }
      setStatus("ready");
      redirectTimer = window.setTimeout(() => {
        window.location.assign(safeNext);
      }, 900);
    }
    void sync();
    return () => {
      cancelled = true;
      if (redirectTimer) window.clearTimeout(redirectTimer);
    };
  }, [safeNext]);

  const Icon = status === "ready" ? CheckCircle2 : status === "error" ? ShieldAlert : Loader2;

  return (
    <section className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-white shadow-[0_30px_100px_rgba(6,182,212,0.16)]">
      <div className="flex items-start gap-4">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-400/10 text-cyan-200">
          <Icon className={`h-6 w-6 ${status === "syncing" ? "animate-spin" : ""}`} aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-200">nexID Web3 Bridge</p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            {status === "ready" ? "Wallet vinculada al Passport." : status === "error" ? "No se pudo completar Web3." : "Sincronizando tu identidad Web3."}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {status === "ready"
              ? "La sesion consumer quedo activa. Ya podes usar ownership, NFT y marketplace sin repetir el alta por WhatsApp/email."
              : status === "error"
                ? `Detalle: ${payload?.error || "clerk_or_api_sync_failed"}`
                : "Estamos uniendo la identidad Clerk/MetaMask con la sesion consumer nexID."}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-white/10 bg-slate-900/45 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400">Wallet</span>
          <strong className="font-mono text-cyan-100">{payload?.wallet?.addressMasked || "pendiente"}</strong>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-400">Uso</span>
          <strong className="text-emerald-200">NFT / reventa / transferencia</strong>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={safeNext} className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-cyan-200">
          Ir al Passport <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link href="/me/wallet" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-slate-200 transition hover:bg-white/5">
          <WalletCards className="h-4 w-4" aria-hidden="true" />
          Wallet
        </Link>
      </div>
    </section>
  );
}
