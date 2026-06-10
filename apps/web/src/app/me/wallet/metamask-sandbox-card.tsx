"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, Info, CheckCircle2, ChevronRight, HelpCircle, Shield, ArrowRight, Activity } from "lucide-react";

type EthereumProvider = {
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown> | unknown;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const POLYGON_AMOY = {
  chainId: "0x13882",
  chainName: "Polygon Amoy",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: ["https://rpc-amoy.polygon.technology"],
  blockExplorerUrls: ["https://amoy.polygonscan.com"],
};

function shortAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function walletErrorMessage(error: unknown, fallback: string) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : "";

  const normalized = message.toLowerCase();
  if (normalized.includes("already processing") || normalized.includes("request already pending")) {
    return "Ya hay una solicitud de wallet pendiente. Abre MetaMask en tu navegador, confirma y vuelve a intentar.";
  }
  if (normalized.includes("failed to connect to metamask")) {
    return "No pudimos abrir MetaMask. Desbloquea la extensión o sigue en modo sandbox sin wallet.";
  }
  if (normalized.includes("already pending")) {
    return "MetaMask ya tiene una solicitud pendiente. Revísala en la extensión.";
  }
  if (normalized.includes("user rejected")) {
    return "Conexión cancelada por el usuario.";
  }
  return message || fallback;
}

async function requestWallet(provider: EthereumProvider, args: { method: string; params?: unknown[] }) {
  return Promise.resolve(provider.request(args));
}

function getInjectedProviders() {
  if (typeof window === "undefined" || !window.ethereum) return [] as EthereumProvider[];
  const root = window.ethereum;
  return Array.isArray(root.providers) && root.providers.length ? root.providers : [root];
}

function findMetaMaskProvider() {
  return getInjectedProviders().find((provider) => provider.isMetaMask) || null;
}

export function MetamaskSandboxCard({
  initialWallet,
}: {
  initialWallet?: { address?: string | null; chainId?: string | null; network?: string | null; verifiedAt?: string | null } | null;
}) {
  const [address, setAddress] = useState(initialWallet?.address || "");
  const [chainId, setChainId] = useState(initialWallet?.chainId || "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(initialWallet?.address ? "Billetera vinculada correctamente a tu Pasaporte." : "Tu billetera está lista para ser configurada.");
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const isAmoy = chainId.toLowerCase() === POLYGON_AMOY.chainId.toLowerCase();
  const isSandbox = address.toLowerCase() === "0xa11ce00000000000000000000000000000000424";
  
  const networkLabel = useMemo(() => {
    if (!chainId) return "Sin red";
    if (isAmoy) return "Polygon Amoy";
    return `Chain ${chainId}`;
  }, [chainId, isAmoy]);

  useEffect(() => {
    const provider = findMetaMaskProvider();
    setHasMetaMask(Boolean(provider));
    if (!provider) return;

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? args[0] : [];
      setAddress(typeof accounts[0] === "string" ? accounts[0] : "");
    };
    const onChainChanged = (...args: unknown[]) => {
      setChainId(typeof args[0] === "string" ? args[0] : "");
    };

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    void requestWallet(provider, { method: "eth_chainId" })
      .then((nextChain) => setChainId(typeof nextChain === "string" ? nextChain : ""))
      .catch(() => undefined);

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
    };
  }, []);

  async function connectWallet() {
    const injectedProviders = getInjectedProviders();
    const provider = injectedProviders.find((entry) => entry.isMetaMask) || null;
    const hasInjectedProvider = injectedProviders.length > 0;
    setHasMetaMask(Boolean(provider));
    if (!provider) {
      setMessage(hasInjectedProvider
        ? "Detectamos una billetera inyectada, pero no MetaMask. Puedes continuar usando la Billetera Sandbox rápida."
        : "No detectamos la extensión de MetaMask. No te preocupes, puedes usar el botón Sandbox de abajo para simular.");
      return;
    }
    setPending(true);
    try {
      const accounts = await requestWallet(provider, { method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChain = await requestWallet(provider, { method: "eth_chainId" });
      setAddress(nextAddress);
      const normalizedChain = typeof nextChain === "string" ? nextChain : "";
      setChainId(normalizedChain);
      if (nextAddress) {
        await persistWallet(nextAddress, normalizedChain, "metamask");
      } else {
        setMessage("No se recibió una cuenta autorizada.");
      }
    } catch (error) {
      setMessage(walletErrorMessage(error, "No se pudo conectar MetaMask."));
    } finally {
      setPending(false);
    }
  }

  async function addAmoy() {
    const provider = findMetaMaskProvider();
    if (!provider) {
      setMessage("MetaMask no está disponible. Activa el modo Sandbox rápido.");
      return;
    }
    setPending(true);
    try {
      try {
        await requestWallet(provider, { method: "wallet_switchEthereumChain", params: [{ chainId: POLYGON_AMOY.chainId }] });
      } catch (switchError) {
        const code = typeof switchError === "object" && switchError && "code" in switchError ? Number((switchError as { code?: unknown }).code) : 0;
        if (code !== 4902) throw switchError;
        await requestWallet(provider, { method: "wallet_addEthereumChain", params: [POLYGON_AMOY] });
      }
      const nextChain = await requestWallet(provider, { method: "eth_chainId" });
      const normalizedChain = typeof nextChain === "string" ? nextChain : POLYGON_AMOY.chainId;
      setChainId(normalizedChain);
      if (address) {
        await persistWallet(address, normalizedChain, "metamask");
      } else {
        setMessage("Polygon Amoy listo. Conecta tu cuenta MetaMask para guardarla.");
      }
    } catch (error) {
      setMessage(walletErrorMessage(error, "No se pudo cambiar a Polygon Amoy."));
    } finally {
      setPending(false);
    }
  }

  async function persistWallet(nextAddress: string, nextChainId: string, network: string) {
    try {
      const response = await fetch("/api/consumer/wallet/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: nextAddress, chainId: nextChainId, network }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; wallet?: { addressMasked?: string | null } } | null;
      if (!response.ok || !payload?.ok) {
        setMessage("Wallet conectada en navegador, pero inicia sesión en el Pasaporte para guardarla permanentemente.");
        return;
      }
      setMessage(`Billetera ${payload.wallet?.addressMasked || shortAddress(nextAddress)} asociada exitosamente.`);
    } catch {
      setMessage("Conectado localmente. Ocurrió una demora al guardarla en la base de datos.");
    }
  }

  function continueSandbox() {
    const sandboxAddress = "0xa11ce00000000000000000000000000000000424";
    setAddress(sandboxAddress);
    setChainId(POLYGON_AMOY.chainId);
    void persistWallet(sandboxAddress, POLYGON_AMOY.chainId, "sandbox");
  }

  return (
    <section className="rounded-3xl border border-violet-500/20 bg-gradient-to-b from-slate-950 to-slate-900/90 p-5 shadow-2xl">
      {/* Stepper Header */}
      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Vinculación Web3</p>
          </div>
          <h3 className="mt-1.5 text-base font-black text-white">Tu Caja Fuerte Digital (Wallet)</h3>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Asocia tu cuenta para guardar certificados criptográficos de tus vinos o productos premium.
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
          address 
            ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-300" 
            : "border-white/10 bg-slate-950/60 text-slate-400"
        }`}>
          {isSandbox ? "Sandbox" : address ? "Conectada" : "Sin Vincular"}
        </span>
      </div>

      {/* Explicador simple para no técnicos (ej. bodegueros, clientes de vinos) */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-slate-900/40 p-3 text-[11px] leading-5 text-slate-300 flex items-start gap-2.5">
        <Info className="h-4 w-4 shrink-0 text-violet-400 mt-0.5" />
        <div>
          <span className="font-bold text-white">¿Qué es una Billetera (Wallet)?</span>
          <p className="mt-0.5">
            Es tu caja fuerte digital. Te permite demostrar que eres el dueño legítimo de las botellas autenticadas por nexID y participar de preventas exclusivas sin intermediarios.
          </p>
        </div>
      </div>

      {/* 3 Guided Interactive Steps */}
      <div className="mt-6 space-y-4">
        {/* Step 1: Connect MetaMask */}
        <div className={`relative rounded-2xl border p-4 transition duration-300 ${
          address && !isSandbox 
            ? "border-emerald-500/25 bg-emerald-500/5" 
            : "border-white/5 bg-slate-950/30"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
              address && !isSandbox
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-slate-900 text-slate-400"
            }`}>
              {address && !isSandbox ? <CheckCircle2 className="h-4 w-4" /> : "1"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                Conectar Billetera Real (MetaMask)
                <span className="text-slate-500 font-normal">🦊</span>
              </h4>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Abre la extensión para autorizar la conexión.
              </p>
              {address && !isSandbox ? (
                <div className="mt-2 text-[11px] font-mono text-emerald-300 bg-emerald-950/30 rounded px-2 py-1 inline-block">
                  Cuenta: {shortAddress(address)}
                </div>
              ) : (
                <button suppressHydrationWarning
                  type="button"
                  disabled={pending}
                  onClick={() => void connectWallet()}
                  className="mt-2.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-200 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed"
                >
                  Conectar 🦊
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 2: Switch Network */}
        <div className={`relative rounded-2xl border p-4 transition duration-300 ${
          isAmoy 
            ? "border-emerald-500/25 bg-emerald-500/5" 
            : "border-white/5 bg-slate-950/30"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
              isAmoy
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-slate-900 text-slate-400"
            }`}>
              {isAmoy ? <CheckCircle2 className="h-4 w-4" /> : "2"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-white">Configurar Red Criptográfica</h4>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Utiliza la red Polygon Amoy para firmar tus certificados.
              </p>
              {isAmoy ? (
                <div className="mt-2 text-[11px] font-bold text-emerald-300 bg-emerald-950/30 rounded px-2 py-1 inline-block uppercase tracking-wider">
                  Red: Polygon Amoy OK 💜
                </div>
              ) : (
                <button suppressHydrationWarning
                  type="button"
                  disabled={pending || !hasMetaMask || Boolean(address && isSandbox)}
                  onClick={() => void addAmoy()}
                  className="mt-2.5 rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Cambiar Red 💜
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Sandbox mode alternative */}
        <div className={`relative rounded-2xl border p-4 transition duration-300 ${
          isSandbox 
            ? "border-emerald-500/25 bg-emerald-500/5" 
            : "border-white/5 bg-slate-950/30"
        }`}>
          <div className="flex items-start gap-3">
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
              isSandbox
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
                : "border-white/10 bg-slate-900 text-slate-400"
            }`}>
              {isSandbox ? <CheckCircle2 className="h-4 w-4" /> : "3"}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-black text-white">¿No tienes MetaMask? Usa Billetera de Pruebas</h4>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">
                Activa una billetera virtual de nexID en 1 segundo para ver el flujo de propiedad sin instalar nada.
              </p>
              {isSandbox ? (
                <div className="mt-2 text-[11px] font-bold text-emerald-300 bg-emerald-950/30 rounded px-2 py-1 inline-block uppercase tracking-wider">
                  Billetera Sandbox Activa ⚡
                </div>
              ) : (
                <button suppressHydrationWarning
                  type="button"
                  onClick={continueSandbox}
                  className="mt-2.5 rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  Activar Sandbox Rápido ⚡
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Info status logs */}
      <p className="mt-5 rounded-xl border border-white/5 bg-slate-950/60 p-3 text-[11px] leading-5 text-slate-300 italic text-center">
        {message}
      </p>
    </section>
  );
}
