"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, BrandDot, BrandLockup, Button, Card } from "@product/ui";

type Row = Record<string, string>;

function resolveTone(value: string) {
  const v = String(value || "").toUpperCase();
  if (["VALID", "ACTIVE", "HEALTHY"].includes(v)) return "green" as const;
  if (["REPLAY_SUSPECT", "PENDING", "DRAFT", "QUALIFIED"].includes(v)) return "amber" as const;
  if (["INVALID", "NOT_ACTIVE", "NOT_REGISTERED", "REVOKED", "RISK", "HOT", "BLOCKED", "TAMPER"].includes(v)) return "red" as const;
  if (["DUPLICATE", "OPEN", "NEW"].includes(v)) return "violet" as const;
  return "default" as const;
}

export function DataTable({ title, columns, rows, filterKey, loadingLabel, emptyLabel, searchPlaceholder = "Search", allFilterLabel = "All", refreshLabel = "Refresh", statusMap }: { title: string; columns: Array<{ key: string; label: string }>; rows: Row[]; filterKey: string; loadingLabel: string; emptyLabel: string; searchPlaceholder?: string; allFilterLabel?: string; refreshLabel?: string; statusMap?: Record<string, string> }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => rows.filter((row) => {
    const matchesQ = Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
    const matchesS = status === "all" || row[filterKey] === status;
    return matchesQ && matchesS;
  }), [filterKey, query, rows, status]);

  const statuses = Array.from(new Set(rows.map((row) => row[filterKey])));

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">{filtered.length} / {rows.length} rows visible</p>
        </div>
        <div className="flex items-center gap-2">
          <input placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
            <option value="all">{allFilterLabel}</option>
            {statuses.map((item) => <option key={item} value={item}>{statusMap?.[item] ?? item}</option>)}
          </select>
          <Button variant="secondary" onClick={() => startTransition(() => router.refresh())}>{refreshLabel}</Button>
          {(query || status !== "all") ? <button type="button" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300" onClick={() => { setQuery(""); setStatus("all"); }}>Clear</button> : null}
        </div>
      </div>

      {isPending ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-3"><BrandDot size={10} variant="pulse" theme="dark" />{loadingLabel}</div></div> : null}
      {!isPending && filtered.length === 0 ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-4"><BrandLockup size={24} variant="static" theme="dark" />{emptyLabel}</div></div> : null}

      {!isPending && filtered.length > 0 ? (
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
                        <Badge tone={resolveTone(row[col.key])}>
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
