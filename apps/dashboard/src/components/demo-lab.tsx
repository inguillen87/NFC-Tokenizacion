"use client";

import { useMemo, useState } from "react";
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

type Pack = { key: string; label: Record<Locale, string>; tagType: string; story: Record<Locale, string> };

const PACKS: Pack[] = [
  { key: "events-basic", tagType: "NTAG215", label: { "es-AR": "Eventos (básico)", "pt-BR": "Eventos (básico)", en: "Events (basic)" }, story: { "es-AR": "Mejor UX que QR/email/foto para acceso y campañas.", "pt-BR": "UX melhor que QR/e-mail/foto para acesso e campanhas.", en: "Better UX than QR/email/photo for access and campaigns." } },
  { key: "wine-secure", tagType: "NTAG424DNA_TT", label: { "es-AR": "Vino (secure)", "pt-BR": "Vinho (secure)", en: "Wine (secure)" }, story: { "es-AR": "Autenticidad premium y tamper para bodega/exportación.", "pt-BR": "Autenticidade premium e tamper para vinícola/exportação.", en: "Premium authenticity and tamper for winery/export." } },
  { key: "cosmetics-secure", tagType: "NTAG424DNA_TT", label: { "es-AR": "Cosmética (secure)", "pt-BR": "Cosméticos (secure)", en: "Cosmetics (secure)" }, story: { "es-AR": "Protección de marca y retail anti-fraude.", "pt-BR": "Proteção de marca e varejo anti-fraude.", en: "Brand protection and retail anti-fraud." } },
  { key: "pharma-secure", tagType: "NTAG424DNA_TT", label: { "es-AR": "Pharma (secure)", "pt-BR": "Farma (secure)", en: "Pharma (secure)" }, story: { "es-AR": "Cadena de custodia y control de autenticidad.", "pt-BR": "Cadeia de custódia e controle de autenticidade.", en: "Chain of custody and authenticity control." } },
  { key: "agro-secure", tagType: "NTAG424DNA_TT", label: { "es-AR": "Agro (secure)", "pt-BR": "Agro (secure)", en: "Agro (secure)" }, story: { "es-AR": "Trazabilidad de insumos y anti-relabeling.", "pt-BR": "Rastreabilidade de insumos e anti-relabeling.", en: "Input traceability and anti-relabeling." } },
  { key: "luxury-basic", tagType: "NTAG215", label: { "es-AR": "Lujo (básico)", "pt-BR": "Luxo (básico)", en: "Luxury (basic)" }, story: { "es-AR": "Invitaciones y experiencias premium a bajo costo.", "pt-BR": "Convites e experiências premium com baixo custo.", en: "Premium invitations and experiences at low cost." } },
];

const COPY: Record<Locale, Record<string, string>> = {
  "es-AR": {
    intro: "Demo Lab crea tenant/batch/tags/eventos reales por vertical con pack CSV+JSON.",
    why215: "NTAG215 > QR/email/foto en costo+experiencia para casos simples.",
    why424: "NTAG424 DNA TT > QR estático para anti-clonación, tamper y autenticidad premium.",
  },
  "pt-BR": {
    intro: "Demo Lab cria tenant/batch/tags/eventos reais por vertical com pack CSV+JSON.",
    why215: "NTAG215 > QR/e-mail/foto em custo+experiência para casos simples.",
    why424: "NTAG424 DNA TT > QR estático para anti-clonagem, tamper e autenticidade premium.",
  },
  en: {
    intro: "Demo Lab creates real tenant/batch/tags/events per vertical using CSV+JSON packs.",
    why215: "NTAG215 beats QR/email/photo for low-cost simple journeys.",
    why424: "NTAG424 DNA TT beats static QR for anti-clone, tamper and premium authenticity.",
  },
};

function detectLocale(): Locale {
  const v = (typeof document !== "undefined" ? (document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || "es-AR") : "es-AR") as Locale;
  return v === "pt-BR" || v === "en" ? v : "es-AR";
}

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
  const [pack, setPack] = useState("wine-secure");
  const locale = detectLocale();

  const readFile = async (f: File) => await f.text();

  const points = useMemo(
    () =>
      (summary.events || [])
        .filter((e) => typeof e.lat === "number" && typeof e.lng === "number")
        .map((e) => ({ city: e.city || "Unknown", country: e.country_code || "--", lat: Number(e.lat), lng: Number(e.lng), scans: 1, risk: e.result === "VALID" ? 0 : 1 })),
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
        <label className="text-xs uppercase tracking-wide text-slate-400">Vertical pack</label>
        <select className="mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white" value={pack} onChange={(e) => setPack(e.target.value)}>
          {PACKS.map((p) => <option key={p.key} value={p.key}>{p.label[locale]} · {p.tagType}</option>)}
        </select>
        <p className="mt-2 text-xs text-slate-400">{PACKS.find((p) => p.key === pack)?.story[locale]}</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("use-pack", "POST", { pack }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Use Built-in Demo Pack</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("generate-live-scans", "POST", { count: 10, mode: "valid" }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Generate Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("reset", "POST"); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Reset Demo</button>
        <button className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={async () => { const r = await call("simulate-tap", "POST", { mode: "valid" }); setOut(JSON.stringify(r, null, 2)); await refreshSummary(); }}>Simulate NFC Tap</button>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href={`/demo/${pack}/manifest.csv`} download>Download CSV</a>
        <a className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" href={`/demo/${pack}/seed.json`} download>Download JSON</a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          CSV manifest uploader
          <input type="file" accept=".csv,text/csv" className="mt-2 block w-full" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            const csv = await readFile(file); const r = await call("upload-manifest", "POST", { bid: "DEMO-2026-02", csv });
            setOut(JSON.stringify(r, null, 2)); await refreshSummary();
          }} />
        </label>
        <label className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          JSON metadata uploader
          <input type="file" accept=".json,application/json" className="mt-2 block w-full" onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            const data = JSON.parse(await readFile(file)); const r = await call("upload-products", "POST", { bid: "DEMO-2026-02", products: data.products || data.bottles || data });
            setOut(JSON.stringify(r, null, 2)); await refreshSummary();
          }} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-4 text-sm text-slate-200">Tenant: <b>{summary.tenant?.name || "-"}</b><br />Slug: {summary.tenant?.slug || "-"}</Card>
        <Card className="p-4 text-sm text-slate-200">Batch: <b>{summary.batch?.bid || "-"}</b><br />Tags: {summary.tagCount ?? 0}</Card>
        <Card className="p-4 text-sm text-slate-200">CRM lite<br />Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}</Card>
      </div>

      <WorldMapPlaceholder title="Live map updates" subtitle="Mapped from real event geo fields" points={points} />

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Mobile preview updates</h3>
        <p className="mt-2 text-sm text-slate-300">Last event state: {(summary.events || [])[0]?.result || "N/A"} · {(summary.events || [])[0]?.product_name || "-"}</p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Recent events</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {(summary.events || []).slice(0, 8).map((e) => <div key={e.id}>{e.result} · {e.product_name || e.uid_hex || "-"} · {e.vertical || "-"}</div>)}
        </div>
      </Card>

      <pre className="overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre>
    </div>
  );
}
