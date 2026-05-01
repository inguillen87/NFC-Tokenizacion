"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Badge, Card } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";
import { productUrls } from "@product/config";

type Vertical = "wine" | "events" | "docs";
type Scenario = "valid" | "tamper" | "replay";

type EventItem = {
  id?: number;
  result?: string;
  product_name?: string;
  city?: string;
  country_code?: string;
  lat?: number;
  lng?: number;
  created_at?: string;
  vertical?: string;
};

type SimulateTapResponse = {
  tap?: {
    status?: string;
    product_state?: string;
    tamper_status?: string;
    risk_score?: number;
    quality_score?: number;
    tenant?: string;
    tenant_name?: string;
    city?: string;
    country?: string;
    device?: string;
    product_name?: string;
  };
  consumer_flow?: {
    passport_path?: string;
    marketplace_path?: string;
    cta?: string[];
  };
  dashboard_realtime?: {
    taps_delta?: number;
    region_delta?: string;
  };
  nfc?: {
    raw?: string;
    bid?: string | null;
  } | null;
};

async function call(path: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${path}?demo=1`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!res.ok) throw new Error("Request failed");
  return data;
}

function formatTimestamp(value?: string) {
  if (!value) return "sin eventos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function resultTone(result?: string) {
  if (result === "VALID") return "text-emerald-300";
  if (!result) return "text-slate-300";
  return "text-amber-300";
}

export function DemoPublicExperience() {
  const publicMobile = `${productUrls.web}/demo-lab/mobile/demobodega/demo-item-001?pack=wine-secure&demoMode=consumer_tap`;
  const sampleSunTapUrl = `${productUrls.api}/sun?v=1&bid=DEMO_BATCH`;
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [latest, setLatest] = useState<EventItem | null>(null);
  const [simulation, setSimulation] = useState<SimulateTapResponse | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [status, setStatus] = useState("Elegí escenario y presioná Probar escenario");
  const [loading, setLoading] = useState(true);
  const [pendingScenario, setPendingScenario] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(
    () =>
      events
        .filter((event) => typeof event.lat === "number" && typeof event.lng === "number")
        .map((event) => ({
          city: event.city || "Unknown",
          country: event.country_code || "--",
          lat: Number(event.lat),
          lng: Number(event.lng),
          scans: 1,
          risk: event.result === "VALID" ? 0 : 1,
          vertical: event.vertical,
          status: event.result,
          lastSeen: event.created_at,
        })),
    [events],
  );

  const metrics = useMemo(() => {
    const total = events.length;
    const authOk = events.filter((event) => event.result === "VALID").length;
    const risk = events.filter((event) => event.result && event.result !== "VALID").length;
    return {
      total,
      authOk,
      risk,
      authRate: total > 0 ? Math.round((authOk / total) * 100) : 100,
      wine: events.filter((event) => event.vertical === "wine").length,
      eventsVertical: events.filter((event) => event.vertical === "events").length,
      docs: events.filter((event) => event.vertical === "docs").length,
    };
  }, [events]);

  const verticalNarrative = useMemo(() => {
    if (vertical === "wine") {
      return {
        title: "Demo vino secure",
        text: "Mostrá autenticidad de botella, estado de apertura y trazabilidad por ciudad en una sola historia comercial.",
        badge: "Brand protection",
      };
    }
    if (vertical === "events") {
      return {
        title: "Demo eventos / VIP",
        text: "Mostrá check-in, control anti-duplicado y acceso en tiempo real para pulseras o credenciales.",
        badge: "Access control",
      };
    }
    return {
      title: "Demo documentos / presencia",
      text: "Mostrá identidad documental, proof-of-presence y auditoría de visitas por sitio.",
      badge: "Compliance proof",
    };
  }, [vertical]);

  async function refresh(showLoader = false) {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      const summary = await call("summary");
      const list = Array.isArray(summary?.events) ? (summary.events as EventItem[]) : [];
      setEvents(list);
      setLatest(list[0] || null);
    } catch {
      setError("No pudimos sincronizar el estado del demo. Reintentá en unos segundos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(true);
  }, []);

  async function runScenario() {
    try {
      setPendingScenario(true);
      setError(null);
      setStatus("Corriendo escenario...");
      const result = await call("simulate-tap", "POST", {
        mode: scenario,
        scenario,
        vertical,
        source: "consumer_tap",
        tenant: "demobodega",
        tenantName: "Demo Bodega",
        bid: "DEMO-2026-02",
        city: "New York",
        country: "US",
        lat: 40.7831,
        lng: -73.9712,
        device: "iPhone 15 Pro",
        productName: vertical === "events" ? "VIP Wristband" : vertical === "docs" ? "Secure Presence Credential" : "Gran Reserva Malbec",
        tapUrl: sampleSunTapUrl,
      });
      setSimulation((result || null) as SimulateTapResponse | null);
      await refresh(false);
      setStatus("Escenario aplicado. Mostrá resultado + mapa + passport.");
    } catch {
      setError("Falló la simulación del escenario. Revisá el proxy demo o reintentá.");
      setStatus("No se pudo ejecutar el escenario.");
    } finally {
      setPendingScenario(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-white">La etiqueta aporta identidad. El celular aporta contexto. nexID aporta la verdad del objeto.</p>
            <p className="mt-1 text-xs text-slate-400">No leemos “todo el chip” desde web: en navegador mostramos NDEF + contexto móvil + veredicto backend.</p>
          </div>
          <Badge tone="cyan">Consumer-ready demo</Badge>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-3 text-xs text-slate-300">Scans demo: <b>{metrics.total}</b></Card>
        <Card className="p-3 text-xs text-slate-300">AUTH rate: <b>{metrics.authRate}%</b> · Riesgo: <b>{metrics.risk}</b></Card>
        <Card className="p-3 text-xs text-slate-300">Vino: <b>{metrics.wine}</b> · Eventos: <b>{metrics.eventsVertical}</b> · Docs: <b>{metrics.docs}</b></Card>
        <Card className="p-3 text-xs text-slate-300">Última sync: <b>{loading ? "cargando" : formatTimestamp(latest?.created_at)}</b></Card>
      </div>

      <Card className="p-4 text-sm text-slate-300">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-white">{verticalNarrative.title}</h3>
            <p className="mt-1 text-xs text-slate-400">{verticalNarrative.text}</p>
          </div>
          <Badge tone="green">{verticalNarrative.badge}</Badge>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-white">1) Elegir vertical</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {(["wine", "events", "docs"] as Vertical[]).map((item) => (
                <button suppressHydrationWarning key={item} type="button" className={`rounded-lg border p-2 text-sm ${vertical === item ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-white"}`} onClick={() => setVertical(item)}>
                  {item.toUpperCase()}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold text-white">2) Elegir escenario</h3>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {([
                ["valid", "AUTH OK"],
                ["tamper", "TAMPER RISK"],
                ["replay", "DUPLICATE RISK"],
              ] as Array<[Scenario, string]>).map(([key, label]) => (
                <button suppressHydrationWarning key={key} type="button" className={`rounded-lg border p-2 text-sm ${scenario === key ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900 text-white"}`} onClick={() => setScenario(key)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button suppressHydrationWarning type="button" className="flex-1 rounded-lg border border-cyan-300/40 bg-cyan-500/10 p-3 text-sm text-cyan-100 disabled:opacity-50" onClick={() => void runScenario()} disabled={pendingScenario}>
                {pendingScenario ? "Corriendo…" : "3) Probar escenario"}
              </button>
              <button suppressHydrationWarning type="button" className="rounded-lg border border-white/10 px-3 py-3 text-xs text-slate-300" onClick={() => void refresh(true)} disabled={loading || pendingScenario}>
                Refresh
              </button>
            </div>
          </Card>

          <Card className="p-4 text-sm text-slate-300">
            <h3 className="font-semibold text-white">Resultado del toque</h3>
            <p className={`mt-2 font-medium ${resultTone(latest?.result)}`}>Estado: <b>{latest?.result || "N/A"}</b></p>
            <p className="text-xs text-slate-400">{formatTimestamp(latest?.created_at)}</p>
            {simulation?.tap ? (
              <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-slate-950/70 p-3 text-xs text-slate-200 md:grid-cols-2">
                <p>Tap status: <b>{simulation.tap.status || "N/A"}</b></p>
                <p>Product state: <b>{simulation.tap.product_state || "N/A"}</b></p>
                <p>Tamper: <b>{simulation.tap.tamper_status || "N/A"}</b></p>
                <p>Risk / Quality: <b>{simulation.tap.risk_score ?? "-"} / {simulation.tap.quality_score ?? "-"}</b></p>
                <p>Tenant: <b>{simulation.tap.tenant_name || simulation.tap.tenant || "-"}</b></p>
                <p>Device: <b>{simulation.tap.device || "-"}</b></p>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-cyan-200">Leído de etiqueta · Aportado por celular · Resuelto por nexID · Simulado para demo</p>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4 text-sm text-slate-300">
            <h3 className="font-semibold text-white">Historia / passport</h3>
            <p className="mt-2">Item: {latest?.product_name || "Demo product"}</p>
            <p>Última ciudad: {latest?.city || "-"} ({latest?.country_code || "-"})</p>
            {simulation?.nfc?.raw ? (
              <p className="mt-2 break-all text-[11px] text-slate-400">URL SUN real usada: {simulation.nfc.raw}</p>
            ) : null}
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <a href={publicMobile} target="_blank" rel="noreferrer" className="rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-white">Ver resultado en celular (público)</a>
              <Link href="/demo-lab" className="rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-white">Abrir Demo Lab pro</Link>
            </div>
            {simulation?.consumer_flow ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                <Link href={simulation.consumer_flow.passport_path || "/sun"} className="rounded-lg border border-cyan-300/40 bg-cyan-500/10 p-2 text-xs text-cyan-100">
                  Abrir passport simulado
                </Link>
                <Link href={simulation.consumer_flow.marketplace_path || "/me/marketplace?tenant=demobodega"} className="rounded-lg border border-emerald-300/40 bg-emerald-500/10 p-2 text-xs text-emerald-100">
                  Abrir marketplace tenant
                </Link>
              </div>
            ) : null}
          </Card>

          <Card className="p-4 text-sm text-slate-300">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-white">Feed reciente</h3>
                <p className="mt-1 text-xs text-slate-400">Prueba rápida para que ventas muestre evidencia sin salir del sandbox.</p>
              </div>
              <Badge tone="amber">{events.length} events</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {(events.slice(0, 4).length ? events.slice(0, 4) : [{ id: 0 } as EventItem]).map((event) => (
                <div key={event.id || `empty-${event.product_name || "demo"}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
                  <p className={`font-medium ${resultTone(event.result)}`}>{event.result || "Sin actividad todavía"}</p>
                  <p className="mt-1 text-white">{event.product_name || "Esperando primer evento demo"}</p>
                  <p className="mt-1 text-slate-400">{event.city || "-"} {event.country_code ? `(${event.country_code})` : ""} · {formatTimestamp(event.created_at)}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <DemoOpsMap points={points} selectedVertical={vertical} selectedPack={`${vertical}-public`} />

      <Card className="p-4 text-xs text-slate-300">
        <p>{status}</p>
        {simulation?.dashboard_realtime ? (
          <p className="mt-2 text-cyan-200">
            Realtime dashboard: +{simulation.dashboard_realtime.taps_delta ?? 0} tap · {simulation.dashboard_realtime.region_delta || "region N/A"}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-rose-300">{error}</p> : null}
      </Card>
    </div>
  );
}
