"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, SectionHeading } from "@product/ui";
import type { LandingContent } from "../lib/landing-content";

type RadarCopy = LandingContent["radar"];

type Ping = { id: number; x: number; y: number; city: string; product: string };

type LogItem = { id: number; city: string; product: string; amount: string };

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

export function RadarSection({ radar }: { radar: RadarCopy }) {
  const [revenue, setRevenue] = useState(14250);
  const [tick, setTick] = useState(0);
  const [pings, setPings] = useState<Ping[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const productList = useMemo(() => radar.products, [radar.products]);

  useEffect(() => {
    const int = window.setInterval(() => {
      const location = points[Math.floor(Math.random() * points.length)];
      const product = productList[Math.floor(Math.random() * productList.length)];
      const id = Date.now() + Math.floor(Math.random() * 1000);

      setTick((prev) => prev + 1);
      setRevenue((prev) => Number((prev + 0.02).toFixed(2)));
      setPings((prev) => [...prev.slice(-9), { id, x: location.x, y: location.y, city: location.city, product }]);
      setLogs((prev) => [{ id, city: location.city, product, amount: "+$0.02" }, ...prev.slice(0, 6)]);
    }, 1500);

    return () => window.clearInterval(int);
  }, [productList]);

  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={radar.eyebrow} title={radar.title} description={radar.description} />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <Card className="relative overflow-hidden p-4 md:p-6">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(30,41,59,.55)_1px,transparent_1px),linear-gradient(to_bottom,rgba(30,41,59,.55)_1px,transparent_1px)] bg-[size:36px_36px] opacity-40" />
          <div className="relative z-10 flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">{radar.liveLabel}</p>
            <p className="font-mono text-lg text-white">{radar.revenueLabel}: USD {revenue.toLocaleString()}</p>
          </div>

          <div className="relative z-10 mt-5 h-[340px] rounded-2xl border border-white/10 bg-slate-950/70">
            {pings.map((ping) => (
              <div key={ping.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${ping.x}%`, top: `${ping.y}%` }}>
                <div className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,.9)] animate-ping" />
                <div className="mt-1 rounded-lg border border-cyan-400/40 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-200">{ping.city} · {ping.product}</div>
              </div>
            ))}
            <div className="absolute bottom-3 left-3 text-[10px] text-slate-400">{radar.mapCaption}</div>
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
                  <span>{log.amount}</span>
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
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${Math.min(100, 25 + ((tick + index * 7) % 65))}%` }} />
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
