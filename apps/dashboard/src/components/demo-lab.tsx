"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, WorldMapPlaceholder } from "@product/ui";

type SummaryEvent = {
  id: number;
  result: string;
  uid_hex?: string;
  created_at?: string;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  product_name?: string;
  vertical?: string;
};

type Summary = {
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: SummaryEvent[];
};

type Locale = "es-AR" | "pt-BR" | "en";
type Pack = { key: string; icType: string; batchId: string };
type DemoMode = "simulated" | "consumer_tap" | "live_nfc";

type ScanScenario = {
  label: string;
  description: string;
  eventType: "valid" | "tamper" | "replay" | "claim" | "redeem" | "checkin";
};

const COPY: Record<Locale, Record<string, string>> = {
  "es-AR": {
    intro: "Demo Lab emula lectura real de tags (botella, pulsera, etiqueta) con backend y geolocalización.",
    why215: "NTAG215: ideal para acceso, serialización y campañas masivas low-cost.",
    why424: "NTAG424 DNA/TT: autenticidad fuerte y detección de apertura/tamper con veredicto en backend.",
    pick: "Paso 1 · Elegí un pack vertical",
  },
  "pt-BR": {
    intro: "Demo Lab emula leitura real de tags (garrafa, pulseira, etiqueta) com backend e geolocalização.",
    why215: "NTAG215: ideal para acesso, serialização e campanhas massivas low-cost.",
    why424: "NTAG424 DNA/TT: autenticidade robusta e abertura/tamper resolvidos no backend.",
    pick: "Passo 1 · Escolha um pack vertical",
  },
  en: {
    intro: "Demo Lab emulates real tag reads (bottle, wristband, label) with backend resolution and geolocation.",
    why215: "NTAG215: ideal for access, serialization and low-cost high-volume campaigns.",
    why424: "NTAG424 DNA/TT: strong authenticity and sealed/opened tamper state resolved in backend.",
    pick: "Step 1 · Pick a vertical pack",
  },
};

const SCENARIOS: ScanScenario[] = [
  { label: "AUTH OK", description: "Validación normal de autenticidad", eventType: "valid" },
  { label: "TAMPER RISK", description: "Producto abierto / sello alterado", eventType: "tamper" },
  { label: "DUPLICATE RISK", description: "Relectura sospechosa / posible clon", eventType: "replay" },
  { label: "CLAIMED", description: "Cambio de titularidad", eventType: "claim" },
  { label: "REDEEMED", description: "Canje o redención final", eventType: "redeem" },
  { label: "CHECK-IN", description: "Ingreso de pulsera/credencial a evento", eventType: "checkin" },
];

function detectLocale(): Locale {
  const value = (typeof document !== "undefined"
    ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || "es-AR"
    : "es-AR") as Locale;
  return value === "pt-BR" || value === "en" ? value : "es-AR";
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

function mapScenarioToApiMode(eventType: ScanScenario["eventType"]) {
  if (eventType === "tamper") return "tamper";
  if (eventType === "replay") return "replay";
  return "valid";
}

function modeLabel(mode: DemoMode) {
  if (mode === "simulated") return "SIMULATED";
  if (mode === "consumer_tap") return "PRODUCTION-LIKE PREVIEW";
  return "LIVE NFC";
}

export function DemoLab() {
  const [out, setOut] = useState("Ready");
  const [summary, setSummary] = useState<Summary>({});
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pack, setPack] = useState("wine-secure");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<DemoMode>("simulated");
  const [selectedScenario, setSelectedScenario] = useState<ScanScenario["eventType"]>("valid");
  const locale = detectLocale();
  const webBase = process.env.NEXT_PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_WEB_BASE_URL || "https://nexid.lat";

  const nfcSupport = typeof window !== "undefined" && "NDEFReader" in window;
  const hasSecureContext = typeof window !== "undefined" ? window.isSecureContext : false;
  const hasGeo = typeof navigator !== "undefined" && "geolocation" in navigator;

  const latestEvent = (summary.events || [])[0];

  async function runAction(action: () => Promise<unknown>) {
    setPending(true);
    try {
      const result = await action();
      setOut(JSON.stringify(result, null, 2));
      await refreshSummary();
    } catch (error) {
      setOut(error instanceof Error ? error.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  const refreshSummary = async () => {
    const data = await call("summary");
    setSummary(data || {});
  };

  useEffect(() => {
    void (async () => {
      const res = await call("packs");
      const list = Array.isArray(res?.packs) ? (res.packs as Pack[]) : [];
      setPacks(list);
      if (list.length > 0 && !list.find((item) => item.key === pack)) {
        setPack(list[0].key);
      }
      await refreshSummary();
    })();
  }, []);

  const points = useMemo(
    () =>
      (summary.events || [])
        .filter((event) => typeof event.lat === "number" && typeof event.lng === "number")
        .map((event) => ({
          city: event.city || "Unknown",
          country: event.country_code || "--",
          lat: Number(event.lat),
          lng: Number(event.lng),
          scans: 1,
          risk: event.result === "VALID" ? 0 : 1,
        })),
    [summary.events]
  );

  const readFile = async (file: File) => file.text();

  async function downloadPackFile(type: "manifest" | "seed") {
    await runAction(async () => {
      const extension = type === "seed" ? "json" : "csv";
      const response = await fetch(`/api/internal/demo/pack-file?pack=${encodeURIComponent(pack)}&type=${type}`);
      if (!response.ok) throw new Error(`Download failed (${response.status})`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${pack}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return { ok: true, downloaded: `${pack}.${extension}` };
    });
  }

  const openMobilePreviewHref = `${webBase}/?demoMode=${mode}&pack=${pack}`;

  return (
    <div className="demo-lab space-y-4">
      <Card className="demo-lab-card p-4 text-sm text-slate-300">
        <p>{COPY[locale].intro}</p>
        <p className="mt-2 text-cyan-300">{COPY[locale].why215}</p>
        <p className="text-cyan-300">{COPY[locale].why424}</p>
      </Card>

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Demo Wizard (para reuniones)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
          <li>Paso 1: elegí un pack vertical (vino, eventos, documentos, etc).</li>
          <li>Paso 2: elegí modo de demo (simulado, consumer tap, live NFC).</li>
          <li>Paso 3: cargá el pack y ejecutá escenarios con un clic.</li>
          <li>Paso 4: abrí la vista mobile para mostrar la experiencia final del usuario.</li>
        </ol>
      </Card>

      <Card className="demo-lab-card p-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">{COPY[locale].pick}</label>
        <select
          className="demo-lab-input mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-sm text-white"
          value={pack}
          onChange={(event) => setPack(event.target.value)}
        >
          {(packs.length ? packs : [{ key: "wine-secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02" }]).map((item) => (
            <option key={item.key} value={item.key}>
              {item.key} · {item.icType}
            </option>
          ))}
        </select>
      </Card>

      <Card className="demo-lab-card p-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">Paso 2 · Demo mode</label>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <button
            className={`rounded-xl border p-3 text-left text-xs ${mode === "simulated" ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`}
            onClick={() => setMode("simulated")}
            type="button"
          >
            <p className="font-semibold">SIMULATED</p>
            <p className="mt-1 text-[11px] text-slate-300">Universal: desktop/browser sin NFC real.</p>
          </button>
          <button
            className={`rounded-xl border p-3 text-left text-xs ${mode === "consumer_tap" ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`}
            onClick={() => setMode("consumer_tap")}
            type="button"
          >
            <p className="font-semibold">PRODUCTION-LIKE PREVIEW</p>
            <p className="mt-1 text-[11px] text-slate-300">Flujo real de usuario: tap/QR → página mobile.</p>
          </button>
          <button
            className={`rounded-xl border p-3 text-left text-xs ${mode === "live_nfc" ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`}
            onClick={() => setMode("live_nfc")}
            type="button"
          >
            <p className="font-semibold">LIVE NFC LAB</p>
            <p className="mt-1 text-[11px] text-slate-300">Solo compatible Android + Chrome + HTTPS.</p>
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-300">
          Modo activo: <b>{modeLabel(mode)}</b>
        </p>
        {mode === "live_nfc" ? (
          <p className="mt-1 text-xs text-slate-400">
            Compatibilidad · NFC: {nfcSupport ? "ok" : "no disponible"} · HTTPS: {hasSecureContext ? "ok" : "requerido"} · GPS API: {hasGeo ? "ok" : "no disponible"}
          </p>
        ) : null}
      </Card>

      <Card className="demo-lab-card p-4 text-xs text-slate-300">
        <p>
          ⓘ <b>Fuente de verdad</b>: CSV manifest + seed JSON.
        </p>
        <p className="mt-1">ⓘ <b>No overpromise</b>: Web NFC web lee NDEF, no bajo nivel del chip 424.</p>
        <p className="mt-1">ⓘ <b>GPS</b>: viene del teléfono/browser con permiso, no del NFC.</p>
        <p className="mt-1">ⓘ <b>Veredicto secure/tamper</b>: siempre lo resuelve backend.</p>
      </Card>



      <Card className="demo-lab-card p-4 text-xs text-slate-300">
        <h3 className="text-sm font-semibold text-white">¿Qué emulamos exactamente cuando “acercás el celular”?</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <p><b>1) Lo que trae la etiqueta/tag:</b> UID/URL NDEF, tipo de chip y metadata inicial del pack (vino, evento, docs).</p>
          <p><b>2) Lo que aporta el celular:</b> fecha/hora local, idioma, navegador, geolocalización (si el usuario da permiso).</p>
          <p><b>3) Lo que resuelve backend:</b> autenticidad, riesgo de duplicado, estado (sealed/opened/tamper) e historial.</p>
          <p><b>4) Lo que agrega la demo:</b> narrativa comercial y eventos simulados para enseñar casos reales.</p>
        </div>
      </Card>

      <Card className="demo-lab-card p-4 text-xs text-slate-300">
        <h3 className="text-sm font-semibold text-white">Guión de demo en vivo (3 minutos)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Cargar pack vertical con <b>Load demo pack</b>.</li>
          <li>Elegir modo: <b>SIMULATED</b> o <b>PRODUCTION-LIKE PREVIEW</b>.</li>
          <li>Disparar 2-3 escenarios: <b>AUTH OK</b>, <b>TAMPER</b>, <b>DUPLICATE</b>.</li>
          <li>Mostrar <b>Mobile preview snapshot</b> + <b>Recent events</b> + mapa para evidenciar trazabilidad.</li>
          <li>Opcional: pasar a <b>LIVE NFC</b> en Android Chrome compatible para lectura NDEF real.</li>
        </ol>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("use-pack", "POST", { pack }))} disabled={pending}>
          Paso 3 · Load demo pack
        </button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("generate-live-scans", "POST", { count: 10, mode: "mixed" }))} disabled={pending}>
          Generate live stream
        </button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => runAction(() => call("reset", "POST"))} disabled={pending}>
          Reset demo
        </button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => void downloadPackFile("manifest")} disabled={pending}>
          Download CSV manifest
        </button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white" onClick={() => void downloadPackFile("seed")} disabled={pending}>
          Download JSON seed
        </button>
        <a className="demo-lab-action rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-sm text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer">
          Paso 4 · Open mobile preview
        </a>
      </div>

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Simular evento (un clic, apto demo comercial)</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.eventType}
              type="button"
              className={`rounded-xl border p-3 text-left text-xs ${selectedScenario === scenario.eventType ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900 text-slate-200"}`}
              onClick={() => setSelectedScenario(scenario.eventType)}
            >
              <p className="font-semibold">{scenario.label}</p>
              <p className="mt-1 text-[11px] text-slate-300">{scenario.description}</p>
            </button>
          ))}
        </div>
        <button
          className="mt-3 w-full rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100"
          onClick={() => runAction(() => call("simulate-tap", "POST", { mode: mapScenarioToApiMode(selectedScenario), scenario: selectedScenario, source: mode }))}
          disabled={pending}
        >
          Simulate selected scenario
        </button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          CSV manifest uploader
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-2 block w-full"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const csv = await readFile(file);
              await runAction(() => call("upload-manifest", "POST", { bid: "DEMO-2026-02", csv }));
            }}
          />
        </label>
        <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-sm text-white">
          JSON metadata uploader
          <input
            type="file"
            accept=".json,application/json"
            className="mt-2 block w-full"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const data = JSON.parse(await readFile(file));
              await runAction(() => call("upload-products", "POST", { bid: "DEMO-2026-02", ...data }));
            }}
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="demo-lab-card p-4 text-sm text-slate-200">
          Tenant: <b>{summary.tenant?.name || "-"}</b>
          <br />
          Slug: {summary.tenant?.slug || "-"}
        </Card>
        <Card className="demo-lab-card p-4 text-sm text-slate-200">
          Batch: <b>{summary.batch?.bid || "-"}</b>
          <br />
          Tags: {summary.tagCount ?? 0}
        </Card>
        <Card className="demo-lab-card p-4 text-sm text-slate-200">
          CRM lite
          <br />
          Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}
        </Card>
      </div>

      <WorldMapPlaceholder title="Ops map (demo)" subtitle="Eventos simulados + backend events con geolocalización" points={points} />

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Cómo sabemos cada dato</h3>
        <div className="mt-2 grid gap-2 text-xs text-slate-300 md:grid-cols-2">
          <p>✅ Leído del tag: URL/NDEF + serial (si el navegador lo expone).</p>
          <p>✅ Aportado por el teléfono: hora local, idioma, GPS y precisión.</p>
          <p>✅ Resuelto por nexID backend: autenticidad, tamper, duplicate risk, passport.</p>
          <p>✅ Simulado para demo: narrativa comercial, histórico seed y casos de uso.</p>
        </div>
      </Card>

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Mobile preview snapshot</h3>
        <p className="mt-2 text-sm text-slate-300">
          Estado actual: <b>{latestEvent?.result || "N/A"}</b> · Item: {latestEvent?.product_name || "-"}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Último tap: {latestEvent?.city || "-"}, {latestEvent?.country_code || "-"} · {latestEvent?.created_at || "sin eventos"}
        </p>
      </Card>



      <Card className="demo-lab-card p-4 text-xs text-slate-300">
        <h3 className="text-sm font-semibold text-white">Entradas recomendadas por tipo de usuario</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <a className="rounded-lg border border-white/10 bg-slate-900 p-2" href="/demo-lab" target="_blank" rel="noreferrer"><b>Admin/Tenant</b><br />/demo-lab</a>
          <a className="rounded-lg border border-white/10 bg-slate-900 p-2" href="/demo" target="_blank" rel="noreferrer"><b>Usuario final</b><br />/demo</a>
          <a className="rounded-lg border border-white/10 bg-slate-900 p-2" href="/analytics" target="_blank" rel="noreferrer"><b>Operaciones</b><br />/analytics</a>
        </div>
      </Card>

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Recent events</h3>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {(summary.events || []).slice(0, 8).map((event) => (
            <div key={event.id}>
              {event.result} · {event.product_name || event.uid_hex || "-"} · {event.vertical || "-"} · {event.city || "-"}
            </div>
          ))}
        </div>
      </Card>

      <pre className="demo-lab-log overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre>
    </div>
  );
}
