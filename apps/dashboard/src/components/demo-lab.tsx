"use client";

import { useMemo, useState } from "react";
import { Card, WorldMapPlaceholder } from "@product/ui";

type Summary = {
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: Array<{ id: number; result: string; uid_hex?: string; created_at?: string }>;
};

async function call(path: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  return res.json();
}

export function DemoLab() {
  const [out, setOut] = useState("Ready");
  const [summary, setSummary] = useState<Summary>({});

  const readFile = async (f: File) => await f.text();

  const points = useMemo(
    () =>
      (summary.events || []).map((e, i) => ({
        city: i % 2 ? "São Paulo" : "Mendoza",
        country: i % 2 ? "BR" : "AR",
        lat: i % 2 ? -23.55 : -32.8895,
        lng: i % 2 ? -46.63 : -68.8458,
        scans: 1,
        risk: e.result === "VALID" ? 0 : 1,
      })),
    [summary.events]
  );

  const refreshSummary = async () => {
    const data = await call("summary");
    setSummary(data || {});
    setOut(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-slate-300">Demo Lab auto-creates demo tenant, batch, tags, metadata, CRM-lite and live scan flow using built-in CSV/JSON pack.</Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("use-pack", "POST"); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Use Built-in Demo Pack</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("generate-live-scans", "POST", { count: 10, mode: "valid" }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Generate Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("reset", "POST"); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Reset Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("simulate-tap", "POST", { mode: "valid" }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Simulate NFC Tap</button>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href="/demo/demobodega_manifest.csv" download>Download CSV</a>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href="/demo/demobodega_seed.json" download>Download JSON</a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          CSV manifest uploader
          <input type="file" accept=".csv,text/csv" className="mt-2 block w-full" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const csv = await readFile(file);
            const r = await call("upload-manifest", "POST", { bid: "DEMO-2026-02", csv });
            setOut(JSON.stringify(r, null, 2));
            await refreshSummary();
          }} />
        </label>
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          JSON metadata uploader
          <input type="file" accept=".json,application/json" className="mt-2 block w-full" onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const data = JSON.parse(await readFile(file));
            const r = await call("upload-products", "POST", { bid: "DEMO-2026-02", products: data.products || data.bottles || data });
            setOut(JSON.stringify(r, null, 2));
            await refreshSummary();
          }} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 text-sm text-slate-200">Tenant: <b>{summary.tenant?.name || "-"}</b><br/>Slug: {summary.tenant?.slug || "-"}</Card>
        <Card className="p-4 text-sm text-slate-200">Batch: <b>{summary.batch?.bid || "-"}</b><br/>Tags: {summary.tagCount ?? 0}</Card>
        <Card className="p-4 text-sm text-slate-200">CRM lite<br/>Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}</Card>
      </div>

      <WorldMapPlaceholder title="Live map updates" subtitle="Updated from demo events" points={points} />

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Mobile preview updates</h3>
        <p className="mt-2 text-sm text-slate-300">Last event state: {(summary.events || [])[0]?.result || "N/A"}</p>
        <p className="text-xs text-slate-400">Use “Simulate NFC Tap” to update valid/replay/tamper states.</p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Recent events</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {(summary.events || []).slice(0, 8).map((e) => <div key={e.id}>{e.result} · {e.uid_hex || "-"}</div>)}
        </div>
      </Card>

      <pre className="overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre>
    </div>
  );
}
