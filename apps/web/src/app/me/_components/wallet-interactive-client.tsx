"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, Search, Send, ShieldCheck } from "lucide-react";
import type { ConsumerPortalProduct } from "./consumer-portal-model";
import { homeReadingHref } from "./consumer-home-model";

type Product = ConsumerPortalProduct & {
  batch?: string | null;
  sku?: string | null;
  vertical?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  photo_url?: string | null;
  photoUrl?: string | null;
};

type WalletInteractiveClientProps = {
  initialProducts: Product[];
  selectedTenant: string;
};

type TransferNotice = {
  type: "success" | "error";
  text: string;
};

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function WalletInteractiveClient({ initialProducts, selectedTenant }: WalletInteractiveClientProps) {
  const transferDemoEnabled = process.env.NEXT_PUBLIC_WALLET_TRANSFER_DEMO_ENABLED === "true";
  const [products] = useState<Product[]>(initialProducts);
  const [filter, setFilter] = useState<"all" | "claimed" | "blockchain">("all");
  const [search, setSearch] = useState("");
  const [transferringUid, setTransferringUid] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recentTransfers, setRecentTransfers] = useState<Array<{ id: string; name: string; to: string; time: string }>>([]);
  const [transferNotice, setTransferNotice] = useState<TransferNotice | null>(null);

  const hasOnChainProof = (product: Product) => {
    const txHash = String(product.tokenization_tx_hash || "");
    const status = String(product.tokenization_status || "").toLowerCase();
    return Boolean(txHash && status !== "none" && !txHash.toUpperCase().includes("DEMO"));
  };

  const readingHref = (product: Product) => homeReadingHref(product.latest_tap_event_id) || homeReadingHref(product.first_tap_event_id);

  const handleTransfer = (bid: string, productName: string) => {
    if (!transferDemoEnabled) {
      setTransferNotice({ type: "error", text: "Transferencia deshabilitada: falta integrar firma de wallet, envío y receipt confirmado por el backend." });
      return;
    }
    const normalizedRecipient = recipientAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(normalizedRecipient)) {
      setTransferNotice({ type: "error", text: "Ingresa una direccion 0x valida para preparar la transferencia." });
      return;
    }

    setRecentTransfers((prev) => [
      {
        id: `sim-${Date.now()}`,
        name: productName,
        to: normalizedRecipient,
        time: "Simulado ahora",
      },
      ...prev,
    ]);
    setTransferringUid(null);
    setRecipientAddress("");
    setTransferNotice({
      type: "success",
      text: "Simulación local completada. No se firmó, envió ni confirmó una transacción y el ownership real no cambió.",
    });
  };

  const normalizedSearch = search.toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      (product.product_name || "").toLowerCase().includes(normalizedSearch) ||
      (product.bid || "").toLowerCase().includes(normalizedSearch);
    const isClaimed = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed";
    const isOnChain = hasOnChainProof(product);

    if (filter === "claimed") return matchesSearch && isClaimed;
    if (filter === "blockchain") return matchesSearch && isOnChain;
    return matchesSearch;
  });

  return (
    <div className="v3-space-y-6">
      <div className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--portal-accent)]">
              {selectedTenant ? `${selectedTenant}` : "Tu colección NexID"}
            </p>
            <h3 className="mt-1 text-sm font-black text-[var(--portal-text)]">Productos guardados</h3>
            <p className="text-xs text-[var(--portal-muted)]">Buscá un producto y volvé a su lectura o a su registro digital.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--portal-muted)]" aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar un producto..."
                aria-label="Buscar productos por nombre o identificador"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] py-2 pl-9 pr-4 text-xs text-[var(--portal-text)] focus:border-amber-400 focus:outline-hidden md:w-60"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-1">
              {[
                { id: "all", label: "Todos" },
                { id: "claimed", label: "Titularidad" },
                { id: "blockchain", label: "NFT" },
              ].map((button) => (
                <button
                  key={button.id}
                  type="button"
                  title={`Filtrar productos: ${button.label}`}
                  aria-pressed={filter === button.id}
                  onClick={() => setFilter(button.id as "all" | "claimed" | "blockchain")}
                  className={`min-h-11 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                    filter === button.id ? "bg-amber-500 text-slate-950" : "text-[var(--portal-muted)] hover:text-[var(--portal-text)]"
                  }`}
                >
                  {button.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {transferNotice ? (
          <div
            className={`mt-5 flex items-start gap-3 rounded-2xl border p-4 text-xs leading-5 ${
              transferNotice.type === "success"
                ? "border-emerald-300/25 bg-emerald-400/10 text-[var(--portal-text)]"
                : "border-rose-300/25 bg-rose-400/10 text-[var(--portal-text)]"
            }`}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black">{transferNotice.type === "success" ? "Simulacion completada" : "Revisa la direccion"}</p>
              <p className="mt-0.5 text-[var(--portal-muted)]">{transferNotice.text}</p>
            </div>
          </div>
        ) : null}

        {!filteredProducts.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-8 text-center text-[var(--portal-muted)]">
            <p className="text-xs">No encontramos productos con estos filtros. Probá con otro nombre o elegí Todos.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {filteredProducts.map((product, index) => {
              const bid = product.bid || product.batch || "";
              const isClaimed = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed";
              const isTransferred = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "transferred";
              const isOnChain = hasOnChainProof(product);
              const txHash = String(product.tokenization_tx_hash || "");
              const explorerHref = isOnChain ? `https://amoy.polygonscan.com/tx/${encodeURIComponent(txHash)}` : "";
              const readingUrl = readingHref(product);
              const thumbnailImg = product.imageUrl || product.image_url || product.photoUrl || product.photo_url || "";

              return (
                <div
                  key={`${bid}-${index}`}
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-[var(--portal-surface)] p-4 transition-all duration-300 ${
                    isTransferred
                      ? "border-[color:var(--portal-border)]"
                      : "border-[color:var(--portal-border)] hover:border-amber-500/20 hover:shadow-[0_8px_24px_rgba(245,158,11,0.05)]"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-1">
                      {thumbnailImg ? <img
                        src={thumbnailImg}
                        alt={product.product_name || "Producto asociado"}
                        className="h-16 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                      /> : <span className="text-xs text-[var(--portal-muted)]">Imagen no reportada</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                        <span className="max-w-full break-words rounded-full border border-amber-400/20 [overflow-wrap:anywhere] bg-amber-400/5 px-2 py-0.5 text-xs font-black uppercase tracking-wider text-[var(--portal-accent)]">
                          {product.brand_name || "Marca no reportada"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-black uppercase tracking-wider ${
                            isTransferred
                              ? "border-red-500/20 bg-red-500/10 text-[var(--portal-danger)]"
                              : isOnChain
                                ? "border-emerald-500/20 bg-emerald-500/10 text-[var(--portal-accent)]"
                                : isClaimed
                                  ? "border-cyan-500/20 bg-cyan-500/10 text-[var(--portal-accent)]"
                                  : "border-[color:var(--portal-border)] bg-[var(--portal-subtle)] text-[var(--portal-muted)]"
                          }`}
                        >
                          {isTransferred ? "Transferido" : isOnChain ? "Registro NFT" : isClaimed ? "Titularidad registrada" : "Guardado"}
                        </span>
                      </div>

                      <h4 className="mt-2 break-words text-base font-bold leading-snug text-[var(--portal-text)] [overflow-wrap:anywhere]">{product.product_name || "Producto asociado"}</h4>
                      <p className="mt-0.5 break-all font-mono text-xs text-[var(--portal-muted)]">Lote: {bid}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--portal-border)] pt-3">
                    <div className="flex flex-wrap gap-2">
                      {readingUrl ? (
                        <Link href={readingUrl} prefetch={false} className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--portal-accent)] transition hover:text-[var(--portal-text)]">
                          Ver lectura <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : null}

                      {isOnChain && explorerHref ? (
                        <a
                          href={explorerHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-[var(--portal-accent)] transition hover:text-[var(--portal-text)]"
                        >
                          Ver registro digital <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      ) : null}
                    </div>

                    {isClaimed && !isTransferred && transferDemoEnabled ? (
                      <div>
                        {transferringUid === bid ? (
                          <div className="mt-2 flex w-full flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Direccion 0x..."
                              aria-label="Dirección de destino para la simulación"
                              value={recipientAddress}
                              onChange={(event) => setRecipientAddress(event.target.value)}
                              className="min-h-11 min-w-40 rounded-lg border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] px-2.5 py-1 text-xs text-[var(--portal-text)] focus:border-amber-400 focus:outline-hidden"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferringUid(null);
                                  setRecipientAddress("");
                                }}
                                className="min-h-11 rounded bg-[var(--portal-subtle)] px-2 py-1 text-xs font-black uppercase text-[var(--portal-muted)]"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransfer(bid, product.product_name || "Producto")}
                                className="flex min-h-11 items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-xs font-black uppercase text-slate-950"
                              >
                                Confirmar <Send className="h-2.5 w-2.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            title="Prepara una transferencia P2P de ownership. En produccion debe firmarse con wallet antes de mover el NFT."
                            onClick={() => {
                              setTransferringUid(bid);
                              setTransferNotice(null);
                            }}
                            className="flex min-h-11 items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-[var(--portal-accent)] transition hover:bg-amber-500/25"
                          >
                            Simular transferencia <Send className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {recentTransfers.length > 0 ? (
        <div className="rounded-3xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-5 shadow-lg">
          <h3 className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[var(--portal-muted)]">
            <Clock className="h-3.5 w-3.5 text-[var(--portal-accent)]" aria-hidden="true" />
            Simulaciones recientes
          </h3>
          <div className="v3-space-y-2">
            {recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col gap-3 rounded-xl border border-[color:var(--portal-border)] bg-[var(--portal-subtle)] p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-[var(--portal-text)]">{transfer.name}</p>
                  <p className="mt-0.5 text-[var(--portal-muted)]">
                    Destino: <span className="font-mono text-[var(--portal-muted)]">{shortAddress(transfer.to)}</span>
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <span className="block font-bold uppercase text-[var(--portal-accent)]">Simulado · sin transacción enviada</span>
                  <span className="mt-0.5 block text-[var(--portal-muted)]">{transfer.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <details open={transferDemoEnabled} className="rounded-2xl border border-[color:var(--portal-border)] bg-[var(--portal-surface)] p-4 text-[var(--portal-text)]">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Sobre las transferencias digitales</summary>
      <div role="status" className={`rounded-2xl border p-3 text-xs leading-5 ${transferDemoEnabled ? "border-amber-300/30 bg-amber-500/10 text-[var(--portal-text)]" : "border-[color:var(--portal-border)] bg-[var(--portal-subtle)] text-[var(--portal-muted)]"}`}>
        {transferDemoEnabled
          ? "DEMO DE TRANSFERENCIA · solo simula la UX. No firma, envía ni confirma transacciones y no genera hashes o links de explorador."
          : "Transferencias deshabilitadas hasta integrar firma de wallet y receipt confirmado por el backend. Los links Polygonscan solo se muestran para hashes reales reportados."}
      </div>
      </details>

    </div>
  );
}
