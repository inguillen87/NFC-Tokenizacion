"use client";

type ProductRow = { uidHex: string; bid: string; productName: string; winery: string; region: string; vintage: string; scanCount: number; lastSeenAt?: string | null; tokenization?: { status?: string; network?: string } };

export function TopProductsTable({ items }: { items: ProductRow[] }) {
  return (
    <div className="overflow-auto" aria-label="Top products table">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-slate-400">
            <th className="px-2 py-2">Product</th>
            <th className="px-2 py-2">UID</th>
            <th className="px-2 py-2">Scans</th>
            <th className="px-2 py-2">Tokenization</th>
            <th className="px-2 py-2">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {(items.length ? items : []).slice(0, 12).map((item) => (
            <tr key={`${item.bid}-${item.uidHex}`} className="border-t border-white/10 text-slate-200">
              <td className="px-2 py-2">{item.productName}<div className="text-[11px] text-slate-400">{item.winery} · {item.region} · {item.vintage}</div></td>
              <td className="px-2 py-2">{item.uidHex}</td>
              <td className="px-2 py-2">{item.scanCount}</td>
              <td className="px-2 py-2">{item.tokenization?.status || "pending"} <span className="text-slate-400">{item.tokenization?.network || "-"}</span></td>
              <td className="px-2 py-2">{item.lastSeenAt || "n/a"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!items.length ? <p className="p-3 text-sm text-slate-400">No hay productos/tags para el período.</p> : null}
    </div>
  );
}
