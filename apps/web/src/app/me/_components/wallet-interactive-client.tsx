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
    <div className="space-y-6">
      <div role="status" className={`rounded-2xl border p-3 text-xs leading-5 ${transferDemoEnabled ? "border-amber-300/30 bg-amber-500/10 text-amber-100" : "border-slate-700 bg-slate-900/60 text-slate-300"}`}>
        {transferDemoEnabled
          ? "DEMO DE TRANSFERENCIA · solo simula la UX. No firma, envía ni confirma transacciones y no genera hashes o links de explorador."
          : "Transferencias deshabilitadas hasta integrar firma de wallet y receipt confirmado por el backend. Los links Polygonscan solo se muestran para hashes reales reportados."}
      </div>
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
              {selectedTenant ? `${selectedTenant} ownership` : "nexID ownership"}
            </p>
            <h3 className="mt-1 text-sm font-black text-white">Certificados digitales y NFTs</h3>
            <p className="text-xs text-slate-400">Administra, filtra y prepara transferencias de certificados y registros de ownership digital; no del objeto físico.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                type="text"
                placeholder="Buscar por nombre o lote..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-900 py-2 pl-9 pr-4 text-xs text-white focus:border-amber-400 focus:outline-none md:w-60"
              />
            </div>

            <div className="flex rounded-xl border border-white/5 bg-slate-900 p-1">
              {[
                { id: "all", label: "Todos" },
                { id: "claimed", label: "Reclamados" },
                { id: "blockchain", label: "Blockchain" },
              ].map((button) => (
                <button
                  key={button.id}
                  type="button"
                  title={`Filtrar activos: ${button.label}`}
                  onClick={() => setFilter(button.id as "all" | "claimed" | "blockchain")}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider transition ${
                    filter === button.id ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-white"
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
                ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-50"
                : "border-rose-300/25 bg-rose-400/10 text-rose-50"
            }`}
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-black">{transferNotice.type === "success" ? "Simulacion completada" : "Revisa la direccion"}</p>
              <p className="mt-0.5 text-slate-300">{transferNotice.text}</p>
            </div>
          </div>
        ) : null}

        {!filteredProducts.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 bg-slate-900/10 p-8 text-center text-slate-400">
            <p className="text-xs">No se encontraron activos digitales con los filtros aplicados.</p>
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
                  className={`relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-slate-950/80 p-4 transition-all duration-300 ${
                    isTransferred
                      ? "border-white/5 opacity-55"
                      : "border-white/5 hover:border-amber-500/20 hover:shadow-[0_8px_24px_rgba(245,158,11,0.05)]"
                  }`}
                >
                  <div className="flex gap-4">
                    <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40 p-1">
                      {thumbnailImg ? <img
                        src={thumbnailImg}
                        alt={product.product_name || "Producto asociado"}
                        className="h-16 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                      /> : <span className="text-[9px] text-slate-500">Imagen no reportada</span>}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
                          {product.brand_name || "Marca no reportada"}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                            isTransferred
                              ? "border-red-500/20 bg-red-500/10 text-red-400"
                              : isOnChain
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : isClaimed
                                  ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                                  : "border-white/5 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {isTransferred ? "Transferido" : isOnChain ? "Blockchain NFT" : isClaimed ? "Propietario" : "Registrado"}
                        </span>
                      </div>

                      <h4 className="mt-1 truncate text-xs font-black leading-snug text-white">{product.product_name || "Producto asociado"}</h4>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-500">Lote: {bid}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-3">
                    <div className="flex flex-wrap gap-2">
                      {readingUrl ? (
                        <Link href={readingUrl} prefetch={false} className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 transition hover:text-white">
                          Abrir lectura <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : null}

                      {isOnChain && explorerHref ? (
                        <a
                          href={explorerHref}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 transition hover:text-white"
                        >
                          Polygonscan <ExternalLink className="h-3 w-3" aria-hidden="true" />
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
                              value={recipientAddress}
                              onChange={(event) => setRecipientAddress(event.target.value)}
                              className="min-w-40 rounded-lg border border-white/15 bg-slate-900 px-2.5 py-1 text-[10px] text-white focus:border-amber-400 focus:outline-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setTransferringUid(null);
                                  setRecipientAddress("");
                                }}
                                className="rounded bg-slate-800 px-2 py-1 text-[9px] font-black uppercase text-slate-400"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleTransfer(bid, product.product_name || "Producto")}
                                className="flex items-center gap-1 rounded bg-amber-500 px-2.5 py-1 text-[9px] font-black uppercase text-slate-950"
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
                            className="flex items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200 transition hover:bg-amber-500/25"
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
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
          <h3 className="mb-4 flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-400">
            <Clock className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
            Transferencias P2P recientes
          </h3>
          <div className="space-y-2">
            {recentTransfers.map((transfer) => (
              <div key={transfer.id} className="flex flex-col gap-3 rounded-xl border border-white/5 bg-slate-900/30 p-3 text-[10px] sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-white">{transfer.name}</p>
                  <p className="mt-0.5 text-slate-500">
                    Destino: <span className="font-mono text-slate-300">{shortAddress(transfer.to)}</span>
                  </p>
                </div>
                <div className="shrink-0 sm:text-right">
                  <span className="block font-bold uppercase text-amber-400">Simulado · sin receipt</span>
                  <span className="mt-0.5 block text-slate-500">{transfer.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
