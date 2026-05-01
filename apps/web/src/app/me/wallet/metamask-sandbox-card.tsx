"use client";

import { useMemo, useState } from "react";

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
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
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChain = await window.ethereum.request({ method: "eth_chainId" });
      setAddress(nextAddress);
      setChainId(typeof nextChain === "string" ? nextChain : "");
      setMessage(nextAddress ? "Wallet conectada localmente. Todavia no se envia al backend." : "No se recibio una cuenta.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo conectar MetaMask.");
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
      await window.ethereum.request({ method: "wallet_addEthereumChain", params: [POLYGON_AMOY] });
      const nextChain = await window.ethereum.request({ method: "eth_chainId" });
      setChainId(typeof nextChain === "string" ? nextChain : POLYGON_AMOY.chainId);
      setMessage("Polygon Amoy listo para pruebas de tokenizacion.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo agregar Polygon Amoy.");
    } finally {
      setPending(false);
    }
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
        <button
          type="button"
          disabled={pending}
          onClick={() => void connectWallet()}
          className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {address ? "Reconectar MetaMask" : "Conectar MetaMask"}
        </button>
        <button
          type="button"
          disabled={pending || !hasProvider}
          onClick={() => void addAmoy()}
          className="rounded-lg border border-violet-300/35 bg-violet-500/15 px-3 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Agregar Polygon Amoy
        </button>
      </div>

      <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 p-2 text-[11px] text-slate-300">{message}</p>
    </section>
  );
}
