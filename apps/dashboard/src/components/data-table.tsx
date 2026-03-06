"use client";

import { useMemo, useState } from "react";
import { Badge, BrandDot, BrandLockup, Button, Card } from "@product/ui";

type Row = Record<string, string>;

export function DataTable({ title, columns, rows, filterKey, loadingLabel, emptyLabel, searchPlaceholder = "Search", allFilterLabel = "All", refreshLabel = "Refresh", statusMap }: { title: string; columns: Array<{ key: string; label: string }>; rows: Row[]; filterKey: string; loadingLabel: string; emptyLabel: string; searchPlaceholder?: string; allFilterLabel?: string; refreshLabel?: string; statusMap?: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesQ = Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesS = status === "all" || row[filterKey] === status;
    return matchesQ && matchesS;
  }), [filterKey, query, rows, status]);

  const statuses = Array.from(new Set(rows.map((row) => row[filterKey])));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <div className="flex items-center gap-2">
          <input placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
            <option value="all">{allFilterLabel}</option>
            {statuses.map((item) => <option key={item} value={item}>{statusMap?.[item] ?? item}</option>)}
          </select>
          <Button variant="secondary" onClick={async () => { setLoading(true); await new Promise((r) => setTimeout(r, 500)); setLoading(false); }}>{refreshLabel}</Button>
        </div>
      </div>

      {loading ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-3"><BrandDot size={10} variant="pulse" theme="dark" />{loadingLabel}</div></div> : null}
      {!loading && filtered.length === 0 ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-4"><BrandLockup size={24} variant="static" theme="dark" />{emptyLabel}</div></div> : null}

      {!loading && filtered.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-slate-950/60 text-slate-400">
              <tr>{columns.map((col) => <th key={col.key} className="px-4 py-3">{col.label}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={`${idx}-${row[columns[0].key]}`} className="border-b border-white/5">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3 text-slate-200">
                      {col.key === filterKey ? (
                        <Badge tone={row[col.key] === "active" || row[col.key] === "healthy" || row[col.key] === "valid" ? "green" : row[col.key] === "pending" || row[col.key] === "draft" ? "amber" : "default"}>
                          {statusMap?.[row[col.key]] ?? row[col.key]}
                        </Badge>
                      ) : (statusMap?.[row[col.key]] ?? row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
