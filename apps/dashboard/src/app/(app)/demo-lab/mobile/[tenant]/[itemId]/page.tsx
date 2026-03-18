"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Badge, Card, SectionHeading } from "@product/ui";

type EventItem = {
  id: number;
  result?: string;
  product_name?: string;
  city?: string;
  country_code?: string;
  created_at?: string;
  uid_hex?: string;
  vertical?: string;
};

type SummaryData = { events?: EventItem[] };
type CommercialState = {
  label: string;
  tone: "green" | "amber" | "cyan" | "red";
  message: string;
  recommendation: string;
};

async function getSummary() {
  const response = await fetch("/api/internal/demo/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("summary failed");
  return (await response.json()) as SummaryData;
}

function getCommercialState(result?: string): CommercialState {
  if (result === "VALID") {
    return {
      label: "AUTH_OK",
      tone: "green",
      message: "Producto auténtico y backend consistente.",
      recommendation: "Recomendación: comprar seguro / activar ownership.",
    };
  }
  if (result === "TAMPER") {
    return {
      label: "TAMPER_RISK",
      tone: "amber",
      message: "Se detectó riesgo de manipulación o apertura sospechosa.",
      recommendation: "Recomendación: revisar lote, canal o packaging antes de vender.",
    };
  }
  if (result === "REPLAY_SUSPECT") {
    return {
      label: "DUPLICATE_RISK",
      tone: "red",
      message: "El patrón sugiere relectura sospechosa o potencial clon.",
      recommendation: "Recomendación: bloquear operación y verificar serial / procedencia.",
    };
  }
  if (result === "CLAIMED") {
    return {
      label: "OWNERSHIP_ACTIVE",
      tone: "cyan",
      message: "El activo ya fue asociado a un titular o comprador.",
      recommendation: "Recomendación: continuar con loyalty, soporte o postventa.",
    };
  }
  if (result === "REDEEMED") {
    return {
      label: "REDEEMED",
      tone: "cyan",
      message: "El token ya fue canjeado o consumido en destino.",
      recommendation: "Recomendación: ofrecer next best action o recompra.",
    };
  }
  if (result === "CHECK_IN") {
    return {
      label: "CHECK_IN_OK",
      tone: "green",
      message: "Ingreso validado correctamente en tiempo real.",
      recommendation: "Recomendación: avanzar con hospitalidad, upsell o sponsor action.",
    };
  }
  return {
    label: "AUTH_PENDING",
    tone: "cyan",
    message: "Esperando próxima interacción con backend en vivo.",
    recommendation: "Recomendación: escanear o correr un escenario desde Demo Lab.",
  };
}

export default function DemoMobileItemPage() {
  const params = useParams<{ tenant: string; itemId: string }>();
  const searchParams = useSearchParams();
  const tenant = params?.tenant || "demobodega";
  const itemId = params?.itemId || "demo-item-001";
  const pack = searchParams.get("pack") || "wine-secure";
  const demoMode = searchParams.get("demoMode") || "simulated";
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const summary = await getSummary();
        const list = Array.isArray(summary.events) ? summary.events : [];
        if (active) setEvents(list);
      } catch {
        if (active) setEvents([]);
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const latest = events[0];
  const commercial = getCommercialState(latest?.result);

  const timeline = useMemo(() => {
    const base = events.slice(0, 6).map((event) => ({
      label: event.result || "AUTH_OK",
      detail: `${event.product_name || event.uid_hex || itemId} · ${event.city || "-"}, ${event.country_code || "-"}`,
      when: event.created_at || "now",
    }));

    if (base.length > 0) return base;

    return [
      { label: "ISSUED", detail: `${itemId} emitido en ${tenant}`, when: "seed" },
      { label: "ACTIVE", detail: "Distribución inicial", when: "seed" },
      { label: "AUTH_OK", detail: "Esperando primer toque", when: "pending" },
    ];
  }, [events, itemId, tenant]);

  return (
    <main className="mx-auto max-w-md space-y-4 p-4">
      <SectionHeading eyebrow="Mobile preview" title="Producto verificado" description="Vista realista de consumidor por tenant/item con refresh automático cada 5s" />

      <Card className="sticky top-4 z-10 border border-white/10 bg-slate-950/95 p-4 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estado comercial</p>
            <h2 className="mt-1 text-xl font-semibold text-white">{commercial.label}</h2>
            <p className="mt-2 text-sm text-slate-300">{commercial.message}</p>
            <p className="mt-2 text-sm font-medium text-emerald-300">{commercial.recommendation}</p>
          </div>
          <Badge tone={commercial.tone}>{latest?.result || "PENDING"}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div className="rounded-xl border border-white/10 bg-slate-900 p-3">Pack: <b>{pack}</b></div>
          <div className="rounded-xl border border-white/10 bg-slate-900 p-3">Modo: <b>{demoMode}</b></div>
        </div>
        <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100">
          <p className="font-semibold">Lectura doble:</p>
          <p className="mt-1">Para negocio: este estado ayuda a vender confianza y activar postventa. Para ingeniería: resume el outcome que viene del backend demo/live.</p>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 h-40 rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(56,189,248,.22),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(16,185,129,.2),transparent_35%),#0f172a]" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{itemId}</h2>
          <Badge tone={commercial.tone}>{commercial.label}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-300">Tenant: {tenant}</p>
        <p className="text-xs text-emerald-300">Estado sincronizado con Demo Lab y backend interno.</p>
        <p className="text-sm text-slate-300">Último evento: {latest?.city || "-"}, {latest?.country_code || "-"}</p>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
          <button type="button" className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100">Verificar botella/pulsera</button>
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-white">Abrir passport completo</button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">How we know this</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          <li>Leído del tag: URL/NDEF + UID/serial si disponible.</li>
          <li>Aportado por teléfono: hora local, idioma y geolocalización (con permiso).</li>
          <li>Resuelto por backend nexID: autenticidad, riesgo, estado y provenance.</li>
          <li>Simulado para demo: seed data, playback comercial y tráfico sintético.</li>
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Timeline (backend-linked)</h3>
        <div className="mt-2 space-y-2 text-xs text-slate-300">
          {timeline.map((event, index) => (
            <div key={`${event.label}-${index}`} className="rounded-lg border border-white/10 bg-slate-900 p-2">
              <p className="font-semibold text-cyan-200">{event.label}</p>
              <p>{event.detail}</p>
              <p className="text-slate-400">{event.when}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 text-xs text-slate-300">
        <h3 className="text-sm font-semibold text-white">CTA comerciales</h3>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <button type="button" className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">Activar ownership</button>
          <button type="button" className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-violet-100">Registrar garantía</button>
          <button type="button" className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-100">Ver provenance</button>
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-white">Contactar soporte</button>
        </div>
      </Card>
    </main>
  );
}
