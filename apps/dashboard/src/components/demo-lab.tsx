"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, WorldMapPlaceholder } from "@product/ui";

type Summary = {
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: Array<{ id: number; result: string; uid_hex?: string; created_at?: string; city?: string; country_code?: string; lat?: number; lng?: number; product_name?: string; vertical?: string }>;
};

type Locale = "es-AR" | "pt-BR" | "en";
type Pack = { key: string; icType: string; batchId: string };

const COPY: Record<Locale, Record<string, string>> = {
  "es-AR": { intro: "Demo Lab crea flujos reales por vertical con packs CSV+JSON.", why215: "NTAG215 supera QR/email/foto para acceso/campañas low-cost.", why424: "NTAG424 DNA TT supera credenciales estáticas para anti-clone/tamper.", pick: "Elegí vertical" },
  "pt-BR": { intro: "Demo Lab cria fluxos reais por vertical com packs CSV+JSON.", why215: "NTAG215 supera QR/e-mail/foto para acesso/campanhas low-cost.", why424: "NTAG424 DNA TT supera credenciais estáticas para anti-clone/tamper.", pick: "Escolha vertical" },
  en: { intro: "Demo Lab creates real vertical flows using CSV+JSON packs.", why215: "NTAG215 beats QR/email/photo for low-cost access and campaigns.", why424: "NTAG424 DNA TT beats static credentials for anti-clone/tamper.", pick: "Choose vertical" },
};

function detectLocale(): Locale {
  const v = (typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || "es-AR" : "es-AR") as Locale;
  return v === "pt-BR" || v === "en" ? v : "es-AR";
}

async function call(path: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false, reason: "Invalid JSON" }));
  if (!res.ok) throw new Error((data && (data.reason || data.error)) || `Request failed ${res.status}`);
  return data;
}

export function DemoLab() {
  const [out, setOut] = useState("Ready");
  const [summary, setSummary] = useState<Summary>({});
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pack, setPack] = useState("wine-secure");
  const [pending, setPending] = useState(false);
  const locale = detectLocale();

  async function runAction(action: () => Promise<unknown>) {
    setPending(true);
    try {
      const r = await action();
      setOut(JSON.stringify(r, null, 2));
      await refreshSummary();
    } catch (error) {
      setOut(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    void (async () => {
      const res = await call("packs");
      const list = Array.isArray(res?.packs) ? (res.packs as Pack[]) : [];
      setPacks(list);
      if (list.length > 0 && !list.find((p) => p.key === pack)) setPack(list[0].key);
    })();
  }, []);

  const readFile = async (f: File) => await f.text();

  const points = useMemo(
    () => (summary.events || []).filter((e) => typeof e.lat === "number" && typeof e.lng === "number").map((e) => ({ city: e.city || "Unknown", country: e.country_code || "--", lat: Number(e.lat), lng: Number(e.lng), scans: 1, risk: e.result === "VALID" ? 0 : 1 })),
    [summary.events]
  );

  const refreshSummary = async () => {
    const data = await call("summary");
    setSummary(data || {});
    setOut(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-slate-300">
        <p>{COPY[locale].intro}</p>
        <p className="mt-2 text-cyan-300">{COPY[locale].why215}</p>
        <p className="text-cyan-300">{COPY[locale].why424}</p>
      </Card>

      <Card className="p-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">{COPY[locale].pick}</label>
        <select className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" value={pack} onChange={(e) => setPack(e.target.value)}>
          {(packs.length ? packs : [{ key: "wine-secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02" }]).map((p) => <option key={p.key} value={p.key}>{p.key} · {p.icType}</option>)}
        </select>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("use-pack", "POST", { pack }))} disabled={pending}>Use Built-in Demo Pack</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("generate-live-scans", "POST", { count: 10, mode: "valid" }))} disabled={pending}>Generate Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("reset", "POST"))} disabled={pending}>Reset Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("simulate-tap", "POST", { mode: "valid" }))} disabled={pending}>Simulate NFC Tap</button>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href={`/demo/${pack}/manifest.csv`} download>Download CSV</a>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href={`/demo/${pack}/seed.json`} download>Download JSON</a>
      </div>
      <p className="text-xs text-slate-400">{pending ? "Running action..." : "Ready for action."}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <button className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-sm text-violet-100" onClick={() => runAction(() => call("generate-live-scans", "POST", { count: 30, mode: "mixed" }))} disabled={pending}>Generate live scans stream</button>
        <a className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm text-cyan-100" href="https://nexid.lat/demo" target="_blank" rel="noreferrer">Open mobile preview</a>
        <a className="rounded-xl border border-white/15 bg-slate-900 p-3 text-sm text-white" href="/" target="_blank" rel="noreferrer">Open tenant dashboard view</a>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <button className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-3 text-sm text-violet-100" onClick={async () => { const r = await call("generate-live-scans", "POST", { count: 30, mode: "mixed" }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Generate live scans stream</button>
        <a className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm text-cyan-100" href="http://localhost:3000/demo" target="_blank" rel="noreferrer">Open mobile preview</a>
        <a className="rounded-xl border border-white/15 bg-slate-900 p-3 text-sm text-white" href="/" target="_blank" rel="noreferrer">Open tenant dashboard view</a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">CSV manifest uploader
          <input type="file" accept=".csv,text/csv" className="mt-2 block w-full" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const csv = await readFile(file); await runAction(() => call("upload-manifest", "POST", { bid: "DEMO-2026-02", csv })); }} />
        </label>
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">JSON metadata uploader
          <input type="file" accept=".json,application/json" className="mt-2 block w-full" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const data = JSON.parse(await readFile(file)); await runAction(() => call("upload-products", "POST", { bid: "DEMO-2026-02", products: data.products || data.bottles || data })); }} />
        </label>
      </div>
      <p className="text-xs text-slate-400">{pending ? "Running action..." : "Ready for action."}</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 text-sm text-slate-200">Tenant: <b>{summary.tenant?.name || "-"}</b><br />Slug: {summary.tenant?.slug || "-"}</Card>
        <Card className="p-4 text-sm text-slate-200">Batch: <b>{summary.batch?.bid || "-"}</b><br />Tags: {summary.tagCount ?? 0}</Card>
        <Card className="p-4 text-sm text-slate-200">CRM lite<br />Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}</Card>
      </div>

      <WorldMapPlaceholder title="Live map updates" subtitle="Mapped from real event geo fields" points={points} />

      <Card className="p-4"><h3 className="text-sm font-semibold text-white">Mobile preview updates</h3><p className="mt-2 text-sm text-slate-300">Last event state: {(summary.events || [])[0]?.result || "N/A"} · {(summary.events || [])[0]?.product_name || "-"}</p><p className="mt-2 text-xs text-cyan-200">Idle · Scanning · Valid · Tampered · Enterprise backend view</p></Card>

      <Card className="p-4"><h3 className="text-sm font-semibold text-white">Recent events</h3><div className="mt-2 space-y-2 text-sm text-slate-300">{(summary.events || []).slice(0, 8).map((e) => <div key={e.id}>{e.result} · {e.product_name || e.uid_hex || "-"} · {e.vertical || "-"}</div>)}</div></Card>

      <pre className="overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre>
    </div>
  );
}
