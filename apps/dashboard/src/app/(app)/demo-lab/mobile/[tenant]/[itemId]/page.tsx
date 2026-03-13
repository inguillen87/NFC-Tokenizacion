"use client";

import { useEffect, useMemo, useState } from "react";
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

async function getSummary() {
  const response = await fetch("/api/internal/demo/summary", { cache: "no-store" });
  if (!response.ok) throw new Error("summary failed");
  return (await response.json()) as SummaryData;
}

export default function DemoMobileItemPage({ params }: { params: { tenant: string; itemId: string } }) {
  const { tenant, itemId } = params;
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const summary = await getSummary();
        const list = Array.isArray(summary.events) ? summary.events : [];
        setEvents(list);
      } catch {
        setEvents([]);
      }
    })();
  }, []);

  const latest = events[0];

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
      <SectionHeading eyebrow="Mobile preview" title="Producto verificado" description="Vista realista de consumidor por tenant/item" />
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{itemId}</h2>
          <Badge tone={latest?.result === "VALID" ? "green" : "cyan"}>{latest?.result || "AUTH PENDING"}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-300">Tenant: {tenant}</p>
        <p className="text-sm text-slate-300">Último evento: {latest?.city || "-"}, {latest?.country_code || "-"}</p>
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
    </main>
  );
}
