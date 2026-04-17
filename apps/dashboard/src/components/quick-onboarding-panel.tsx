"use client";

import { useMemo, useState } from "react";
import { Button, Card } from "@product/ui";
import { DEMO_SUPPLIER_BATCH_ID, DEMO_SUPPLIER_UIDS } from "../lib/demo-uids";

type Mode = "demo" | "real";

function parseUidText(input: string) {
  return input
    .split(/[\n,;\t ]+/)
    .map((entry) => entry.trim().toUpperCase())
    .filter((entry) => /^[0-9A-F]{8,20}$/.test(entry));
}

export function QuickOnboardingPanel({ context = "dashboard" }: { context?: "dashboard" | "demo-lab" }) {
  const [mode, setMode] = useState<Mode>("demo");
  const [tenantSlug, setTenantSlug] = useState("demobodega");
  const [tenantName, setTenantName] = useState("Demo Bodega");
  const [bid, setBid] = useState(DEMO_SUPPLIER_BATCH_ID);
  const [uidsText, setUidsText] = useState(DEMO_SUPPLIER_UIDS.join("\n"));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const parsedUids = useMemo(() => parseUidText(uidsText), [uidsText]);

  async function call(path: string, payload: Record<string, unknown>) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
    if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || `Failed ${path}`));
    return data;
  }

  async function run() {
    if (!tenantSlug.trim() || !tenantName.trim() || !bid.trim()) {
      setStatus("Completá tenant + bid.");
      return;
    }
    if (parsedUids.length === 0) {
      setStatus("Pegá al menos 1 UID válida.");
      return;
    }

    setPending(true);
    setStatus("Ejecutando onboarding...");
    try {
      await call("/api/admin/tenants", { slug: tenantSlug.trim(), name: tenantName.trim() }).catch(() => null);
      await call("/api/admin/batches/register", {
        mode: "supplier",
        tenant_slug: tenantSlug.trim(),
        bid: bid.trim(),
        chip_model: "NTAG 424 DNA TagTamper",
        sku: "wine-secure",
        quantity: parsedUids.length,
        notes: `Quick onboarding (${context})`,
        k_meta_hex: "C2A462E6AB434828153D73CE440704AC",
        k_file_hex: "BFCE6C576540C04C840F1CFD457BF213",
      });
      const imported = await call(`/api/admin/batches/${encodeURIComponent(bid.trim())}/import-uids`, { uids: parsedUids, sourceType: "quick_panel" });
      const activated = await call(`/api/admin/batches/${encodeURIComponent(bid.trim())}/activate-all`, { limit: parsedUids.length });
      setStatus(`✅ Listo: ${imported.imported || 0} UIDs importadas · ${activated.activated || 0} activadas.`);
    } catch (error) {
      setStatus(`❌ ${error instanceof Error ? error.message : "onboarding failed"}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5 text-sm text-slate-200">
      <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-cyan-100">Super Admin · Quick onboarding</h2>
      <p className="mt-2 text-xs text-slate-400">Flujo único para CEO/operator: crear tenant + registrar batch + importar + activar tags.</p>
      <div className="mt-3 flex gap-2 text-xs">
        <button type="button" className={`rounded-lg border px-2 py-1 ${mode === "demo" ? "border-cyan-300/35 bg-cyan-500/10 text-cyan-100" : "border-white/10 text-slate-300"}`} onClick={() => {
          setMode("demo");
          setBid(DEMO_SUPPLIER_BATCH_ID);
          setUidsText(DEMO_SUPPLIER_UIDS.join("\n"));
        }}>Demo mode</button>
        <button type="button" className={`rounded-lg border px-2 py-1 ${mode === "real" ? "border-emerald-300/35 bg-emerald-500/10 text-emerald-100" : "border-white/10 text-slate-300"}`} onClick={() => setMode("real")}>Producción real</button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="tenant slug" value={tenantSlug} onChange={(event) => setTenantSlug(event.target.value)} />
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="tenant name" value={tenantName} onChange={(event) => setTenantName(event.target.value)} />
        <input className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" placeholder="BID" value={bid} onChange={(event) => setBid(event.target.value)} />
      </div>
      <textarea className="mt-3 min-h-24 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white" value={uidsText} onChange={(event) => setUidsText(event.target.value)} placeholder="1 UID por línea o separadas por coma" />
      <p className="mt-1 text-[11px] text-slate-400">UIDs válidas detectadas: {parsedUids.length}</p>
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-slate-400">Permiso esperado: super-admin / tenant-admin con acceso admin API.</p>
        <Button disabled={pending} onClick={() => void run()}>{pending ? "Procesando..." : "Auto onboard now"}</Button>
      </div>
      {status ? <p className="mt-3 text-xs text-cyan-100">{status}</p> : null}
    </Card>
  );
}
