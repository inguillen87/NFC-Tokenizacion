"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";
import type { LandingContent } from "../lib/landing-content";

type RadarCopy = LandingContent["radar"];
type Vertical = "wine" | "events" | "cosmetics" | "agro" | "pharma";
type MapKey = "mendoza" | "lujan" | "miami" | "cordoba" | "saopaulo" | "santiago" | "cdmx" | "rosario" | "matogrosso" | "bogota" | "lima";
type Point = { city: string; province: string; country: string; x: number; y: number; tz: string; key: MapKey };
type FeedEvent = { id: number; point: Point; vertical: Vertical; title: string; status: "valid" | "tamper" | "duplicate" | "opened"; at: string };

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
  iconLabel: Record<Vertical, string>;
  examples: Array<{ vertical: Vertical; point: MapKey; title: string; status: FeedEvent["status"] }>;
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
};

const routeArcs: Array<[MapKey, MapKey]> = [
  ["mendoza", "miami"],
  ["cordoba", "saopaulo"],
  ["santiago", "cdmx"],
  ["rosario", "matogrosso"],
  ["bogota", "lima"],
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
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples: [
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
    ],
  },
  "pt-BR": {
    kpiTags: "Tags ativos", kpiValidations: "Validações hoje", kpiTamper: "Alertas tamper", kpiRegions: "Regiões ativas",
    legendValid: "valid", legendTamper: "tamper", legendDuplicate: "duplicate", legendOpened: "opened",
    geoTitle: "Geo intelligence live feed",
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples: [
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
    ],
  },
  en: {
    kpiTags: "Active tags", kpiValidations: "Validations today", kpiTamper: "Tamper alerts", kpiRegions: "Regions active",
    legendValid: "valid", legendTamper: "tamper", legendDuplicate: "duplicate", legendOpened: "opened",
    geoTitle: "Geo intelligence live feed",
    iconLabel: { wine: "🍷 Wine", events: "🎟️ Events", cosmetics: "🧴 Cosmetics", agro: "🌾 Agro", pharma: "💊 Pharma" },
    examples: [
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
    ],
  },
};

function statusTone(status: FeedEvent["status"]) {
  if (status === "valid") return "text-emerald-300";
  if (status === "duplicate") return "text-amber-300";
  if (status === "tamper") return "text-rose-300";
  return "text-violet-300";
}

export function RadarSection({ radar, locale }: { radar: RadarCopy; locale: AppLocale }) {
  const txt = i18n[locale] || i18n["es-AR"];
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [scans, setScans] = useState(124580);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const seed = txt.examples.slice(0, 6).map((item, i) => ({
      id: Date.now() + i,
      point: points[item.point],
      vertical: item.vertical,
      title: item.title,
      status: item.status,
      at: new Date().toLocaleTimeString("en-GB"),
    }));
    setEvents(seed);
  }, [txt]);

  useEffect(() => {
    const timer = setInterval(() => {
      const ex = txt.examples[cursor % txt.examples.length];
      const at = new Date().toLocaleTimeString("en-GB");
      setScans((v) => v + 1);
      setEvents((prev) => [{ id: Date.now(), point: points[ex.point], vertical: ex.vertical, title: ex.title, status: ex.status, at }, ...prev.slice(0, 9)]);
      setCursor((v) => v + 1);
    }, 1400);
    return () => clearInterval(timer);
  }, [cursor, txt]);

  useEffect(() => {
    const onScenario = (event: Event) => {
      const custom = event as CustomEvent<{ mapKey?: MapKey; vertical?: Vertical; label?: string; result?: string }>;
      const key = custom.detail?.mapKey || "mendoza";
      const point = points[key];
      const result = custom.detail?.result || "valid";
      const status: FeedEvent["status"] = result === "tampered" ? "tamper" : result === "duplicate" ? "duplicate" : "valid";
      const at = new Date().toLocaleTimeString("en-GB");
      setEvents((prev) => [{ id: Date.now() + 7, point, vertical: custom.detail?.vertical || "wine", title: custom.detail?.label || "Scenario action", status, at }, ...prev.slice(0, 9)]);
      setScans((v) => v + 1);
    };
    window.addEventListener("nexid-scan-event", onScenario as EventListener);
    return () => window.removeEventListener("nexid-scan-event", onScenario as EventListener);
  }, []);

  const pulses = useMemo(() => events.slice(0, 7), [events]);

  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description} />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,.18),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(99,102,241,.18),transparent_35%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.liveLabel}</p>
            <p className="text-sm text-slate-200">{txt.geoTitle}</p>
          </div>

          <div className="relative z-10 mt-4 grid gap-2 md:grid-cols-4 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">{txt.kpiTags}: <b className="text-white">2.4M</b></div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">{txt.kpiValidations}: <b className="text-white">{scans.toLocaleString()}</b></div>
            <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-rose-200">{txt.kpiTamper}: <b>12</b></div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2 text-emerald-200">{txt.kpiRegions}: <b>11</b></div>
          </div>

          <div className="relative z-10 mt-4 h-[340px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/85">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,.45)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,.45)_1px,transparent_1px)] bg-[size:34px_34px]" />

            <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full opacity-55" aria-hidden>
              {routeArcs.map(([from, to], i) => (
                <path
                  key={`${from}-${to}`}
                  d={`M ${points[from].x * 10} ${points[from].y * 5} Q ${(points[from].x * 10 + points[to].x * 10) / 2} ${(points[from].y * 5 + points[to].y * 5) / 2 - 80} ${points[to].x * 10} ${points[to].y * 5}`}
                  fill="none"
                  stroke="rgba(34,211,238,0.35)"
                  strokeWidth="1.8"
                  strokeDasharray="6 7"
                  style={{ animation: `arcFlow 3.2s linear ${i * 0.15}s infinite` }}
                />
              ))}
            </svg>

            {pulses.map((ev) => (
              <div key={ev.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${ev.point.x}%`, top: `${ev.point.y}%` }}>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_15px_rgba(34,211,238,.9)]" />
                </span>
                <div className="mt-1 rounded-md border border-cyan-300/30 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100">{ev.point.city} · {ev.point.province}</div>
              </div>
            ))}
            <div className="absolute bottom-3 left-3 text-[11px] text-slate-400">{radar.mapCaption}</div>
          </div>

          <div className="relative z-10 mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">{txt.legendValid}</span>
            <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-200">{txt.legendTamper}</span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">{txt.legendDuplicate}</span>
            <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-200">{txt.legendOpened}</span>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.logsTitle}</p>
          <div className="mt-3 space-y-2">
            {events.map((ev) => (
              <div key={ev.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
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
