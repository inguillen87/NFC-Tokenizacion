"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import type { LandingContent } from "../lib/landing-content";

type RadarCopy = LandingContent["radar"];

type Ping = { id: number; x: number; y: number; city: string; product: string };
type LogItem = { id: number; city: string; product: string; amount: string; status: "ok" | "warn" };

const points = [
  { city: "Mendoza", x: 28, y: 74 },
  { city: "São Paulo", x: 35, y: 70 },
  { city: "Miami", x: 22, y: 42 },
  { city: "New York", x: 24, y: 35 },
  { city: "London", x: 47, y: 28 },
  { city: "Paris", x: 49, y: 31 },
  { city: "Dubai", x: 64, y: 44 },
  { city: "Tokyo", x: 85, y: 36 },
];

function toPolyline(values: number[]) {
  return values.map((v, i) => `${i * (100 / (values.length - 1))},${100 - v}`).join(" ");
}

export function RadarSection({ radar }: { radar: RadarCopy }) {
  const [revenue, setRevenue] = useState(14250);
  const [tick, setTick] = useState(0);
  const [pings, setPings] = useState<Ping[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [series, setSeries] = useState<number[]>([42, 46, 55, 51, 62, 58, 66, 61, 69, 64, 71, 67]);

  const productList = useMemo(() => radar.products, [radar.products]);

  useEffect(() => {
    const int = window.setInterval(() => {
      const location = points[Math.floor(Math.random() * points.length)];
      const product = productList[Math.floor(Math.random() * productList.length)];
      const id = Date.now() + Math.floor(Math.random() * 1000);
      const warn = Math.random() > 0.78;

      setTick((prev) => prev + 1);
      setRevenue((prev) => Number((prev + (warn ? 0.01 : 0.02)).toFixed(2)));
      setPings((prev) => [...prev.slice(-11), { id, x: location.x, y: location.y, city: location.city, product }]);
      setLogs((prev) => [{ id, city: location.city, product, amount: warn ? "+$0.01" : "+$0.02", status: warn ? "warn" : "ok" }, ...prev.slice(0, 6)]);
      setSeries((prev) => [...prev.slice(1), Math.max(16, Math.min(90, prev[prev.length - 1] + (Math.random() * 16 - 8)))]);
    }, 1400);

    return () => window.clearInterval(int);
  }, [productList]);

  return (
    <section className="container-shell py-20">
      <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative overflow-hidden p-4 md:p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(14,165,233,.2),transparent_38%),radial-gradient(circle_at_85%_90%,rgba(124,58,237,.18),transparent_40%)]" />
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">{radar.liveLabel}</p>
            <p className="font-mono text-lg text-white">{radar.revenueLabel}: USD {revenue.toLocaleString()}</p>
          </div>

          <div className="relative z-10 mt-5 grid gap-4 lg:grid-cols-[1fr_0.72fr]">
            <div className="relative h-[320px] overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,.5)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
              <svg viewBox="0 0 1000 500" className="absolute inset-0 h-full w-full opacity-70" aria-hidden>
                <g fill="rgba(148,163,184,0.18)" stroke="rgba(148,163,184,0.28)" strokeWidth="1.2">
                  <path d="M103 147l36-26 52 8 24 28 40 12 22 46-22 44-61 23-34-17-28-36-40-8-32-39z" />
                  <path d="M274 299l44 11 20 24 24 14 16 52-28 56-44 12-27-23-8-53 9-45z" />
                  <path d="M402 132l65-26 109 10 82 21 70-6 58 31-8 34-66 17-33 37-81-4-58 26-45 12-88-28-33-32z" />
                  <path d="M547 294l59-15 49 14 44 32-18 59-66 16-49-24-28-48z" />
                  <path d="M728 287l69-10 67 14 39 27 2 43-51 24-72-9-56-30z" />
                  <path d="M846 128l42-22 54 9 27 22-12 27-46 13-37-9-23-22z" />
                </g>
                <g stroke="rgba(148,163,184,0.22)" strokeWidth="0.8" fill="none">
                  <path d="M150 165l72 31M140 205l80 10M300 330l45 26M453 149l49 19M518 121l13 44M627 141l-8 54M793 300l58 27M870 141l37 19" />
                </g>
              </svg>
              {pings.map((ping) => (
                <div key={ping.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${ping.x}%`, top: `${ping.y}%` }}>
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-70" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.9)]" />
                  </span>
                  <div className="mt-1 rounded-lg border border-cyan-400/30 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-100">{ping.city}</div>
                </div>
              ))}
              <div className="absolute bottom-3 left-3 text-[10px] text-slate-400">{radar.mapCaption}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-3">
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Realtime API load</p>
              <div className="mt-3 h-[164px] rounded-xl border border-white/10 bg-slate-900/70 p-2">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                  <polyline points={toPolyline(series)} fill="none" stroke="url(#lineGradient)" strokeWidth="2.2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22d3ee" />
                      <stop offset="55%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-300">p95: 142ms</div>
                <div className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-emerald-300">uptime: 99.98%</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.logsTitle}</p>
            <div className="mt-4 space-y-2 font-mono text-xs">
              {logs.length === 0 ? <p className="text-slate-500">{radar.waitingLabel}</p> : null}
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-slate-200">
                  <span>{log.city}</span>
                  <span className="text-cyan-300">{log.product}</span>
                  <span className={log.status === "warn" ? "text-amber-300" : "text-emerald-300"}>{log.amount}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{radar.signalTitle}</p>
            <div className="mt-3 space-y-3">
              {radar.signals.map((signal, index) => (
                <div key={signal.label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-300"><span>{signal.label}</span><span>{signal.value}</span></div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${Math.min(100, 28 + ((tick + index * 7) % 68))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
