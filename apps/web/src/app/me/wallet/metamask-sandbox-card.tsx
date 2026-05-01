"use client";

import { useMemo, useState } from "react";

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown> | unknown;
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

export function MetamaskSandboxCard() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("Listo para conectar wallet sandbox.");

  const hasProvider = typeof window !== "undefined" && Boolean(window.ethereum);
  const isAmoy = chainId.toLowerCase() === POLYGON_AMOY.chainId.toLowerCase();
  const networkLabel = useMemo(() => {
    if (!chainId) return "Sin red";
    if (isAmoy) return "Polygon Amoy";
    return `Chain ${chainId}`;
  }, [chainId, isAmoy]);

  async function connectWallet() {
    if (!window.ethereum) {
      setMessage("MetaMask no esta disponible en este navegador.");
      return;
    }
    setPending(true);
    try {
      const provider = window.ethereum;
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
    if (!window.ethereum) {
      setMessage("MetaMask no esta disponible en este navegador.");
      return;
    }
    setPending(true);
    try {
      const provider = window.ethereum;
      await requestWallet(provider, { method: "wallet_addEthereumChain", params: [POLYGON_AMOY] });
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
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${address ? "border-emerald-300/30 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-950/60 text-slate-400"}`}>
          {address ? "connected" : "local"}
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
          disabled={pending || !hasProvider}
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
