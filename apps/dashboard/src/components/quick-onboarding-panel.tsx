"use client";

import Link from "next/link";
import { Card } from "@product/ui";

type Props = {
  context?: "dashboard" | "demo-lab";
};

const manifestColumns = [
  "batch_id",
  "uid_hex",
  "product_name",
  "sku",
  "lot",
  "serial",
  "expires_at",
];

export function QuickOnboardingPanel({ context = "dashboard" }: Props) {
  const source = context === "demo-lab" ? "demo lab" : "dashboard";

  function downloadCsvTemplate() {
    const blob = new Blob([`${manifestColumns.join(",")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "nexid-manifest-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="p-5 text-sm text-slate-200">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Intake operativo</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Alta profesional de tenants, batches y manifiestos</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Desde {source}, el camino recomendado es guiado: primero tenant passport, despues batch security,
            luego TXT/CSV validado y recien ahi activacion. Sin defaults escondidos ni datos demo para clientes reales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/batches/supplier" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100">
            Abrir supplier wizard
          </Link>
          <button suppressHydrationWarning type="button" onClick={downloadCsvTemplate} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200">
            Descargar CSV
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-sm font-semibold text-white">1. Tenant listo</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">Rubro, origen, portal consumidor, claim policy y reglas de manifest.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-sm font-semibold text-white">2. Batch seguro</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">BID, chip, SKU, perfil de seguridad y llaves K_META/K_FILE reales.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
          <p className="text-sm font-semibold text-white">3. Manifest auditado</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">CSV/TXT con preflight: duplicados, batch mismatch, identidad de producto y hash de auditoria.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100">Columnas recomendadas para proveedor</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {manifestColumns.map((column) => (
            <span key={column} className="rounded-full border border-white/15 bg-slate-950/45 px-3 py-1 text-xs text-slate-200">
              {column}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
