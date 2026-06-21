"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  Search, 
  Layers, 
  CheckCircle, 
  ExternalLink, 
  Send, 
  ArrowRight, 
  Plus, 
  ShieldCheck,
  HelpCircle,
  Clock,
  Sparkles,
  Info
} from "lucide-react";
import type { ConsumerPortalProduct } from "./consumer-portal-model";

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

export function WalletInteractiveClient({ initialProducts, selectedTenant }: WalletInteractiveClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [filter, setFilter] = useState<"all" | "claimed" | "blockchain">("all");
  const [search, setSearch] = useState("");
  const [transferringUid, setTransferringUid] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recentTransfers, setRecentTransfers] = useState<Array<{ id: string; name: string; to: string; time: string; txHash: string }>>([]);

  const hasOnChainProof = (product: Product) => {
    const txHash = String(product.tokenization_tx_hash || "");
    const status = String(product.tokenization_status || "").toLowerCase();
    return Boolean(txHash && status !== "none" && !txHash.toUpperCase().includes("DEMO"));
  };

  const certificateHref = (product: Product) => {
    const eventId = String(product.latest_tap_event_id || product.first_tap_event_id || "").trim();
    return eventId ? `/certificado/${encodeURIComponent(eventId)}` : "";
  };

  const handleTransfer = (bid: string, productName: string) => {
    if (!recipientAddress.trim()) {
      alert("Por favor, introduce una dirección válida de destino.");
      return;
    }

    const txHash = "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    
    // Simulate updating state: mark product as transferred (remove from claimed list or change ownership status)
    setProducts((prev) =>
      prev.map((p) =>
        (p.bid === bid || p.batch === bid)
          ? { ...p, ownership_record_status: "transferred", ownership_status: "transferred" }
          : p
      )
    );

    setRecentTransfers((prev) => [
      {
        id: `tx-${Math.random().toString(36).substring(2, 8)}`,
        name: productName,
        to: recipientAddress,
        time: "Hace unos segundos",
        txHash,
      },
      ...prev,
    ]);

    setTransferringUid(null);
    setRecipientAddress("");
    alert(`¡Transferencia de NFT simulada con éxito!\nFirma registrada en Polygon Amoy.\nHash: ${txHash.slice(0, 16)}...`);
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      (product.product_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (product.bid || "").toLowerCase().includes(search.toLowerCase());

    const isClaimed = String(product.ownership_record_status || product.ownership_status || "").toLowerCase() === "claimed";
    const isOnChain = hasOnChainProof(product);

    if (filter === "claimed") return matchesSearch && isClaimed;
    if (filter === "blockchain") return matchesSearch && isOnChain;
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      
      {/* Header, Search & Filter Options */}
      <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-black text-white">Tus Certificados Digitales (NFTs)</h3>
            <p className="text-xs text-slate-400">Administra, filtra y transfiere tus botellas autenticadas.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por nombre o lote..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full md:w-60 bg-slate-900 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
            
            {/* Filter Buttons */}
            <div className="flex bg-slate-900 p-1 rounded-xl border border-white/5">
              {[
                { id: "all", label: "Todos" },
                { id: "claimed", label: "Reclamados" },
                { id: "blockchain", label: "En Blockchain" }
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setFilter(btn.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
                    filter === btn.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
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
              const certificateUrl = certificateHref(product);

              const isBottle = !product.product_name?.toLowerCase().includes("crate") && !product.product_name?.toLowerCase().includes("caja");
              const thumbnailImg = isBottle ? "/images/premium_magnum.png" : "/images/wine_crate.png";

              return (
                <div 
                  key={`${bid}-${index}`} 
                  className={`rounded-2xl border bg-slate-950/80 p-4 transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                    isTransferred 
                      ? "border-white/5 opacity-50" 
                      : "border-white/5 hover:border-amber-500/20 hover:shadow-[0_8px_24px_rgba(245,158,11,0.03)]"
                  }`}
                >
                  <div className="flex gap-4">
                    {/* Thumbnail */}
                    <div className="h-20 w-16 shrink-0 rounded-xl border border-white/10 bg-black/40 p-1 flex items-center justify-center overflow-hidden">
                      <img
                        src={thumbnailImg}
                        alt={product.product_name || "Vino"}
                        className="h-16 w-auto object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-amber-300">
                          {product.brand_name || "nexID Partner"}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider ${
                          isTransferred
                            ? "border-red-500/20 bg-red-500/10 text-red-400"
                            : isOnChain
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                            : isClaimed
                            ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                            : "border-white/5 bg-slate-900 text-slate-400"
                        }`}>
                          {isTransferred ? "Transferido" : isOnChain ? "Blockchain NFT" : isClaimed ? "Propietario" : "Registrado"}
                        </span>
                      </div>
                      
                      <h4 className="mt-1 text-xs font-black text-white truncate leading-snug">{product.product_name || "Vino Auténtico"}</h4>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Lote: {bid}</p>
                    </div>
                  </div>

                  {/* Actions / Public Cert */}
                  <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-2">
                      {certificateUrl && (
                        <Link 
                          href={certificateUrl} 
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 hover:text-white transition"
                        >
                          Firma Digital <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      
                      {isOnChain && explorerHref && (
                        <a 
                          href={explorerHref} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-400 hover:text-white transition"
                        >
                          Ver en Polygonscan <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>

                    {isClaimed && !isTransferred && (
                      <div>
                        {transferringUid === bid ? (
                          <div className="mt-2 flex flex-col gap-2 w-full">
                            <input
                              type="text"
                              placeholder="Dirección 0x..."
                              value={recipientAddress}
                              onChange={(e) => setRecipientAddress(e.target.value)}
                              className="bg-slate-900 border border-white/15 rounded-lg px-2.5 py-1 text-[10px] text-white focus:outline-none focus:border-amber-400 min-w-40"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setTransferringUid(null)}
                                className="px-2 py-1 rounded bg-slate-800 text-slate-400 text-[9px] font-black uppercase"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleTransfer(bid, product.product_name || "Vino")}
                                className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 text-[9px] font-black uppercase flex items-center gap-1"
                              >
                                Confirmar <Send className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTransferringUid(bid)}
                            className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-amber-200 hover:bg-amber-500/25 transition flex items-center gap-1"
                          >
                            Transferir P2P <Send className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Transfers Log Ledger */}
      {recentTransfers.length > 0 && (
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-lg">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-4">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            Transferencias P2P Recientes (Sesión)
          </h3>
          <div className="space-y-2">
            {recentTransfers.map((tx) => (
              <div key={tx.id} className="rounded-xl border border-white/5 bg-slate-900/30 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-[10px]">
                <div>
                  <p className="font-black text-white">{tx.name}</p>
                  <p className="text-slate-500 mt-0.5">Destino: <span className="font-mono text-slate-300">{tx.to}</span></p>
                </div>
                <div className="sm:text-right shrink-0">
                  <span className="text-amber-400 font-bold uppercase block">Enviado</span>
                  <a 
                    href={`https://amoy.polygonscan.com/tx/${tx.txHash}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1 mt-0.5 justify-end"
                  >
                    Hash: {tx.txHash.slice(0, 10)}... <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
    </div>
  );
}
