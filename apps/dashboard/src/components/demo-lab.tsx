"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";

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

type PermissionStateLite = "unknown" | "granted" | "denied" | "prompt";

const COPY: Record<Locale, Record<string, string>> = {
  "es-AR": {
    intro: "Demo Lab emula lectura real de tags (botella, pulsera, etiqueta) con backend y geolocalización.",
    pick: "Paso 1 · Elegí un pack vertical",
  },
  "pt-BR": { intro: "Demo Lab emula leitura real de tags com backend e geolocalização.", pick: "Passo 1 · Escolha um pack vertical" },
  en: { intro: "Demo Lab emulates real tag reads with backend resolution and geolocation.", pick: "Step 1 · Pick a vertical pack" },
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
  const value = (typeof document !== "undefined" ? document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || "es-AR" : "es-AR") as Locale;
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
  const [presenterMode, setPresenterMode] = useState(false);
  const [nfcPermission, setNfcPermission] = useState<PermissionStateLite>("unknown");
  const [geoPermission, setGeoPermission] = useState<PermissionStateLite>("unknown");
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
      if (list.length > 0 && !list.find((item) => item.key === pack)) setPack(list[0].key);
      await refreshSummary();
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      if (typeof navigator === "undefined" || !("permissions" in navigator)) return;
      try {
        const geo = await navigator.permissions.query({ name: "geolocation" });
        setGeoPermission(geo.state);
      } catch {}
      try {
        const nfc = await navigator.permissions.query({ name: "nfc" as PermissionName });
        setNfcPermission(nfc.state);
      } catch {}
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

  async function requestGeoForLive() {
    if (!hasGeo) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOut(
          JSON.stringify(
            {
              ok: true,
              source: "phone",
              note: "GPS only with explicit user permission.",
              geo: {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date(position.timestamp).toISOString(),
              },
            },
            null,
            2
          )
        );
      },
      (error) => {
        setOut(JSON.stringify({ ok: false, reason: error.message }, null, 2));
      }
    );
  }

  async function runAuto90SecondsDemo() {
    const playlist: Array<ScanScenario["eventType"]> = ["valid", "tamper", "replay", "claim", "redeem", "checkin"];
    for (const scenario of playlist) {
      // eslint-disable-next-line no-await-in-loop
      await runAction(() => call("simulate-tap", "POST", { mode: mapScenarioToApiMode(scenario), scenario, source: mode }));
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }

  const openMobilePreviewHref = `${webBase}/demo-lab/mobile/demobodega/demo-item-001?demoMode=${mode}&pack=${pack}`;
  const textScale = presenterMode ? "text-base" : "text-sm";

  return (
    <div className={`demo-lab space-y-4 ${textScale}`}>
      <Card className="demo-lab-card p-4 text-slate-300">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>{COPY[locale].intro}</p>
          <button type="button" onClick={() => setPresenterMode((v) => !v)} className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white">
            {presenterMode ? "Salir modo presentador" : "Modo presentador"}
          </button>
        </div>
      </Card>

      <Card className="demo-lab-card p-4">
        <h3 className="font-semibold text-white">Demo Wizard (para reuniones)</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs text-slate-300">
          <li>Paso 1: elegí un pack vertical.</li>
          <li>Paso 2: elegí modo (simulado, consumer tap, live NFC).</li>
          <li>Paso 3: cargá pack y ejecutá escenarios.</li>
          <li>Paso 4: abrí la vista mobile por item/tenant.</li>
        </ol>
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
        <select className="demo-lab-input mt-2 w-full rounded-lg border border-white/10 bg-slate-900 p-2 text-white" value={pack} onChange={(event) => setPack(event.target.value)}>
          {(packs.length ? packs : [{ key: "wine-secure", icType: "NTAG424DNA_TT", batchId: "DEMO-2026-02" }]).map((item) => (
            <option key={item.key} value={item.key}>{item.key} · {item.icType}</option>
          ))}
        </select>
      </Card>

      <Card className="demo-lab-card p-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">Paso 2 · Demo mode</label>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {(["simulated", "consumer_tap", "live_nfc"] as DemoMode[]).map((item) => (
            <button key={item} className={`rounded-xl border p-3 text-left text-xs ${mode === item ? "border-cyan-300/60 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-200"}`} onClick={() => setMode(item)} type="button">
              <p className="font-semibold">{modeLabel(item)}</p>
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-300">Modo activo: <b>{modeLabel(mode)}</b></p>
      </Card>

      <Card className="demo-lab-card p-4 text-xs text-slate-300">
        <h3 className="text-sm font-semibold text-white">Live NFC panel operativo</h3>
        <p className="mt-1">NFC: <b>{nfcSupport ? "compatible" : "no disponible"}</b> · HTTPS: <b>{hasSecureContext ? "ok" : "requerido"}</b> · GPS API: <b>{hasGeo ? "disponible" : "no disponible"}</b></p>
        <p className="mt-1">Permiso NFC: <b>{nfcPermission}</b> · Permiso GPS: <b>{geoPermission}</b></p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-1 text-cyan-100" onClick={() => runAction(() => call("simulate-tap", "POST", { mode: "valid", scenario: "valid", source: "live_nfc" }))}>
            Start live NFC scan (emulado)
          </button>
          <button type="button" className="rounded-lg border border-white/20 px-3 py-1 text-white" onClick={requestGeoForLive}>
            Pedir geolocalización real
          </button>
        </div>
        <p className="mt-2 text-amber-300">Privacidad: no se obtiene GPS real sin permiso explícito del usuario.</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("use-pack", "POST", { pack }))} disabled={pending}>Paso 3 · Load demo pack</button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("generate-live-scans", "POST", { count: 10, mode: "mixed" }))} disabled={pending}>Generate live stream</button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => runAction(() => call("reset", "POST"))} disabled={pending}>Reset demo</button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => void downloadPackFile("manifest")} disabled={pending}>Download CSV manifest</button>
        <button className="demo-lab-action rounded-xl border border-white/10 bg-slate-900 p-3 text-white" onClick={() => void downloadPackFile("seed")} disabled={pending}>Download JSON seed</button>
        <a className="demo-lab-action rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3 text-cyan-100" href={openMobilePreviewHref} target="_blank" rel="noreferrer">Paso 4 · Open mobile preview</a>
      </div>

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Simular evento (un clic)</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((scenario) => (
            <button key={scenario.eventType} type="button" className={`rounded-xl border p-3 text-left text-xs ${selectedScenario === scenario.eventType ? "border-emerald-300/70 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900 text-slate-200"}`} onClick={() => setSelectedScenario(scenario.eventType)}>
              <p className="font-semibold">{scenario.label}</p>
              <p className="mt-1 text-[11px] text-slate-300">{scenario.description}</p>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <button className="w-full rounded-xl border border-emerald-300/30 bg-emerald-500/10 p-3 text-sm text-emerald-100" onClick={() => runAction(() => call("simulate-tap", "POST", { mode: mapScenarioToApiMode(selectedScenario), scenario: selectedScenario, source: mode }))} disabled={pending}>Simulate selected scenario</button>
          <button className="w-full rounded-xl border border-violet-300/30 bg-violet-500/10 p-3 text-sm text-violet-100" onClick={() => void runAuto90SecondsDemo()} disabled={pending}>Auto demo 90s</button>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-white">CSV manifest uploader
          <input type="file" accept=".csv,text/csv" className="mt-2 block w-full" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const csv = await readFile(file); await runAction(() => call("upload-manifest", "POST", { bid: "DEMO-2026-02", csv })); }} />
        </label>
        <label className="demo-lab-upload rounded-xl border border-white/10 bg-slate-900 p-3 text-white">JSON metadata uploader
          <input type="file" accept=".json,application/json" className="mt-2 block w-full" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const data = JSON.parse(await readFile(file)); await runAction(() => call("upload-products", "POST", { bid: "DEMO-2026-02", ...data })); }} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="demo-lab-card p-4 text-slate-200">Tenant: <b>{summary.tenant?.name || "-"}</b><br />Slug: {summary.tenant?.slug || "-"}</Card>
        <Card className="demo-lab-card p-4 text-slate-200">Batch: <b>{summary.batch?.bid || "-"}</b><br />Tags: {summary.tagCount ?? 0}</Card>
        <Card className="demo-lab-card p-4 text-slate-200">CRM lite<br />Leads: {summary.crm?.leads ?? 0} · Tickets: {summary.crm?.tickets ?? 0} · Orders: {summary.crm?.orders ?? 0}</Card>
      </div>

      <DemoOpsMap points={points} />

      <Card className="demo-lab-card p-4">
        <h3 className="text-sm font-semibold text-white">Mobile preview snapshot</h3>
        <p className="mt-2 text-slate-300">Estado actual: <b>{latestEvent?.result || "N/A"}</b> · Item: {latestEvent?.product_name || "-"}</p>
      </Card>

      {!presenterMode ? (
        <Card className="demo-lab-card p-4">
          <h3 className="text-sm font-semibold text-white">Recent events</h3>
          <div className="mt-2 space-y-2 text-sm text-slate-300">{(summary.events || []).slice(0, 8).map((event) => <div key={event.id}>{event.result} · {event.product_name || event.uid_hex || "-"} · {event.vertical || "-"} · {event.city || "-"}</div>)}</div>
        </Card>
      ) : null}

      {!presenterMode ? <pre className="demo-lab-log overflow-auto rounded-xl border border-white/10 bg-slate-950 p-4 text-xs text-cyan-200">{out}</pre> : null}
    </div>
  );
}
