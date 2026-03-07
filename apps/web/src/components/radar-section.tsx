"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";
import type { LandingContent } from "../lib/landing-content";

type RadarCopy = LandingContent["radar"];

type Point = { city: string; province: string; country: string; x: number; y: number; tz: string };
type MapKey = "mendoza" | "saopaulo" | "santiago" | "cdmx" | "miami" | "santafe";
type Ping = { id: number; point: Point; vertical: string; detail: string; status: "ok" | "warn"; at: string };

const points: Point[] = [
  { city: "Mendoza", province: "Mendoza", country: "Argentina", x: 28, y: 74, tz: "GMT-3" },
  { city: "São Paulo", province: "SP", country: "Brazil", x: 35, y: 70, tz: "GMT-3" },
  { city: "Santiago", province: "RM", country: "Chile", x: 30, y: 65, tz: "GMT-4" },
  { city: "Mexico City", province: "CDMX", country: "Mexico", x: 16, y: 48, tz: "GMT-6" },
  { city: "Miami", province: "Florida", country: "USA", x: 22, y: 42, tz: "GMT-5" },
];

const pointByKey: Record<MapKey, Point> = {
  mendoza: points[0],
  saopaulo: points[1],
  santiago: points[2],
  cdmx: points[3],
  miami: points[4],
  santafe: { city: "Rosario", province: "Santa Fe", country: "Argentina", x: 26, y: 72, tz: "GMT-3" },
};

const verticals = ["wine", "events", "cosmetics", "agro", "pharma"];

const details: Record<AppLocale, string[]> = {
  "es-AR": ["Bottle uncorked", "Wristband tap", "Cap opened", "Bag opened", "Batch verified"],
  "pt-BR": ["Bottle uncorked", "Wristband tap", "Cap opened", "Bag opened", "Batch verified"],
  en: ["Bottle uncorked", "Wristband tap", "Cap opened", "Bag opened", "Batch verified"],
};

export function RadarSection({ radar, locale }: { radar: RadarCopy; locale: AppLocale }) {
  const [events, setEvents] = useState<Ping[]>([]);
  const [scans, setScans] = useState(124580);

  useEffect(() => {
    const timer = setInterval(() => {
      const point = points[Math.floor(Math.random() * points.length)];
      const vertical = verticals[Math.floor(Math.random() * verticals.length)];
      const warn = Math.random() > 0.84;
      const detail = details[locale][Math.floor(Math.random() * details[locale].length)];
      const now = new Date();
      const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      setScans((v) => v + 1);
      setEvents((prev) => [{ id: Date.now() + Math.floor(Math.random() * 1000), point, vertical, detail, status: warn ? "warn" : "ok", at }, ...prev.slice(0, 8)]);
    }, 1300);
    return () => clearInterval(timer);
  }, [locale]);


  useEffect(() => {
    const onScenario = (event: Event) => {
      const custom = event as CustomEvent<{ mapKey?: MapKey; vertical?: string; label?: string; result?: string }>;
      const key = custom.detail?.mapKey || "mendoza";
      const point = pointByKey[key] || pointByKey.mendoza;
      const now = new Date();
      const at = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const result = custom.detail?.result || "valid";
      setEvents((prev) => [{
        id: Date.now() + Math.floor(Math.random() * 1000),
        point,
        vertical: custom.detail?.vertical || "wine",
        detail: custom.detail?.label || "Scenario tap",
        status: result === "tampered" || result === "duplicate" ? "warn" : "ok",
        at,
      }, ...prev.slice(0, 8)]);
      setScans((v) => v + 1);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("nexid-scan-event", onScenario as EventListener);
      return () => window.removeEventListener("nexid-scan-event", onScenario as EventListener);
    }
  }, []);

  const pulses = useMemo(() => events.slice(0, 6), [events]);

  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description} />
      <div className="mt-8 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative overflow-hidden p-5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(6,182,212,.18),transparent_35%),radial-gradient(circle_at_90%_90%,rgba(99,102,241,.18),transparent_35%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.liveLabel}</p>
            <p className="text-sm text-slate-200">{radar.revenueLabel}: <span className="font-mono text-cyan-200">USD {(scans * 0.02).toFixed(2)}</span></p>
          </div>

          <div className="relative z-10 mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-3">
            <div className="grid gap-2 md:grid-cols-4 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">Scans: <b className="text-white">{scans.toLocaleString()}</b></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300">Countries: <b className="text-white">5</b></div>
              <div className="rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-2 text-emerald-200">Valid: <b>99.1%</b></div>
              <div className="rounded-lg border border-rose-300/20 bg-rose-500/10 p-2 text-rose-200">Alerts/day: <b>12</b></div>
            </div>
          </div>

          <div className="relative z-10 mt-4 h-[330px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,.45)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,.45)_1px,transparent_1px)] bg-[size:34px_34px]" />
            {pulses.map((item) => (
              <div key={item.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${item.point.x}%`, top: `${item.point.y}%` }}>
                <span className="relative flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_15px_rgba(34,211,238,.9)]" />
                </span>
                <div className="mt-1 rounded-md border border-cyan-300/30 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100">
                  {item.point.city} · {item.point.province}
                </div>
              </div>
            ))}
            <div className="absolute bottom-3 left-3 text-[11px] text-slate-400">{radar.mapCaption}</div>
          </div>

          <div className="relative z-10 mt-3 flex flex-wrap gap-2 text-[11px]">
            <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-1 text-emerald-200">valid</span>
            <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-amber-200">tamper</span>
            <span className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-cyan-200">duplicate</span>
            <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-2 py-1 text-violet-200">opened</span>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.logsTitle}</p>
            <div className="mt-3 space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{ev.point.city}, {ev.point.country}</span>
                    <span className="font-mono text-slate-400">{ev.at} · {ev.point.tz}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-cyan-300">{ev.vertical.toUpperCase()}</span>
                    <span className={ev.status === "warn" ? "text-amber-300" : "text-emerald-300"}>{ev.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.signalTitle}</p>
            <div className="mt-3 space-y-3">
              {radar.signals.map((signal, i) => (
                <div key={signal.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-300"><span>{signal.label}</span><span>{signal.value}</span></div>
                  <div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${44 + ((events.length + i * 9) % 46)}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
