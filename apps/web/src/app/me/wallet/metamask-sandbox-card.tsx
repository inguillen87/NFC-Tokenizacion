"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  isOKXWallet?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown> | unknown;
  on?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: "accountsChanged" | "chainChanged", handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
    phantom?: { ethereum?: EthereumProvider };
  }
}

type WalletChallengePayload = {
  ok?: boolean;
  error?: string;
  challenge?: { id?: string; message?: string; address?: string; expiresAt?: string };
};

type WalletConnectPayload = {
  ok?: boolean;
  error?: string;
  wallet?: {
    address?: string | null;
    addressMasked?: string | null;
    controlVerified?: boolean;
    verificationMethod?: string | null;
  };
};

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
  const code = typeof error === "object" && error && "code" in error ? Number((error as { code?: unknown }).code) : 0;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message || "")
        : "";

  const normalized = message.toLowerCase();
  if (normalized.includes("already processing") || normalized.includes("request already pending") || normalized.includes("already pending")) {
    return "Tu wallet ya tiene una solicitud pendiente. Abrila, confirmá o cancelá y volvé a intentar.";
  }
  if (normalized.includes("failed to connect to metamask")) {
    return "No pudimos abrir MetaMask. Desbloqueá la extensión o abrí esta pantalla desde MetaMask Mobile.";
  }
  if (code === 4001 || normalized.includes("user rejected")) {
    return "Conexión cancelada por el usuario.";
  }
  return message || fallback;
}

function walletApiErrorMessage(code: string | undefined, fallback: string) {
  const messages: Record<string, string> = {
    invalid_chain_id: "La wallet no informó una red EVM válida.",
    invalid_wallet_address: "La cuenta seleccionada no tiene una dirección EVM válida.",
    wallet_challenge_rate_limited: "Se hicieron demasiados intentos. Esperá unos minutos y probá de nuevo.",
    wallet_challenge_expired: "La solicitud de firma venció. Generá una nueva para continuar.",
    wallet_challenge_already_used: "Esta solicitud ya fue utilizada. Generá una firma nueva.",
    wallet_challenge_locked: "La solicitud se bloqueó por varios intentos fallidos. Generá una nueva.",
    wallet_signature_does_not_match: "La firma no corresponde a la cuenta seleccionada.",
    wallet_already_linked_to_another_account: "Esta wallet ya está vinculada a otro Passport.",
  };
  return code ? messages[code] || fallback : fallback;
}

async function requestWallet(provider: EthereumProvider, args: { method: string; params?: unknown[] }) {
  return Promise.resolve(provider.request(args));
}

function getInjectedProviders() {
  if (typeof window === "undefined") return [] as EthereumProvider[];
  const roots = [window.phantom?.ethereum, window.ethereum].filter(Boolean) as EthereumProvider[];
  const providers = roots.flatMap((root) => Array.isArray(root.providers) && root.providers.length ? [...root.providers, root] : [root]);
  return providers.filter((provider, index, list) => list.findIndex((item) => item === provider) === index);
}

function findMetaMaskProvider() {
  return getInjectedProviders().find((provider) => provider.isMetaMask) || null;
}

function findWalletProvider() {
  return findMetaMaskProvider() || getInjectedProviders().find((provider) => typeof provider.request === "function") || null;
}

function walletProviderName(provider: EthereumProvider | null) {
  if (!provider) return "Sin provider";
  if (provider.isPhantom) return "Phantom EVM";
  if (provider.isMetaMask) return "MetaMask";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isOKXWallet) return "OKX Wallet";
  return "Wallet Ethereum";
}

function walletProviderCode(provider: EthereumProvider) {
  if (provider.isPhantom) return "phantom";
  if (provider.isMetaMask) return "metamask";
  if (provider.isCoinbaseWallet) return "coinbase";
  if (provider.isRabby) return "rabby";
  if (provider.isOKXWallet) return "okx";
  return "wallet_evm";
}

function personalSignHex(message: string) {
  return `0x${Array.from(new TextEncoder().encode(message), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function isMobileRuntime() {
  if (typeof navigator === "undefined") return false;
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

function openMetaMaskMobile() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("connect", "metamask");
  window.location.assign(`https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}${url.hash}`);
}

export function MetamaskSandboxCard({
  initialWallet,
  autoConnect = false,
}: {
  initialWallet?: {
    address?: string | null;
    chainId?: string | null;
    network?: string | null;
    verifiedAt?: string | null;
    controlVerified?: boolean;
    verificationMethod?: string | null;
  } | null;
  autoConnect?: boolean;
}) {
  const [address, setAddress] = useState(initialWallet?.address || "");
  const [verifiedAddress, setVerifiedAddress] = useState(initialWallet?.controlVerified ? initialWallet.address || "" : "");
  const [chainId, setChainId] = useState(initialWallet?.chainId || "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(
    initialWallet?.address && initialWallet.controlVerified
      ? "Control de wallet verificado. Los registros de ownership digital, transferencias y marketplace pueden usar esta dirección."
      : initialWallet?.address
        ? "La wallet guardada necesita una firma nueva para volver a probar control."
      : "Web3 es opcional: conectalo solo para ownership, NFT, marketplace o transferencias."
  );
  const [hasWalletProvider, setHasWalletProvider] = useState(false);
  const [walletProviderLabel, setWalletProviderLabel] = useState("Sin provider");
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  const isAmoy = chainId.toLowerCase() === POLYGON_AMOY.chainId.toLowerCase();
  const isSandbox = address.toLowerCase() === "0xa11ce00000000000000000000000000000000424";
  const isControlVerified = Boolean(address && verifiedAddress && address.toLowerCase() === verifiedAddress.toLowerCase() && !isSandbox);
  const networkLabel = useMemo(() => {
    if (!chainId) return "Sin red";
    if (isAmoy) return "Polygon Amoy";
    return `Chain ${chainId}`;
  }, [chainId, isAmoy]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const detect = () => {
      const provider = findWalletProvider();
      setHasWalletProvider(Boolean(provider));
      setWalletProviderLabel(walletProviderName(provider));
      if (!provider || cleanup) return;

      const onAccountsChanged = (...args: unknown[]) => {
        const accounts = Array.isArray(args[0]) ? args[0] : [];
        const nextAddress = typeof accounts[0] === "string" ? accounts[0] : "";
        setAddress(nextAddress);
        setVerifiedAddress("");
        setMessage(nextAddress ? "La cuenta cambió. Firmá de nuevo para probar que controlás esta wallet." : "La wallet se desconectó del navegador.");
      };
      const onChainChanged = (...args: unknown[]) => {
        setChainId(typeof args[0] === "string" ? args[0] : "");
        setVerifiedAddress("");
        setMessage("La red cambió. Volvé a firmar para vincular la wallet en este contexto.");
      };

      provider.on?.("accountsChanged", onAccountsChanged);
      provider.on?.("chainChanged", onChainChanged);
      void requestWallet(provider, { method: "eth_chainId" })
        .then((nextChain) => setChainId(typeof nextChain === "string" ? nextChain : ""))
        .catch(() => undefined);

      cleanup = () => {
        provider.removeListener?.("accountsChanged", onAccountsChanged);
        provider.removeListener?.("chainChanged", onChainChanged);
      };
    };

    detect();
    const retry = window.setTimeout(detect, 800);
    window.addEventListener("ethereum#initialized", detect, { once: true });

    return () => {
      window.clearTimeout(retry);
      window.removeEventListener("ethereum#initialized", detect);
      cleanup?.();
    };
  }, []);

  const verifyWalletControl = useCallback(async () => {
    const provider = findWalletProvider();
    setHasWalletProvider(Boolean(provider));
    setWalletProviderLabel(walletProviderName(provider));
    if (!provider) {
      setMessage(
        isMobileRuntime()
          ? "En mobile, abrí esta pantalla desde el navegador interno de Phantom o MetaMask para firmar."
          : "No detectamos una wallet EVM. Instalá o desbloqueá Phantom, MetaMask, Rabby, Coinbase u OKX."
      );
      return;
    }
    setPending(true);
    setVerifiedAddress("");
    try {
      const accounts = await requestWallet(provider, { method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChain = await requestWallet(provider, { method: "eth_chainId" });
      const normalizedChain = typeof nextChain === "string" ? nextChain : "";
      setAddress(nextAddress);
      setChainId(normalizedChain);
      if (!nextAddress) throw new Error("La wallet no devolvió una cuenta autorizada.");

      setMessage("Preparando una prueba de control sin gas ni transacción...");
      const challengeResponse = await fetch("/api/consumer/wallet/challenge", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: nextAddress, chainId: normalizedChain, provider: walletProviderCode(provider) }),
      });
      const challengePayload = (await challengeResponse.json().catch(() => null)) as WalletChallengePayload | null;
      if (challengeResponse.status === 401) {
        setMessage("Iniciá sesión en tu Passport para vincular una wallet real. El modo presentación nunca guarda direcciones.");
        return;
      }
      const challengeId = challengePayload?.challenge?.id;
      const challengeMessage = challengePayload?.challenge?.message;
      if (!challengeResponse.ok || !challengePayload?.ok || !challengeId || !challengeMessage) {
        throw new Error(walletApiErrorMessage(challengePayload?.error, "No se pudo crear la solicitud de firma."));
      }

      setMessage("Revisá y firmá el mensaje en tu wallet. Es gratis y no mueve fondos.");
      const signature = await requestWallet(provider, {
        method: "personal_sign",
        params: [personalSignHex(challengeMessage), nextAddress],
      });
      if (typeof signature !== "string") throw new Error("La wallet no devolvió una firma válida.");

      const connectResponse = await fetch("/api/consumer/wallet/connect", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, signature }),
      });
      const connectPayload = (await connectResponse.json().catch(() => null)) as WalletConnectPayload | null;
      if (!connectResponse.ok || !connectPayload?.ok || !connectPayload.wallet?.controlVerified) {
        throw new Error(walletApiErrorMessage(connectPayload?.error, "La firma no pudo verificarse."));
      }

      const confirmedAddress = connectPayload.wallet.address || nextAddress;
      setAddress(confirmedAddress);
      setVerifiedAddress(confirmedAddress);
      setMessage(`Control verificado para ${connectPayload.wallet.addressMasked || shortAddress(confirmedAddress)}. Ya puede recibir registros de ownership digital y transferencias.`);
    } catch (error) {
      setVerifiedAddress("");
      setMessage(walletErrorMessage(error, "No se pudo verificar el control de la wallet."));
    } finally {
      setPending(false);
    }
  }, []);

  async function addAmoy() {
    const provider = findWalletProvider();
    if (!provider) {
      setMessage("No hay una wallet Ethereum disponible en este navegador.");
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
      setVerifiedAddress("");
      setMessage(address
        ? "Polygon Amoy quedó lista. Firmá de nuevo para verificar el control en esta red."
        : "Polygon Amoy quedó lista. Conectá y firmá para vincular una cuenta.");
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
    setVerifiedAddress("");
    setMessage("Presentación local activa. Esta dirección no se guarda, no prueba control y no puede recibir ownership digital persistido.");
  }

  useEffect(() => {
    if (!autoConnect || autoConnectAttempted || pending || isControlVerified) return;
    setAutoConnectAttempted(true);
    void verifyWalletControl();
  }, [autoConnect, autoConnectAttempted, isControlVerified, pending, verifyWalletControl]);

  return (
    <section className="consumer-wallet-control overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_34%),linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))] shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
      <div className="border-b border-white/10 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Web3 opcional
            </p>
            <h3 className="mt-2 text-lg font-black text-white">Wallet y ownership digital</h3>
            <p className="mt-2 max-w-xl text-xs leading-5 text-slate-300">
              Email y WhatsApp siguen siendo el alta liviana post-tap. Una wallet EVM se firma solo cuando querés solicitar
              ownership digital, crear su representación digital, publicarla o transferir ese registro. La firma no prueba el objeto físico.
            </p>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
            isControlVerified
              ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-200"
              : address
                ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
              : "border-white/10 bg-slate-950/60 text-slate-400"
          }`}>
            {isControlVerified ? "Control verificado" : isSandbox ? "Solo presentación" : address ? "Firma pendiente" : "Sin wallet"}
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
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Provider</p>
            <p className="mt-1 text-sm font-black text-white">{walletProviderLabel}</p>
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
                <p className="text-sm font-black text-white">Acceso Web3 con Clerk</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">MetaMask, Coinbase u OKX verificada por Clerk para iniciar sesión.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100 transition group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>

          <button
            type="button"
            disabled={pending}
            aria-busy={pending}
            onClick={() => void verifyWalletControl()}
            title="Conecta y firma un mensaje EIP-191 gratuito para probar control de la wallet."
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-white/25 hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-orange-200">
                <Wallet className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">{pending ? "Esperando firma..." : isControlVerified ? "Wallet verificada" : "Conectar y firmar control"}</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">{hasWalletProvider ? `${walletProviderLabel} detectada. La firma no usa gas.` : "Compatible con Phantom, MetaMask, Rabby, Coinbase y OKX."}</p>
              </div>
            </div>
            {isControlVerified ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={openMetaMaskMobile}
            title="Abrir esta wallet dentro del navegador seguro de MetaMask Mobile."
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-left transition hover:border-cyan-200/50 hover:bg-cyan-300/15"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
                <ExternalLink className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Abrir en MetaMask Mobile</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">En iPhone/Android, MetaMask debe abrir la web para inyectar la wallet.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-cyan-100" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={pending || !hasWalletProvider || Boolean(address && isSandbox)}
            onClick={() => void addAmoy()}
            title="Agrega o cambia la wallet a Polygon Amoy para pruebas de tokenización."
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-violet-300/30 hover:bg-violet-400/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 text-violet-200">
                <Network className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Usar Polygon Amoy</p>
                <p className="mt-1 text-xs leading-5 text-slate-400">Red de prueba para firmas, certificados y NFT de presentación.</p>
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
                <p className="text-sm font-black text-white">Modo presentación sin fricción</p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/80">
                  Para reuniones, la wallet de prueba muestra el flujo sin extensión. Vive solo en esta pantalla: nunca se
                  guarda, no prueba control y no puede recibir un NFT o una transferencia persistida.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={continueSandbox}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/35 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-300/18"
              title="Activa una dirección local de presentación sin guardarla ni asignarle ownership."
            >
              Activar wallet de prueba <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <p role="status" aria-live="polite" className="mt-4 rounded-2xl border border-white/10 bg-slate-950/65 p-4 text-xs leading-5 text-slate-300">
            {message}
          </p>
        </div>
      </div>
    </section>
  );
}
