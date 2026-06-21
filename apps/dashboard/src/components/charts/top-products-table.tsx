"use client";

type ProductRow = { uidHex: string; bid: string; productName: string; winery: string; region: string; vintage: string; scanCount: number; lastSeenAt?: string | null; tokenization?: { status?: string; network?: string } };

export function TopProductsTable({ items }: { items: ProductRow[] }) {
  return (
    <div className="overflow-auto border border-white/5 rounded-2xl bg-slate-950/40 p-1" aria-label="Top products table">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <th className="px-4 py-3">Producto / Bodega</th>
            <th className="px-4 py-3">UID (Hex)</th>
            <th className="px-4 py-3 text-right">Escaneos</th>
            <th className="px-4 py-3 text-center">Tokenización (Web3)</th>
            <th className="px-4 py-3 text-right">Último Visto</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {(items.length ? items : []).slice(0, 12).map((item) => {
            const isMinted = item.tokenization?.status === "minted" || item.tokenization?.status === "success";
            return (
              <tr key={`${item.bid}-${item.uidHex}`} className="text-slate-300 hover:bg-white/[0.015] transition-colors duration-150">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-200">{item.productName}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{item.winery} · {item.region} · {item.vintage}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-cyan-400/90">{item.uidHex}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-100">{item.scanCount}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-semibold ${
                    isMinted 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.12)]" 
                      : "bg-slate-800/40 text-slate-400 border border-white/5"
                  }`}>
                    {isMinted ? "MINTED" : (item.tokenization?.status?.toUpperCase() || "PENDING")}
                    {item.tokenization?.network && (
                      <span className="text-[9px] opacity-60 ml-0.5">({item.tokenization.network})</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-400 font-mono text-[11px]">
                  {item.lastSeenAt ? new Date(item.lastSeenAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "N/A"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!items.length ? (
        <p className="p-4 text-center text-sm text-slate-400 border-t border-white/5">
          No hay productos/tags para el período seleccionado.
        </p>
      ) : null}
    </div>
  );
}
