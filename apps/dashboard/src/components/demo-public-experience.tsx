"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@product/ui";
import { DemoOpsMap } from "./demo-ops-map";

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

async function call(path: string, method = "GET", payload?: unknown) {
  const res = await fetch(`/api/internal/demo/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await res.json().catch(() => ({ ok: false }));
  if (!res.ok) throw new Error("Request failed");
  return data;
}

export function DemoPublicExperience() {
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [scenario, setScenario] = useState<Scenario>("valid");
  const [latest, setLatest] = useState<EventItem | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [status, setStatus] = useState("Elegí escenario y presioná Probar escenario");

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
        })),
    [events]
  );

  const metrics = useMemo(() => {
    const base = {
      total: events.length,
      authOk: events.filter((event) => event.result === "VALID").length,
      risk: events.filter((event) => event.result && event.result !== "VALID").length,
      wine: events.filter((event) => event.vertical === "wine").length,
      eventsVertical: events.filter((event) => event.vertical === "events").length,
      docs: events.filter((event) => event.vertical === "docs").length,
    };
    return base;
  }, [events]);


  const verticalNarrative = useMemo(() => {
    if (vertical === "wine") {
      return {
        title: "Demo vino secure",
        text: "Mostrá autenticidad de botella, estado de apertura y trazabilidad por ciudad en una sola historia comercial.",
      };
    }
    if (vertical === "events") {
      return {
        title: "Demo eventos / VIP",
        text: "Mostrá check-in, control anti-duplicado y acceso en tiempo real para pulseras o credenciales.",
      };
    }
    return {
      title: "Demo documentos / presencia",
      text: "Mostrá identidad documental, proof-of-presence y auditoría de visitas por sitio.",
    };
  }, [vertical]);

  async function refresh() {
    const summary = await call("summary");
    const list = Array.isArray(summary?.events) ? (summary.events as EventItem[]) : [];
    setEvents(list);
    setLatest(list[0] || null);
  }

  async function runScenario() {
    setStatus("Corriendo escenario...");
    await call("simulate-tap", "POST", { mode: scenario, scenario, vertical, source: "consumer_tap" });
    await refresh();
    setStatus("Escenario aplicado. Mostrá resultado + mapa + passport.");
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">La etiqueta aporta identidad. El celular aporta contexto. nexID aporta la verdad del objeto.</p>
        <p className="mt-1 text-xs text-slate-400">No leemos “todo el chip” desde web: en navegador mostramos NDEF + contexto móvil + veredicto backend.</p>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="p-3 text-xs text-slate-300">Scans demo: <b>{metrics.total}</b></Card>
        <Card className="p-3 text-xs text-slate-300">AUTH OK: <b>{metrics.authOk}</b> · Riesgo: <b>{metrics.risk}</b></Card>
        <Card className="p-3 text-xs text-slate-300">Vino: <b>{metrics.wine}</b> · Eventos: <b>{metrics.eventsVertical}</b> · Docs: <b>{metrics.docs}</b></Card>
      </div>


      <Card className="p-4 text-sm text-slate-300">
        <h3 className="font-semibold text-white">{verticalNarrative.title}</h3>
        <p className="mt-1 text-xs text-slate-400">{verticalNarrative.text}</p>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">1) Elegir vertical</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {(["wine", "events", "docs"] as Vertical[]).map((item) => (
            <button key={item} type="button" className={`rounded-lg border p-2 text-sm ${vertical === item ? "border-cyan-300/50 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-white"}`} onClick={() => setVertical(item)}>
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
            <button key={key} type="button" className={`rounded-lg border p-2 text-sm ${scenario === key ? "border-emerald-300/50 bg-emerald-500/10 text-emerald-100" : "border-white/10 bg-slate-900 text-white"}`} onClick={() => setScenario(key)}>
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="mt-3 w-full rounded-lg border border-cyan-300/40 bg-cyan-500/10 p-3 text-sm text-cyan-100" onClick={() => void runScenario()}>
          3) Probar escenario
        </button>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card className="p-4 text-sm text-slate-300">
          <h3 className="font-semibold text-white">Resultado del toque</h3>
          <p className="mt-2">Estado: <b>{latest?.result || "N/A"}</b></p>
          <p className="text-xs text-slate-400">{latest?.created_at || "sin eventos"}</p>
          <p className="mt-2 text-xs text-cyan-200">Leído de etiqueta · Aportado por celular · Resuelto por nexID · Simulado para demo</p>
        </Card>
        <Card className="p-4 text-sm text-slate-300">
          <h3 className="font-semibold text-white">Historia / passport</h3>
          <p className="mt-2">Item: {latest?.product_name || "Demo product"}</p>
          <p>Última ciudad: {latest?.city || "-"} ({latest?.country_code || "-"})</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            <Link href="/demo-lab/mobile/demobodega/demo-item-001" className="rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-white">Ver resultado en celular</Link>
            <Link href="/demo-lab" className="rounded-lg border border-white/10 bg-slate-900 p-2 text-xs text-white">Abrir Demo Lab pro</Link>
          </div>
        </Card>
      </div>

      <DemoOpsMap points={points} />

      <Card className="p-4 text-xs text-slate-300">
        <p>{status}</p>
      </Card>
    </div>
  );
}
