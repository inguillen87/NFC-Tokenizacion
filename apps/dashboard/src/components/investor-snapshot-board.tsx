"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card } from "@product/ui";

type SummaryEvent = {
  id: number;
  result: string;
  city?: string;
  country_code?: string;
  product_name?: string;
  vertical?: string;
  created_at?: string;
  lat?: number;
  lng?: number;
};

type SummaryData = {
  exists?: boolean;
  tenant?: { slug: string; name: string };
  batch?: { bid: string; status: string };
  tagCount?: number;
  crm?: { leads: number; tickets: number; orders: number };
  events?: SummaryEvent[];
};

type ShareState = "idle" | "copied" | "shared";

const snapshotCards = [
  {
    title: "Why it wins",
    body: "nexID une autenticación física, experiencia mobile, observabilidad y canal comercial en un solo SaaS.",
    tone: "cyan" as const,
  },
  {
    title: "Proof",
    body: "Demo Lab, mobile preview, ops map y audience modes convierten la narrativa en evidencia visible para ventas e inversión.",
    tone: "green" as const,
  },
  {
    title: "Scale",
    body: "Multi-tenant, reseller-ready, API-first y con packaging por plan para crecer por vertical, región o partner.",
    tone: "amber" as const,
  },
];

async function getSummary() {
  const response = await fetch("/api/internal/demo/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("summary failed");
  return (await response.json()) as SummaryData;
}

function formatTimestamp(value?: string) {
  if (!value) return "waiting for demo events";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function resultTone(result?: string) {
  if (result === "VALID") return "text-emerald-300";
  if (!result) return "text-slate-300";
  return "text-amber-300";
}

export function InvestorSnapshotBoard() {
  const [summary, setSummary] = useState<SummaryData>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>("idle");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getSummary();
        if (!active) return;
        setSummary(data);
        setLastUpdated(new Date().toISOString());
      } catch {
        if (!active) return;
        setSummary({});
      } finally {
        if (active) setLoading(false);
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

  useEffect(() => {
    if (shareState === "idle") return;
    const timer = window.setTimeout(() => setShareState("idle"), 2400);
    return () => window.clearTimeout(timer);
  }, [shareState]);

  const events = summary.events || [];
  const latest = events[0];
  const validCount = events.filter((event) => event.result === "VALID").length;
  const riskCount = events.filter((event) => event.result && event.result !== "VALID").length;
  const activeVerticals = new Set(events.map((event) => event.vertical || "wine")).size || 1;
  const activeCities = new Set(events.map((event) => `${event.city || "Unknown"}-${event.country_code || "--"}`)).size;
  const totalEvents = events.length;
  const authRate = totalEvents > 0 ? Math.round((validCount / totalEvents) * 100) : 100;
  const crmTotal = (summary.crm?.leads ?? 0) + (summary.crm?.tickets ?? 0) + (summary.crm?.orders ?? 0);

  const metrics = useMemo(
    () => [
      { label: "Auth rate", value: `${authRate}%`, detail: `${validCount} authentic vs ${riskCount} flagged` },
      { label: "Active verticals", value: String(activeVerticals), detail: "Demo state synced" },
      { label: "Geo coverage", value: String(activeCities || 1), detail: "Cities with visible proof" },
      { label: "Commercial signals", value: String(crmTotal), detail: "Leads + tickets + orders" },
    ],
    [activeCities, activeVerticals, authRate, crmTotal, riskCount, validCount],
  );

  const topSignals = useMemo(() => {
    const counts = new Map<string, number>();
    events.forEach((event) => {
      const label = `${event.city || "Unknown"}, ${event.country_code || "--"}`;
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, count]) => ({ label, count }));
  }, [events]);

  const thesisPoints = useMemo(
    () => [
      `${summary.tagCount ?? 0} tags ya preparados para activar historias comerciales o pilotos.`,
      `${activeVerticals} vertical${activeVerticals === 1 ? "" : "es"} demostrando que el core se reutiliza por industria.`,
      `${crmTotal} señales comerciales conectan demo con pipeline real y seguimiento operativo.`,
    ],
    [activeVerticals, crmTotal, summary.tagCount],
  );

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "nexID investor snapshot", url });
        setShareState("shared");
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("copied");
    } catch {
      setShareState("idle");
    }
  };

  return (
    <main className="space-y-8 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300">Investor snapshot</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Board-ready product snapshot</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Resumen ejecutivo conectado al estado actual del demo para mostrar valor, evidencia y escala en minutos.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-1 text-emerald-200">
              {loading ? "Syncing demo state…" : `Updated ${formatTimestamp(lastUpdated || undefined)}`}
            </span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-slate-300">
              {summary.tenant?.name || "Demo Bodega"} · {summary.batch?.bid || "DEMO-2026-02"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-xl border border-white/15 px-4 py-2 text-sm text-slate-200">
            Print / PDF
          </button>
          <button
            type="button"
            onClick={() => void share()}
            className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-100"
          >
            {shareState === "copied" ? "Link copied" : shareState === "shared" ? "Shared" : "Share snapshot"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold text-white">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-400">{metric.detail}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {snapshotCards.map((card) => (
          <Card key={card.title} className="p-5">
            <Badge tone={card.tone}>{card.title}</Badge>
            <p className="mt-3 text-sm text-slate-300">{card.body}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Suggested investor flow</h2>
              <p className="mt-1 text-sm text-slate-400">Secuencia corta para mostrar producto, evidencia y capacidad de expansión.</p>
            </div>
            <Badge tone="cyan">3-step narrative</Badge>
          </div>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-300">
            <li>Abrí Demo Lab y corré una historia por vertical.</li>
            <li>Mostrá mobile preview para traducir tecnología en experiencia de usuario.</li>
            <li>Cerrá con ops map y módulos del admin para probar observabilidad, integraciones y monetización.</li>
          </ol>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 print:hidden">
            <Link href="/demo-lab" className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              Open Demo Lab
            </Link>
            <Link href="/demo-lab/mobile/demobodega/demo-item-001" className="rounded-xl border border-white/15 px-4 py-3 text-sm text-slate-200">
              Open mobile preview
            </Link>
            <Link href="/analytics" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              Open analytics proof
            </Link>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Live demo state</h2>
          <div className="mt-3 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
            <p>
              Tenant: <b className="text-white">{summary.tenant?.name || "Demo Bodega"}</b>
            </p>
            <p>
              Batch: <b className="text-white">{summary.batch?.bid || "DEMO-2026-02"}</b>
            </p>
            <p>
              Tags: <b className="text-white">{summary.tagCount ?? 0}</b>
            </p>
            <p>
              CRM: <b className="text-white">{summary.crm?.leads ?? 0}</b> leads · <b className="text-white">{summary.crm?.tickets ?? 0}</b> tickets · <b className="text-white">{summary.crm?.orders ?? 0}</b> orders
            </p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-white">Latest proof point</p>
              <span className={`text-xs font-semibold ${resultTone(latest?.result)}`}>{latest?.result || "AUTH_PENDING"}</span>
            </div>
            <p className="mt-2">{latest?.product_name || "Demo product"}</p>
            <p className="mt-1 text-xs text-slate-400">
              {latest?.city || "Mendoza"}, {latest?.country_code || "AR"} · {latest?.vertical || "wine"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatTimestamp(latest?.created_at)}</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white">Investor thesis in one screen</h2>
          <div className="mt-4 space-y-3">
            {thesisPoints.map((point) => (
              <div key={point} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                {point}
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-4 text-xs text-cyan-100">
            El mensaje para board: no es solo un tag, es infraestructura comercial, evidencia operacional y software reusable por vertical.
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Live proof feed</h2>
              <p className="mt-1 text-sm text-slate-400">Señales recientes para demostrar cobertura geográfica y comportamiento del sistema.</p>
            </div>
            <Badge tone="green">{totalEvents} recent events</Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {(topSignals.length ? topSignals : [{ label: "Mendoza, AR", count: 0 }]).map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
                <p className="text-slate-400">{item.label}</p>
                <p className="mt-1 text-lg font-semibold text-white">{item.count}</p>
                <p className="text-[11px] text-slate-500">proof events</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {(events.slice(0, 5).length ? events.slice(0, 5) : [{ id: 0, result: "AUTH_PENDING" } as SummaryEvent]).map((event) => (
              <div key={event.id} className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <div>
                  <p className={`font-medium ${resultTone(event.result)}`}>{event.result || "AUTH_PENDING"}</p>
                  <p className="mt-1 text-white">{event.product_name || "Demo product"}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(event.city || "Mendoza") + ", " + (event.country_code || "AR")} · {event.vertical || "wine"}
                  </p>
                </div>
                <p className="text-xs text-slate-500">{formatTimestamp(event.created_at)}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
