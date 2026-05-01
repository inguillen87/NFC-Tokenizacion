"use client";

import { useEffect, useMemo, useState } from "react";

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
    return "Ya hay una solicitud de wallet pendiente. Abrí MetaMask, resolvela y volvé a intentar.";
  }
  if (normalized.includes("failed to connect to metamask")) {
    return "No pudimos abrir MetaMask. Desbloquea la extension o segui en modo sandbox sin wallet.";
  }
  if (normalized.includes("already pending")) {
    return "MetaMask ya tiene una solicitud pendiente. Revisala en la extension.";
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

export function MetamaskSandboxCard() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Listo para conectar wallet sandbox.");
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const isAmoy = chainId.toLowerCase() === POLYGON_AMOY.chainId.toLowerCase();
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
        ? "Detectamos una wallet, pero no MetaMask. Podes usar sandbox o instalar/desbloquear MetaMask."
        : "MetaMask no esta disponible en este navegador. Podes continuar en modo sandbox.");
      return;
    }
    setPending(true);
    try {
      const accounts = await requestWallet(provider, { method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChain = await requestWallet(provider, { method: "eth_chainId" });
      setAddress(nextAddress);
      setChainId(typeof nextChain === "string" ? nextChain : "");
      setMessage(nextAddress ? "Wallet conectada localmente. Todavia no se envia al backend." : "No se recibio una cuenta.");
    } catch (error) {
      setMessage(walletErrorMessage(error, "No se pudo conectar MetaMask."));
    } finally {
      setPending(false);
    }
  }

  async function addAmoy() {
    const provider = findMetaMaskProvider();
    if (!provider) {
      setMessage("MetaMask no esta disponible. Podes mostrar el flujo con sandbox sin bloquear la demo.");
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
      setChainId(typeof nextChain === "string" ? nextChain : POLYGON_AMOY.chainId);
      setMessage("Polygon Amoy listo para pruebas de tokenizacion.");
    } catch (error) {
      setMessage(walletErrorMessage(error, "No se pudo agregar Polygon Amoy."));
    } finally {
      setPending(false);
    }
  }

  function continueSandbox() {
    setAddress("0xA11CE0000000000000000000000000000000424");
    setChainId(POLYGON_AMOY.chainId);
    setMessage("Modo sandbox activo: wallet simulada para mostrar ownership, garantia y tokenizacion sin extension.");
  }

  return (
    <section className="rounded-xl border border-cyan-300/20 bg-cyan-950/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Wallet sandbox</p>
          <h3 className="mt-1 text-base font-bold text-white">MetaMask + Polygon Amoy</h3>
          <p className="mt-1 text-xs leading-5 text-cyan-100/75">
            Demo de ownership y tokenizacion sin mainnet: conectar, agregar red y usar tokens de prueba.
          </p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${address ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : hasMetaMask ? "border-cyan-300/30 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/60 text-slate-400"}`}>
          {address ? "connected" : hasMetaMask ? "metamask ready" : "local"}
        </span>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Cuenta</p>
          <p className="mt-1 font-mono text-sm text-white">{address ? shortAddress(address) : "No conectada"}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-3">
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Red</p>
          <p className={`mt-1 text-sm font-semibold ${isAmoy ? "text-emerald-200" : "text-amber-200"}`}>{networkLabel}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button suppressHydrationWarning
          type="button"
          disabled={pending}
          onClick={() => void connectWallet()}
          className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {address ? "Reconectar MetaMask" : "Conectar MetaMask"}
        </button>
        <button suppressHydrationWarning
          type="button"
          disabled={pending || !hasMetaMask}
          onClick={() => void addAmoy()}
          className="rounded-lg border border-violet-300/35 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Agregar Polygon Amoy
        </button>
      </div>

      <button suppressHydrationWarning
        type="button"
        onClick={continueSandbox}
        className="mt-2 w-full rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
      >
        Continuar sin wallet (sandbox)
      </button>

      <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 p-2 text-[11px] text-slate-300">{message}</p>
    </section>
  );
}
