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

type PackDetail = {
  title: string;
  chip: string;
  narrative: string;
  attributes: Array<{ label: string; value: string }>;
  ctas: string[];
  antiFraud: string[];
};

const PACK_DETAILS: Record<string, PackDetail> = {
  "wine-secure": {
    title: "Wine secure · bottle passport",
    chip: "NTAG 424 DNA TT",
    narrative: "Producto premium con trazabilidad completa y detección de tamper.",
    attributes: [
      { label: "Varietal", value: "Malbec" },
      { label: "Añada", value: "2022" },
      { label: "Alcohol", value: "13.8%" },
      { label: "Barrica", value: "18 meses roble francés" },
      { label: "Región", value: "Valle de Uco, Mendoza" },
      { label: "Temperatura servicio", value: "16°C" },
      { label: "Ventana ideal", value: "2026-2032" },
    ],
    ctas: ["Ver más", "Registrar botella", "Notas de cata", "Garantía / provenance"],
    antiFraud: ["TagTamper activo", "Replay detection", "Ownership claim listo"],
  },
  "events-basic": {
    title: "Events basic · wristband access",
    chip: "NTAG215",
    narrative: "Alternativa simple al QR para evitar screenshot sharing en accesos.",
    attributes: [
      { label: "Tipo credencial", value: "Pulsera VIP" },
      { label: "Modo acceso", value: "Single use + anti passback" },
      { label: "Gate", value: "A-3" },
      { label: "Latencia target", value: "< 300ms" },
    ],
    ctas: ["Ver beneficios", "Registrar acceso", "Activar perks", "Soporte evento"],
    antiFraud: ["Más difícil de copiar que QR", "Bloqueo replay sospechoso", "Control por UID físico"],
  },
};

async function getSummary() {
  const response = await fetch("/api/internal/demo/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("summary failed");
  return (await response.json()) as SummaryData;
}

function getCommercialState(result?: string): CommercialState {
  if (result === "VALID") {
    return {
      label: "VALID",
      tone: "green",
      message: "Producto auténtico y backend consistente.",
      recommendation: "Recomendación: comprar seguro / activar ownership.",
    };
  }
  if (result === "TAMPER") {
    return {
      label: "TAMPER ALERT",
      tone: "amber",
      message: "Se detectó riesgo de manipulación o apertura sospechosa.",
      recommendation: "Recomendación: revisar lote, canal o packaging antes de vender.",
    };
  }
  if (result === "REPLAY_SUSPECT") {
    return {
      label: "REPLAY SUSPECT",
      tone: "red",
      message: "El patrón sugiere relectura sospechosa o potencial clon.",
      recommendation: "Recomendación: bloquear operación y verificar serial / procedencia.",
    };
  }
  if (result === "CLAIMED") {
    return {
      label: "OPENED",
      tone: "cyan",
      message: "El activo ya fue asociado a un titular o comprador.",
      recommendation: "Recomendación: continuar con loyalty, soporte o postventa.",
    };
  }
  if (result === "REDEEMED") {
    return {
      label: "OPENED",
      tone: "cyan",
      message: "El token ya fue canjeado o consumido en destino.",
      recommendation: "Recomendación: ofrecer next best action o recompra.",
    };
  }
  if (result === "CHECK_IN") {
    return {
      label: "VALID",
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
  const requestedUid = searchParams.get("uid");
  const demoMode = searchParams.get("demoMode") || "simulated";
  const [events, setEvents] = useState<EventItem[]>([]);
  const [ctaMessage, setCtaMessage] = useState<string>("");

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
  const uid = requestedUid || latest?.uid_hex || "N/A";
  const detail = PACK_DETAILS[pack] || PACK_DETAILS["wine-secure"];
  const commercial = getCommercialState(latest?.result);

  const timeline = useMemo(() => {
    const base = events.slice(0, 6).map((event) => ({
      label: event.result || "VALID",
      detail: `${event.product_name || event.uid_hex || itemId} · ${event.city || "-"}, ${event.country_code || "-"}`,
      when: event.created_at || "now",
    }));

    if (base.length > 0) return base;

    return [
      { label: "ISSUED", detail: `${itemId} emitido en ${tenant}`, when: "seed" },
      { label: "ACTIVE", detail: "Distribución inicial", when: "seed" },
      { label: "AUTH_PENDING", detail: "Esperando primer toque", when: "pending" },
    ];
  }, [events, itemId, tenant]);

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4">
      <SectionHeading eyebrow="Mobile preview" title="Producto verificado" description="Vista realista de consumidor por tenant/item con refresh automático cada 5s" />
      <div className="mx-auto w-full max-w-[420px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
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
        <div className="relative mb-3 h-44 overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(circle_at_30%_25%,rgba(56,189,248,.22),transparent_45%),radial-gradient(circle_at_70%_70%,rgba(16,185,129,.2),transparent_35%),#0f172a]">
          <div className="absolute inset-y-6 left-1/2 w-24 -translate-x-1/2 rounded-3xl border border-amber-200/20 bg-gradient-to-b from-amber-100/20 via-amber-300/10 to-amber-700/20 shadow-[0_18px_40px_rgba(146,64,14,.35)]" />
          <div className="absolute bottom-4 left-1/2 h-2 w-14 -translate-x-1/2 rounded-full bg-black/40 blur-sm" />
          <div className="absolute right-3 top-3 rounded-full border border-cyan-300/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-100">LIVE TAP</div>
          <div className="absolute left-3 top-3 rounded-full border border-emerald-300/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-100">SCAN PULSE</div>
        </div>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{itemId}</h2>
          <Badge tone={commercial.tone}>{commercial.label}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-300">Tenant: {tenant}</p>
        <p className="text-xs text-emerald-300">Estado sincronizado con Demo Lab y backend interno.</p>
        <p className="text-sm text-slate-300">Último evento: {latest?.city || "-"}, {latest?.country_code || "-"}</p>
        <p className="text-xs text-slate-400">UID: {uid}</p>
        <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
          {detail.ctas.map((cta) => (
            <button
              key={cta}
              type="button"
              className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-100"
              onClick={() => setCtaMessage(`CTA ejecutada: ${cta}. Este paso queda registrado como intención comercial en demo mode.`)}
            >
              {cta}
            </button>
          ))}
        </div>
        {ctaMessage ? <p className="mt-2 text-xs text-cyan-200">{ctaMessage}</p> : null}
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">{detail.title}</h3>
        <p className="mt-1 text-xs text-slate-300">{detail.narrative}</p>
        <p className="mt-2 text-xs text-cyan-200">Chip profile: {detail.chip}</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {detail.attributes.map((field) => (
            <div key={field.label} className="rounded-lg border border-white/10 bg-slate-900 p-2.5 text-xs">
              <p className="text-slate-400">{field.label}</p>
              <p className="font-semibold text-white">{field.value}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Anti-fraude / trazabilidad</h3>
        <ul className="mt-2 space-y-1 text-xs text-slate-300">
          {detail.antiFraud.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white">Payload JSON (demo)</h3>
        <pre className="mt-2 overflow-auto rounded-lg border border-white/10 bg-slate-900 p-3 text-[11px] text-cyan-100">{JSON.stringify({
          tenant,
          itemId,
          pack,
          uid,
          status: commercial.label,
          latestResult: latest?.result || "PENDING",
          attributes: Object.fromEntries(detail.attributes.map((field) => [field.label, field.value])),
        }, null, 2)}</pre>
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
          <button type="button" className="rounded-lg border border-white/20 px-3 py-2 text-white">Tokenización opcional (NFT/asset)</button>
        </div>
      </Card>
        </div>
      </div>
    </main>
  );
}
