"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, BrandDot, BrandLockup, Button, Card } from "@product/ui";

type Row = Record<string, string>;

function escapeCsv(value: string) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadBlob(filename: string, type: string, content: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "table";
}

function buildCsv(columns: Array<{ key: string; label: string }>, rows: Row[]) {
  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) => columns.map((column) => escapeCsv(row[column.key] || "")).join(",")).join("\n");
  return `${header}\n${body}`;
}

function buildExcelHtml(title: string, columns: Array<{ key: string; label: string }>, rows: Row[]) {
  const header = columns.map((column) => `<th>${column.label}</th>`).join("");
  const body = rows
    .map((row) => `<tr>${columns.map((column) => `<td>${String(row[column.key] || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`)
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title></head><body><table border="1"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
}

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
  const exportBase = slugify(title);

  return (
    <Card className="data-table-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-1 text-xs text-slate-400">{filtered.length} / {rows.length} rows visible</p>
        </div>
        <div className="flex items-center gap-2">
          <input suppressHydrationWarning placeholder={searchPlaceholder} value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm" />
          <select suppressHydrationWarning value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm">
            <option value="all">{allFilterLabel}</option>
            {statuses.map((item) => <option key={item} value={item}>{statusMap?.[item] ?? item}</option>)}
          </select>
          <Button variant="secondary" onClick={() => startTransition(() => router.refresh())}>{refreshLabel}</Button>
          <button suppressHydrationWarning type="button" className="rounded-lg border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100" onClick={() => downloadBlob(`${exportBase}.csv`, "text/csv;charset=utf-8", buildCsv(columns, filtered))}>CSV</button>
          <button suppressHydrationWarning type="button" className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100" onClick={() => downloadBlob(`${exportBase}.xls`, "application/vnd.ms-excel;charset=utf-8", buildExcelHtml(title, columns, filtered))}>Excel</button>
          <button suppressHydrationWarning type="button" className="rounded-lg border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-sm font-semibold text-violet-100" onClick={() => window.print()}>PDF</button>
          {(query || status !== "all") ? <button suppressHydrationWarning type="button" className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-300" onClick={() => { setQuery(""); setStatus("all"); }}>Clear</button> : null}
        </div>
      </div>

      {isPending ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-3"><BrandDot size={10} variant="pulse" theme="dark" />{loadingLabel}</div></div> : null}
      {!isPending && filtered.length === 0 ? <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-slate-400"><div className="flex items-center gap-4"><BrandLockup size={24} variant="static" theme="dark" />{emptyLabel}</div></div> : null}

      {!isPending && filtered.length > 0 ? (
        <div className="data-table-shell overflow-hidden rounded-2xl border border-white/10">
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
