"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";
import type { LandingContent } from "../lib/landing-content";

type RadarCopy = LandingContent["radar"];
type Vertical = "wine" | "events" | "cosmetics" | "agro" | "pharma";
type MapKey = "mendoza" | "lujan" | "miami" | "cordoba" | "saopaulo" | "santiago" | "cdmx" | "rosario" | "matogrosso" | "bogota" | "lima" | "santafe";
type Status = "valid" | "tamper" | "duplicate" | "opened";

type Point = { city: string; province: string; country: string; x: number; y: number; tz: string; key: MapKey };
type FeedEvent = { id: number; point: Point; vertical: Vertical; title: string; status: Status; at: string };
type Example = { vertical: Vertical; point: MapKey; title: string; status: Status };

type Copy = {
  kpiTags: string;
  kpiValidations: string;
  kpiTamper: string;
  kpiRegions: string;
  legendValid: string;
  legendTamper: string;
  legendDuplicate: string;
  legendOpened: string;
  geoTitle: string;
  hubsTitle: string;
  feedCounter: string;
  iconLabel: Record<Vertical, string>;
  examples: Example[];
};

const points: Record<MapKey, Point> = {
  mendoza: { key: "mendoza", city: "Mendoza", province: "Mendoza", country: "Argentina", x: 28, y: 74, tz: "GMT-3" },
  lujan: { key: "lujan", city: "Luján de Cuyo", province: "Mendoza", country: "Argentina", x: 29, y: 73, tz: "GMT-3" },
  miami: { key: "miami", city: "Miami", province: "Miami-Dade", country: "USA", x: 22, y: 42, tz: "GMT-5" },
  cordoba: { key: "cordoba", city: "Córdoba", province: "Córdoba", country: "Argentina", x: 25, y: 70, tz: "GMT-3" },
  saopaulo: { key: "saopaulo", city: "São Paulo", province: "São Paulo", country: "Brazil", x: 35, y: 70, tz: "GMT-3" },
  santiago: { key: "santiago", city: "Santiago", province: "Santiago Metropolitan Region", country: "Chile", x: 30, y: 65, tz: "GMT-4" },
  cdmx: { key: "cdmx", city: "Mexico City", province: "CDMX", country: "Mexico", x: 16, y: 48, tz: "GMT-6" },
  rosario: { key: "rosario", city: "Rosario", province: "Santa Fe", country: "Argentina", x: 26, y: 72, tz: "GMT-3" },
  matogrosso: { key: "matogrosso", city: "Cuiabá", province: "Mato Grosso", country: "Brazil", x: 34, y: 76, tz: "GMT-4" },
  bogota: { key: "bogota", city: "Bogotá", province: "Bogotá", country: "Colombia", x: 21, y: 56, tz: "GMT-5" },
  lima: { key: "lima", city: "Lima", province: "Lima", country: "Peru", x: 21, y: 62, tz: "GMT-5" },
  santafe: { key: "santafe", city: "Santa Fe", province: "Santa Fe", country: "Argentina", x: 27, y: 71, tz: "GMT-3" },
};

const routeArcs: Array<[MapKey, MapKey]> = [["mendoza", "miami"], ["cordoba", "saopaulo"], ["santiago", "cdmx"], ["rosario", "matogrosso"], ["bogota", "lima"], ["santafe", "miami"]];

const examples: Example[] = [
  { vertical: "wine", point: "mendoza", title: "Bottle uncorked — Mendoza, Argentina", status: "opened" },
  { vertical: "wine", point: "lujan", title: "Authenticity verified — Luján de Cuyo", status: "valid" },
  { vertical: "wine", point: "miami", title: "Export bottle scanned — Miami, USA", status: "valid" },
  { vertical: "events", point: "cordoba", title: "VIP wristband check-in — Córdoba, Argentina", status: "valid" },
  { vertical: "events", point: "saopaulo", title: "Duplicate access blocked — São Paulo, Brazil", status: "duplicate" },
  { vertical: "cosmetics", point: "santiago", title: "Seal opened — Santiago, Chile", status: "opened" },
  { vertical: "cosmetics", point: "cdmx", title: "Product passport viewed — Mexico City, Mexico", status: "valid" },
  { vertical: "agro", point: "rosario", title: "Bag opened — Rosario, Argentina", status: "opened" },
  { vertical: "agro", point: "matogrosso", title: "Lot verified — Mato Grosso, Brazil", status: "valid" },
  { vertical: "pharma", point: "bogota", title: "Package verified — Bogotá, Colombia", status: "valid" },
  { vertical: "pharma", point: "lima", title: "Chain-of-custody event — Lima, Peru", status: "tamper" },
];

const i18n: Record<AppLocale, Copy> = {
  "es-AR": {
    kpiTags: "Tags activos",
    kpiValidations: "Validaciones hoy",
    kpiTamper: "Alertas tamper",
    kpiRegions: "Regiones activas",
    legendValid: "valid",
    legendTamper: "tamper",
    legendDuplicate: "duplicate",
    legendOpened: "opened",
    geoTitle: "Geo intelligence live feed",
    hubsTitle: "Top hubs",
    feedCounter: "eventos",
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples,
  },
  "pt-BR": {
    kpiTags: "Tags ativos",
    kpiValidations: "Validações hoje",
    kpiTamper: "Alertas tamper",
    kpiRegions: "Regiões ativas",
    legendValid: "valid",
    legendTamper: "tamper",
    legendDuplicate: "duplicate",
    legendOpened: "opened",
    geoTitle: "Geo intelligence live feed",
    hubsTitle: "Top hubs",
    feedCounter: "eventos",
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples,
  },
  en: {
    kpiTags: "Active tags",
    kpiValidations: "Validations today",
    kpiTamper: "Tamper alerts",
    kpiRegions: "Active regions",
    legendValid: "valid",
    legendTamper: "tamper",
    legendDuplicate: "duplicate",
    legendOpened: "opened",
    geoTitle: "Geo intelligence live feed",
    hubsTitle: "Top hubs",
    feedCounter: "events",
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples,
  },
};

const safePoint = (key: string | undefined): Point => points[(key as MapKey)] || points.mendoza;

function statusTone(status: Status) {
  if (status === "valid") return "text-emerald-300";
  if (status === "duplicate") return "text-amber-300";
  if (status === "tamper") return "text-rose-300";
  return "text-violet-300";
}

function pulseStyles(status: Status) {
  if (status === "valid") return { ping: "bg-emerald-300", dot: "bg-emerald-100 shadow-[0_0_18px_rgba(16,185,129,.95)]", label: "border-emerald-300/40" };
  if (status === "duplicate") return { ping: "bg-amber-300", dot: "bg-amber-100 shadow-[0_0_18px_rgba(251,191,36,.95)]", label: "border-amber-300/40" };
  if (status === "tamper") return { ping: "bg-rose-300", dot: "bg-rose-100 shadow-[0_0_18px_rgba(244,63,94,.95)]", label: "border-rose-300/40" };
  return { ping: "bg-violet-300", dot: "bg-violet-100 shadow-[0_0_18px_rgba(167,139,250,.95)]", label: "border-violet-300/40" };
}

export function RadarSection({ radar, locale }: { radar: RadarCopy; locale: AppLocale }) {
  const txt = i18n[locale] || i18n["es-AR"];
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [scans, setScans] = useState(124590);

  useEffect(() => {
    const seeded = txt.examples.map((item, index) => {
      const point = safePoint(item.point);
      const at = new Date(Date.now() - index * 2300).toLocaleTimeString("en-GB");
      return { id: index + 1, point, vertical: item.vertical, title: item.title, status: item.status, at } satisfies FeedEvent;
    });
    setEvents(seeded.slice(0, 8));

    const timer = setInterval(() => {
      const next = txt.examples[Math.floor(Math.random() * txt.examples.length)];
      const point = safePoint(next.point);
      const at = new Date().toLocaleTimeString("en-GB");
      setEvents((prev) => [{ id: Date.now(), point, vertical: next.vertical, title: next.title, status: next.status, at }, ...prev.slice(0, 9)]);
      setScans((v) => v + Math.floor(Math.random() * 6) + 1);
    }, 4200);

    const onScenario = (event: Event) => {
      const custom = event as CustomEvent<{ detail?: { mapKey?: string; vertical?: Vertical; label?: string; status?: Status } }>;
      const point = safePoint(custom.detail?.mapKey);
      const status = custom.detail?.status || "valid";
      const at = new Date().toLocaleTimeString("en-GB");
      setEvents((prev) => [{ id: Date.now() + 7, point, vertical: custom.detail?.vertical || "wine", title: custom.detail?.label || "Scenario action", status, at }, ...prev.slice(0, 9)]);
      setScans((v) => v + 1);
    };

    window.addEventListener("nexid-scan-event", onScenario as EventListener);
    return () => {
      clearInterval(timer);
      window.removeEventListener("nexid-scan-event", onScenario as EventListener);
    };
  }, [txt.examples]);

  const pulses = useMemo(() => events.slice(0, 7), [events]);
  const topHubs = useMemo(() => {
    const counts = new Map<string, { city: string; count: number }>();
    events.forEach((ev) => {
      const entry = counts.get(ev.point.city) || { city: ev.point.city, count: 0 };
      entry.count += 1;
      counts.set(ev.point.city, entry);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 4);
  }, [events]);

  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description} />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr] xl:items-start">
        <Card className="relative h-fit overflow-hidden p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,.18),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(99,102,241,.18),transparent_35%)]" />
          <div className="relative z-10 flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.liveLabel}</p>
            <p className="text-sm text-slate-200">{txt.geoTitle}</p>
          </div>

          <div className="relative z-10 mt-4 grid gap-2 text-xs md:grid-cols-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">{txt.kpiTags}: <b className="text-white">2.4M</b></div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">{txt.kpiValidations}: <b className="text-white">{scans.toLocaleString()}</b></div>
            <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-rose-200">{txt.kpiTamper}: <b>12</b></div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2 text-emerald-200">{txt.kpiRegions}: <b>12</b></div>
          </div>

          <div className="relative z-10 mt-3 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-slate-400">{txt.hubsTitle}:</span>
            {topHubs.map((hub) => (
              <span key={hub.city} className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2.5 py-1 text-cyan-100">{hub.city} · {hub.count}</span>
            ))}
          </div>

          <div className="radar-map-shell relative z-10 mt-4 h-[390px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,.28)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,.28)_1px,transparent_1px)] bg-[size:32px_32px]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_50%,rgba(34,211,238,.14),transparent_48%)]" />
            <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full opacity-95" aria-hidden>
              <g fill="rgba(56,189,248,0.16)" stroke="rgba(56,189,248,0.55)" strokeWidth="1.2">
                <path d="M88 162l74-32 95 18 46 34 42 34-13 45-67 42-95 9-52-26-38-44z" />
                <path d="M228 316l69 16 39 42 26 81-43 22-58-12-31-61z" />
                <path d="M356 148l86-30 128 10 111 22 95-8 74 40-9 43-79 21-43 37-98-5-72 33-56 14-84-19-49-46z" />
                <path d="M532 309l73-17 72 20 48 41-12 56-79 23-64-28-42-49z" />
                <path d="M760 130l58-22 86 10 52 31-13 39-77 20-67-18-38-29z" />
              </g>
              {routeArcs.map(([from, to], i) => (
                <path
                  key={`${from}-${to}`}
                  d={`M ${points[from].x * 10} ${points[from].y * 5} Q ${(points[from].x * 10 + points[to].x * 10) / 2} ${(points[from].y * 5 + points[to].y * 5) / 2 - 80} ${points[to].x * 10} ${points[to].y * 5}`}
                  fill="none"
                  stroke="rgba(34,211,238,0.55)"
                  strokeWidth="2"
                  strokeDasharray="6 7"
                  style={{ animation: `arcFlow 3.2s linear ${i * 0.15}s infinite` }}
                />
              ))}
            </svg>

            {pulses.map((ev, index) => {
              const style = pulseStyles(ev.status);
              return (
                <div key={ev.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${ev.point.x}%`, top: `${ev.point.y}%` }}>
                  <span className="relative flex h-4 w-4">
                    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${style.ping} opacity-70`} />
                    <span className={`relative inline-flex h-4 w-4 rounded-full ${style.dot}`} />
                  </span>
                  {index < 4 && (
                    <div className={`mt-1 rounded-md border ${style.label} bg-slate-900/95 px-2 py-1 text-[10px] text-slate-100`}>
                      {ev.point.city}
                    </div>
                  )}
                </div>
              );
            })}
            <div className="absolute bottom-3 left-3 right-3 rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-300">{radar.mapCaption}</div>
          </div>

          <div className="relative z-10 mt-3 grid gap-2 text-[11px] md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-emerald-200">{txt.legendValid} · AUTH_OK</div>
            <div className="rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-amber-200">{txt.legendTamper} · seal/risk</div>
            <div className="rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-cyan-200">{txt.legendDuplicate} · access denied</div>
            <div className="rounded-lg border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-violet-200">{txt.legendOpened} · trace event</div>
          </div>
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.logsTitle}</p>
            <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">{events.length} {txt.feedCounter}</span>
          </div>
          <div className="mt-3 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-white/15 bg-slate-900/75 p-2 text-xs shadow-[0_6px_20px_rgba(2,6,23,.35)]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>{txt.iconLabel[ev.vertical]}</span>
                  <span className="font-mono text-slate-400">{ev.at} · {ev.point.tz}</span>
                </div>
                <p className={`mt-1 font-medium ${statusTone(ev.status)}`}>{ev.title}</p>
                <p className="mt-1 text-slate-400">{ev.point.city}, {ev.point.province}, {ev.point.country}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
