"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Info,
  KeyRound,
  Network,
  Shield,
  Wallet,
} from "lucide-react";

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
  if (normalized.includes("already processing") || normalized.includes("request already pending") || normalized.includes("already pending")) {
    return "MetaMask ya tiene una solicitud pendiente. Abre la extension, confirma o cancela y vuelve a intentar.";
  }
  if (normalized.includes("failed to connect to metamask")) {
    return "No pudimos abrir MetaMask. Desbloquea la extension o continua con la opcion de demo.";
  }
  if (normalized.includes("user rejected")) {
    return "Conexion cancelada por el usuario.";
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
  const [message, setMessage] = useState(
    initialWallet?.address
      ? "Wallet asociada al Passport. Ya podes usar ownership, NFT y reventa."
      : "Web3 es opcional: conectalo solo para ownership, NFT, marketplace o transferencias."
  );
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

  async function persistWallet(nextAddress: string, nextChainId: string, network: string) {
    try {
      const response = await fetch("/api/consumer/wallet/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: nextAddress, chainId: nextChainId, network }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; wallet?: { addressMasked?: string | null } } | null;
      if (!response.ok || !payload?.ok) {
        setMessage("Wallet detectada en el navegador. Inicia sesion en el Passport para guardarla permanentemente.");
        return;
      }
      setMessage(`Wallet ${payload.wallet?.addressMasked || shortAddress(nextAddress)} asociada al Passport.`);
    } catch {
      setMessage("Wallet conectada localmente. Hubo una demora al guardar la asociacion en la base de datos.");
    }
  }

  async function connectWallet() {
    const injectedProviders = getInjectedProviders();
    const provider = injectedProviders.find((entry) => entry.isMetaMask) || null;
    setHasMetaMask(Boolean(provider));
    if (!provider) {
      setMessage(
        injectedProviders.length
          ? "Detectamos una billetera inyectada, pero no MetaMask. Para esta demo usa MetaMask o activa la wallet de prueba."
          : "No detectamos MetaMask en este navegador. Podes conectar por Clerk si la extension esta disponible o usar la wallet de prueba."
      );
      return;
    }
    setPending(true);
    try {
      const accounts = await requestWallet(provider, { method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChain = await requestWallet(provider, { method: "eth_chainId" });
      const normalizedChain = typeof nextChain === "string" ? nextChain : "";
      setAddress(nextAddress);
      setChainId(normalizedChain);
      if (nextAddress) {
        await persistWallet(nextAddress, normalizedChain, "metamask");
      } else {
        setMessage("MetaMask no devolvio una cuenta autorizada.");
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
      setMessage("MetaMask no esta disponible en este navegador.");
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
        setMessage("Polygon Amoy quedo listo. Conecta tu cuenta MetaMask para guardarla.");
      }
    } catch (error) {
      setMessage(walletErrorMessage(error, "No se pudo cambiar a Polygon Amoy."));
    } finally {
      setPending(false);
    }
  }

  function continueSandbox() {
    const sandboxAddress = "0xa11ce00000000000000000000000000000000424";
    setAddress(sandboxAddress);
    setChainId(POLYGON_AMOY.chainId);
    void persistWallet(sandboxAddress, POLYGON_AMOY.chainId, "sandbox");
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Web3 opcional
            </p>
            <h3 className="mt-2 text-lg font-black text-white">Wallet y ownership digital</h3>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300">
              Email y WhatsApp siguen siendo el alta liviana post-tap. MetaMask se usa solo cuando queres reclamar propiedad,
              tokenizar un producto premium, venderlo o transferirlo.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            address
              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
              : "border-white/10 bg-slate-950/60 text-slate-400"
          }`}>
            {isSandbox ? "Demo activa" : address ? "Conectada" : "Sin wallet"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <Wallet className="h-5 w-5 text-cyan-200" aria-hidden="true" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Wallet</p>
            <p className="mt-1 truncate font-mono text-sm font-black text-white">{address ? shortAddress(address) : "No conectada"}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <Network className="h-5 w-5 text-violet-200" aria-hidden="true" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Red</p>
            <p className="mt-1 text-sm font-black text-white">{networkLabel}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <Activity className="h-5 w-5 text-emerald-200" aria-hidden="true" />
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Uso</p>
            <p className="mt-1 text-sm font-black text-white">NFT / reventa / ownership</p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_0.92fr]">
        <div className="space-y-3 p-5">
          <Link
            href="/web3/sign-in?next=/me/wallet"
            className="group flex items-center justify-between gap-4 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-4 text-left transition hover:border-cyan-200/60 hover:bg-cyan-300/15"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100">
                <KeyRound className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Verificar con Clerk + MetaMask</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Alta Web3 controlada para wallet, NFT y marketplace.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            disabled={pending}
            onClick={() => void connectWallet()}
            title="Conecta la extension MetaMask del navegador sin tocar el alta por WhatsApp/email."
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-white/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-orange-200">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Conectar MetaMask en navegador</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{hasMetaMask ? "MetaMask detectada." : "Si no aparece, instala o desbloquea la extension."}</p>
              </div>
            </div>
            {address && !isSandbox ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
          </button>

          <button
            type="button"
            disabled={pending || !hasMetaMask || Boolean(address && isSandbox)}
            onClick={() => void addAmoy()}
            title="Agrega o cambia MetaMask a Polygon Amoy para pruebas de tokenizacion."
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-violet-300/30 hover:bg-violet-400/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-violet-200">
                <Network className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Usar Polygon Amoy</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Red de prueba para firmas, certificados y NFT demo.</p>
              </div>
            </div>
            {isAmoy ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
          </button>
        </div>

        <div className="border-t border-white/10 p-5 lg:border-l lg:border-t-0">
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-200" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-white">Demo sin friccion</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80">
                  Para reuniones, la wallet de prueba muestra el flujo completo sin pedir extension. Queda marcada como demo y no reemplaza una firma real.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={continueSandbox}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/35 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/18"
              title="Activa una wallet demo para mostrar ownership sin instalar MetaMask."
            >
              Activar wallet demo <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p className="mt-4 rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-xs leading-5 text-slate-300">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}
