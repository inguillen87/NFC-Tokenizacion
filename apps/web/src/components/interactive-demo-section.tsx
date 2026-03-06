"use client";

import { useMemo, useState } from "react";
import { Badge, Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";

type POV = "consumer" | "enterprise";
type Vertical = "wine" | "agro" | "fashion";

type Stage = "idle" | "scan" | "result";

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  consumer: string;
  enterprise: string;
  scan: string;
  breakSeal: string;
  reset: string;
  idle: string;
  scanning: string;
  authentic: string;
  tampered: string;
}> = {
  "es-AR": {
    eyebrow: "Ecosistema interactivo",
    title: "Un sello, dos perspectivas",
    description: "Simulá lectura NFC y ruptura de precinto para ver la UX de cliente final y la consola B2B en paralelo.",
    consumer: "Cliente final (B2C)",
    enterprise: "Empresa / Inversor (B2B)",
    scan: "Simular escaneo",
    breakSeal: "Romper precinto",
    reset: "Reiniciar",
    idle: "Esperando lectura NFC",
    scanning: "Autenticando AES-CMAC...",
    authentic: "Producto auténtico",
    tampered: "Alerta: precinto roto",
  },
  "pt-BR": {
    eyebrow: "Ecossistema interativo",
    title: "Um selo, duas perspectivas",
    description: "Simule leitura NFC e violação do lacre para ver UX B2C e console B2B em paralelo.",
    consumer: "Cliente final (B2C)",
    enterprise: "Empresa / Investidor (B2B)",
    scan: "Simular leitura",
    breakSeal: "Romper lacre",
    reset: "Reiniciar",
    idle: "Aguardando leitura NFC",
    scanning: "Autenticando AES-CMAC...",
    authentic: "Produto autêntico",
    tampered: "Alerta: lacre rompido",
  },
  en: {
    eyebrow: "Interactive ecosystem",
    title: "One seal, two perspectives",
    description: "Simulate NFC reads and seal break to preview both B2C experience and B2B control console.",
    consumer: "End customer (B2C)",
    enterprise: "Enterprise / Investor (B2B)",
    scan: "Simulate scan",
    breakSeal: "Break seal",
    reset: "Reset",
    idle: "Waiting for NFC read",
    scanning: "Authenticating AES-CMAC...",
    authentic: "Authentic product",
    tampered: "Alert: seal broken",
  },
};

const verticalData: Record<Vertical, { icon: string; title: string; subtitle: string; cta: string }> = {
  wine: { icon: "🍷", title: "Gran Reserva Malbec", subtitle: "Bottle #142 / 2000", cta: "Notas de cata VIP" },
  agro: { icon: "🧪", title: "AgroTech Max", subtitle: "Lote #98234-A", cta: "Manual de aplicación" },
  fashion: { icon: "👜", title: "Signature Bag", subtitle: "Edition 2026", cta: "NFT authenticity certificate" },
};

export function InteractiveDemoSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [pov, setPov] = useState<POV>("consumer");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [sealBroken, setSealBroken] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");

  const stateLabel = useMemo(() => {
    if (stage === "scan") return t.scanning;
    if (stage === "idle") return t.idle;
    return sealBroken ? t.tampered : t.authentic;
  }, [sealBroken, stage, t]);

  const runScan = async () => {
    setStage("scan");
    await new Promise((resolve) => setTimeout(resolve, 1700));
    setStage("result");
  };

  const activeProduct = verticalData[vertical];

  return (
    <section className="container-shell py-20">
      <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,.16),transparent_46%),radial-gradient(circle_at_80%_100%,rgba(124,58,237,.14),transparent_42%)]" />
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => setPov("consumer")} className={`rounded-full px-4 py-1.5 text-xs ${pov === "consumer" ? "bg-white text-slate-950" : "border border-white/20 text-slate-300"}`}>{t.consumer}</button>
              <button onClick={() => setPov("enterprise")} className={`rounded-full px-4 py-1.5 text-xs ${pov === "enterprise" ? "bg-white text-slate-950" : "border border-white/20 text-slate-300"}`}>{t.enterprise}</button>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {(["wine", "agro", "fashion"] as Vertical[]).map((item) => (
                <button key={item} onClick={() => setVertical(item)} className={`rounded-xl border px-3 py-2 text-left text-xs ${vertical === item ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
                  <p className="text-lg">{verticalData[item].icon}</p>
                  <p className="text-slate-200">{verticalData[item].title}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">1. Producto físico</p>
                <div className="mt-4 flex h-52 items-center justify-center rounded-2xl bg-gradient-to-b from-white to-slate-200 text-slate-800 shadow-inner">
                  <div className="text-center">
                    <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full border-2 border-cyan-400 bg-white">
                      <span className="text-lg">📡</span>
                    </div>
                    <div className={`mx-auto mt-1 h-14 w-1 rounded-full transition-all ${sealBroken ? "translate-x-2 rotate-45 bg-rose-500" : "bg-cyan-400"}`} />
                    <p className="mt-3 text-sm font-semibold">{activeProduct.title}</p>
                    <p className="text-xs text-slate-600">{activeProduct.subtitle}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={runScan} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{t.scan}</button>
                  <button onClick={() => { setSealBroken(true); setStage("idle"); }} className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{t.breakSeal}</button>
                  <button onClick={() => { setSealBroken(false); setStage("idle"); }} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{t.reset}</button>
                </div>
              </div>

              <div className="rounded-[2rem] border-[10px] border-slate-800 bg-slate-900 p-4 shadow-[0_0_50px_rgba(2,6,23,.8)]">
                <div className="mx-auto mb-3 h-6 w-24 rounded-b-2xl bg-black" />
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-4">
                  {stage === "scan" ? <div className="laser-scan absolute left-0 right-0" /> : null}
                  <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300">{pov === "consumer" ? "B2C App" : "B2B Console"}</p>
                  <p className={`mt-3 text-sm font-semibold ${stage === "scan" ? "text-cyan-300" : sealBroken ? "text-rose-300" : "text-emerald-300"}`}>{stateLabel}</p>

                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs text-slate-200">{activeProduct.title}</p>
                    <p className="text-[11px] text-slate-400">{pov === "consumer" ? activeProduct.cta : "SYS_AUTH_OK · LOOP_CERRADO"}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <Badge tone={sealBroken ? "amber" : "green"}>{sealBroken ? "SEC_BREACH" : "AUTH_OK"}</Badge>
                    <Badge tone="cyan">{pov === "consumer" ? "UX_PASS" : "API_EVENT"}</Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">Live operator pulse</p>
          <div className="mt-4 space-y-3">
            {["API Throughput", "Fraud signals", "Geo risk", "Revenue stream"].map((label, index) => {
              const value = [74, 22, 41, 67][index];
              return (
                <div key={label}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800">
                    <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-xs text-violet-100">
            White-label, reseller-ready y multi-tenant desde el día 1.
          </div>
        </Card>
      </div>
    </section>
  );
}
