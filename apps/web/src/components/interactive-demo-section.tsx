"use client";

import { useMemo, useState } from "react";
import { Badge, Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";

type POV = "consumer" | "enterprise";
type Vertical = "wine" | "agro" | "fashion";

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  consumer: string;
  enterprise: string;
  scan: string;
  breakSeal: string;
  reset: string;
  ok: string;
  breached: string;
  waiting: string;
}> = {
  "es-AR": {
    eyebrow: "Demo interactiva",
    title: "Un sello, dos perspectivas",
    description: "Alterná entre vista consumidor (B2C) y empresa (B2B). Simulá escaneo NFC y rotura de precinto para ver cómo cambia el estado.",
    consumer: "Cliente final",
    enterprise: "Empresa / Inversor",
    scan: "Simular escaneo",
    breakSeal: "Romper precinto",
    reset: "Reiniciar",
    ok: "Producto auténtico",
    breached: "Precinto roto / token consumido",
    waiting: "Esperando lectura NFC…",
  },
  "pt-BR": {
    eyebrow: "Demo interativa",
    title: "Um selo, duas perspectivas",
    description: "Alterne entre visão consumidor (B2C) e empresa (B2B). Simule leitura NFC e violação para ver mudança de estado.",
    consumer: "Cliente final",
    enterprise: "Empresa / Investidor",
    scan: "Simular leitura",
    breakSeal: "Romper selo",
    reset: "Reiniciar",
    ok: "Produto autêntico",
    breached: "Selo rompido / token consumido",
    waiting: "Aguardando leitura NFC…",
  },
  en: {
    eyebrow: "Interactive demo",
    title: "One seal, two perspectives",
    description: "Switch between consumer (B2C) and enterprise (B2B) views. Simulate NFC scan and seal break to visualize outcomes.",
    consumer: "End customer",
    enterprise: "Enterprise / Investor",
    scan: "Simulate scan",
    breakSeal: "Break seal",
    reset: "Reset",
    ok: "Authentic product",
    breached: "Seal broken / token consumed",
    waiting: "Waiting for NFC read…",
  },
};

const verticalData: Record<Vertical, { name: string; enterprise: string; icon: string }> = {
  wine: { name: "Gran Reserva", enterprise: "Wine export lane", icon: "🍷" },
  agro: { name: "AgroTech Max", enterprise: "Agro distributor network", icon: "🧪" },
  fashion: { name: "Signature Bag", enterprise: "Luxury retail network", icon: "👜" },
};

export function InteractiveDemoSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [pov, setPov] = useState<POV>("consumer");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [sealBroken, setSealBroken] = useState(false);
  const [scanning, setScanning] = useState(false);

  const status = useMemo(() => {
    if (scanning) return t.waiting;
    return sealBroken ? t.breached : t.ok;
  }, [scanning, sealBroken, t]);

  const tone = scanning ? "text-cyan-300" : sealBroken ? "text-rose-300" : "text-emerald-300";

  const runScan = async () => {
    setScanning(true);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setScanning(false);
  };

  return (
    <section className="container-shell py-16">
      <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="p-6">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setPov("consumer")} className={`rounded-full px-4 py-1 text-xs ${pov === "consumer" ? "bg-white text-slate-950" : "border border-white/15 text-slate-300"}`}>{t.consumer}</button>
            <button onClick={() => setPov("enterprise")} className={`rounded-full px-4 py-1 text-xs ${pov === "enterprise" ? "bg-white text-slate-950" : "border border-white/15 text-slate-300"}`}>{t.enterprise}</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {(["wine", "agro", "fashion"] as Vertical[]).map((item) => (
              <button key={item} onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1 ${vertical === item ? "border-cyan-300 bg-cyan-400/10 text-cyan-200" : "border-white/10 text-slate-300"}`}>
                {verticalData[item].icon} {verticalData[item].name}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">NFC Tag</p>
              <div className="mt-4 flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full ${sealBroken ? "bg-rose-500/80" : "bg-cyan-400/80"} ${scanning ? "animate-pulse" : ""}`} />
                <div className={`h-14 w-1 rounded-full transition-transform ${sealBroken ? "translate-x-2 rotate-45 bg-rose-500" : "bg-cyan-300"}`} />
              </div>
              <div className="mt-6 flex gap-2">
                <button onClick={runScan} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{t.scan}</button>
                <button onClick={() => setSealBroken(true)} className="rounded-lg border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{t.breakSeal}</button>
                <button onClick={() => { setSealBroken(false); setScanning(false); }} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{t.reset}</button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{pov === "consumer" ? t.consumer : t.enterprise}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <p className={`text-sm font-semibold ${tone}`}>{status}</p>
                <p className="mt-2 text-xs text-slate-300">{verticalData[vertical].name}</p>
                <p className="mt-1 text-xs text-slate-500">{pov === "consumer" ? "Tap & verify" : verticalData[vertical].enterprise}</p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <Badge tone={sealBroken ? "amber" : "green"}>{sealBroken ? "ALERT" : "AUTH_OK"}</Badge>
                <Badge tone="cyan">{pov === "enterprise" ? "API_LOG" : "UX_PASS"}</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Live KPI stream</p>
          <div className="mt-4 space-y-3">
            {[72, 58, 81, 64].map((value, index) => (
              <div key={index}>
                <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                  <span>{["Auth", "Geo", "Tamper", "Revenue"][index]}</span>
                  <span>{value}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800">
                  <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}
