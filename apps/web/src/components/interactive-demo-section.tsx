"use client";

import { useMemo, useState } from "react";
import { Badge, Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";

type POV = "consumer" | "enterprise";
type Vertical = "wine" | "cosmetics" | "events";
type Stage = "idle" | "scan" | "result";
type ScanOutcome = "authentic" | "tampered" | "not_registered" | "replay";

type VerticalInfo = {
  icon: string;
  title: string;
  subtitle: string;
  consumerValue: string;
  enterpriseValue: string;
  why: string;
  economy: string;
};

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
  notRegistered: string;
  replay: string;
  latestLabel: string;
  physicalLabel: string;
  consumerLabel: string;
  enterpriseLabel: string;
  traceability: string;
}> = {
  "es-AR": {
    eyebrow: "Ecosistema interactivo",
    title: "Un sello, dos perspectivas con valor real",
    description: "Mostrá en vivo cómo la misma lectura NFC impacta al consumidor final, operaciones, reseller e inversores.",
    consumer: "Cliente final (B2C)",
    enterprise: "Empresa / Inversor (B2B)",
    scan: "Simular escaneo",
    breakSeal: "Romper precinto",
    reset: "Reiniciar",
    idle: "Esperando lectura NFC",
    scanning: "Autenticando AES-CMAC...",
    authentic: "Producto auténtico",
    tampered: "Alerta: precinto roto",
    notRegistered: "No registrado",
    replay: "Sospecha de clonación",
    latestLabel: "Últimos escaneos",
    physicalLabel: "1. Producto físico",
    consumerLabel: "Qué ve el cliente final",
    enterpriseLabel: "Qué ve la operación / inversor",
    traceability: "La trazabilidad convierte cada tap en data accionable: origen, lote, estado de sello y margen potencial.",
  },
  "pt-BR": {
    eyebrow: "Ecossistema interativo",
    title: "Um selo, duas perspectivas com valor real",
    description: "Mostre ao vivo como a mesma leitura NFC impacta consumidor final, operações, reseller e investidores.",
    consumer: "Cliente final (B2C)",
    enterprise: "Empresa / Investidor (B2B)",
    scan: "Simular leitura",
    breakSeal: "Romper lacre",
    reset: "Reiniciar",
    idle: "Aguardando leitura NFC",
    scanning: "Autenticando AES-CMAC...",
    authentic: "Produto autêntico",
    tampered: "Alerta: lacre rompido",
    notRegistered: "Não registrado",
    replay: "Suspeita de clonagem",
    latestLabel: "Últimas leituras",
    physicalLabel: "1. Produto físico",
    consumerLabel: "O que vê o cliente final",
    enterpriseLabel: "O que vê operação / investidor",
    traceability: "Rastreabilidade transforma cada tap em dados acionáveis: origem, lote, status do lacre e margem potencial.",
  },
  en: {
    eyebrow: "Interactive ecosystem",
    title: "One seal, two perspectives with real business value",
    description: "Show live how the same NFC read impacts end-customer UX, operations, resellers, and investors.",
    consumer: "End customer (B2C)",
    enterprise: "Enterprise / Investor (B2B)",
    scan: "Simulate scan",
    breakSeal: "Break seal",
    reset: "Reset",
    idle: "Waiting for NFC read",
    scanning: "Authenticating AES-CMAC...",
    authentic: "Authentic product",
    tampered: "Alert: seal broken",
    notRegistered: "Not registered",
    replay: "Replay suspect",
    latestLabel: "Latest scans",
    physicalLabel: "1. Physical product",
    consumerLabel: "What end customer sees",
    enterpriseLabel: "What operations / investors see",
    traceability: "Traceability converts each tap into actionable data: origin, batch, seal status, and margin potential.",
  },
};

const verticalData: Record<AppLocale, Record<Vertical, VerticalInfo>> = {
  "es-AR": {
    wine: {
      icon: "🍷",
      title: "Gran Reserva Malbec",
      subtitle: "Lote MZA-2026 / Bottle #142",
      consumerValue: "Verifica autenticidad, origen de bodega y notas de cata premium.",
      enterpriseValue: "Detecta desvíos geográficos, duplicados y activa campañas post-compra.",
      why: "Ideal para vinos premium con riesgo de falsificación y foco en exportación.",
      economy: "Mix sugerido: NTAG424 TagTamper + capa de identidad digital.",
    },
    cosmetics: {
      icon: "🧴",
      title: "Derma C+ Repair",
      subtitle: "Batch COS-77 / Control dermatológico",
      consumerValue: "Confirma lote, fecha y recomendaciones de uso seguro.",
      enterpriseValue: "Trazabilidad por canal y alertas de producto fuera de mercado.",
      why: "Protege marca, evita gray market y mejora experiencia post-venta.",
      economy: "Mix sugerido: secure para línea premium + basic para sampling.",
    },
    events: {
      icon: "🎟️",
      title: "VIP Sunset Festival",
      subtitle: "Ticket NFC / Access zone A",
      consumerValue: "Entrada rápida, antifraude y beneficios en tiempo real.",
      enterpriseValue: "Control de aforo, anti-clon y monetización de upsells en vivo.",
      why: "Para eventos y fiestas, NTAG215 suele ser la opción más económica y efectiva.",
      economy: "Costo bajo por tag + activaciones web + analytics de attendance.",
    },
  },
  "pt-BR": {
    wine: {
      icon: "🍷",
      title: "Gran Reserva Malbec",
      subtitle: "Lote MZA-2026 / Garrafa #142",
      consumerValue: "Valida autenticidade, origem da vinícola e notas premium.",
      enterpriseValue: "Detecta desvios geográficos, duplicatas e ativa campanhas pós-compra.",
      why: "Ideal para vinhos premium com risco de falsificação e foco em exportação.",
      economy: "Mix sugerido: NTAG424 TagTamper + camada de identidade digital.",
    },
    cosmetics: {
      icon: "🧴",
      title: "Derma C+ Repair",
      subtitle: "Batch COS-77 / Controle dermatológico",
      consumerValue: "Confirma lote, validade e recomendação de uso seguro.",
      enterpriseValue: "Rastreabilidade por canal e alertas de produto fora do mercado.",
      why: "Protege marca, reduz gray market e melhora pós-venda.",
      economy: "Mix sugerido: secure para premium + basic para sampling.",
    },
    events: {
      icon: "🎟️",
      title: "VIP Sunset Festival",
      subtitle: "Ticket NFC / Access zone A",
      consumerValue: "Entrada rápida, antifraude e benefícios em tempo real.",
      enterpriseValue: "Controle de lotação, anti-clone e monetização de upsell.",
      why: "Para eventos e festas, NTAG215 costuma ser a opção mais barata e eficiente.",
      economy: "Custo baixo por tag + ativações web + analytics de presença.",
    },
  },
  en: {
    wine: {
      icon: "🍷",
      title: "Gran Reserva Malbec",
      subtitle: "Batch MZA-2026 / Bottle #142",
      consumerValue: "Verifies authenticity, winery origin, and premium tasting narrative.",
      enterpriseValue: "Flags geo anomalies, duplicates, and triggers post-purchase campaigns.",
      why: "Best fit for premium wine with counterfeit risk and export exposure.",
      economy: "Recommended mix: NTAG424 TagTamper + digital identity layer.",
    },
    cosmetics: {
      icon: "🧴",
      title: "Derma C+ Repair",
      subtitle: "Batch COS-77 / Dermatology line",
      consumerValue: "Confirms batch, expiration, and safe-use guidance.",
      enterpriseValue: "Channel traceability plus out-of-market alerts.",
      why: "Protects brand equity, reduces gray market, improves CX.",
      economy: "Suggested mix: secure for premium SKUs + basic for samples.",
    },
    events: {
      icon: "🎟️",
      title: "VIP Sunset Festival",
      subtitle: "NFC ticket / Access zone A",
      consumerValue: "Fast access, anti-fraud checks, and real-time perks.",
      enterpriseValue: "Crowd control, anti-clone ticketing, live upsell monetization.",
      why: "For events and parties, NTAG215 is usually the lowest-cost, high-ROI option.",
      economy: "Low tag cost + web activations + attendance analytics.",
    },
  },
};

export function InteractiveDemoSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const [pov, setPov] = useState<POV>("consumer");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [sealBroken, setSealBroken] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [outcome, setOutcome] = useState<ScanOutcome>("authentic");
  const [scanLog, setScanLog] = useState<Array<{ id: number; status: ScanOutcome; at: string }>>([]);

  const stateLabel = useMemo(() => {
    if (stage === "scan") return t.scanning;
    if (stage === "idle") return t.idle;
    if (outcome === "not_registered") return t.notRegistered;
    if (outcome === "replay") return t.replay;
    if (outcome === "tampered") return t.tampered;
    return t.authentic;
  }, [stage, t, outcome]);

  const runScan = async () => {
    setStage("scan");
    await new Promise((resolve) => setTimeout(resolve, 1700));
    const random = Math.random();
    const next: ScanOutcome = sealBroken ? "tampered" : random > 0.86 ? "replay" : random > 0.72 ? "not_registered" : "authentic";
    setOutcome(next);
    setScanLog((prev) => [{ id: Date.now(), status: next, at: new Date().toLocaleTimeString() }, ...prev].slice(0, 4));
    setStage("result");
  };

  const activeProduct = verticalData[locale]?.[vertical] || verticalData.en[vertical];

  return (
    <section id="demo" className="container-shell py-20">
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
              {(["wine", "cosmetics", "events"] as Vertical[]).map((item) => (
                <button key={item} onClick={() => setVertical(item)} className={`rounded-xl border px-3 py-2 text-left text-xs ${vertical === item ? "border-cyan-300 bg-cyan-400/10" : "border-white/10 bg-white/5"}`}>
                  <p className="text-lg">{verticalData[locale]?.[item]?.icon || verticalData.en[item].icon}</p>
                  <p className="text-slate-200">{verticalData[locale]?.[item]?.title || verticalData.en[item].title}</p>
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{t.physicalLabel}</p>
                <div className="mt-4 flex h-56 items-center justify-center rounded-2xl bg-gradient-to-b from-white via-slate-100 to-slate-200 text-slate-800 shadow-inner">
                  {vertical === "wine" ? (
                    <div className="demo-bottle relative h-48 w-28">
                      <div className={`absolute left-[41px] top-2 h-11 w-10 rounded-t-xl border border-amber-950/40 bg-gradient-to-b from-amber-500 to-amber-800 transition-all ${sealBroken ? "-translate-y-4 rotate-12 opacity-75" : ""}`} />
                      <div className="absolute left-[37px] top-10 h-8 w-[48px] rounded-xl border border-emerald-950/35 bg-gradient-to-b from-emerald-700 to-emerald-900" />
                      <div className="absolute left-[24px] top-[62px] h-[118px] w-[78px] rounded-[38px_38px_24px_24px] border border-emerald-950/50 bg-gradient-to-b from-emerald-600 via-emerald-800 to-emerald-950" />
                      <div className="absolute left-[30px] top-[104px] w-[66px] rounded-md border border-amber-900/40 bg-amber-50/90 px-1 py-0.5 text-center text-[9px] font-semibold text-amber-900">{activeProduct.title}</div>
                      <div className="absolute left-[88px] top-[64px] grid h-10 w-10 place-items-center rounded-full border-2 border-cyan-400 bg-white text-sm shadow-[0_0_22px_rgba(34,211,238,.45)]">NFC</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto mb-2 grid h-11 w-11 place-items-center rounded-full border-2 border-cyan-400 bg-white shadow-[0_0_20px_rgba(34,211,238,.25)]">
                        <span className="text-sm font-semibold text-cyan-700">NFC</span>
                      </div>
                      <div className={`mx-auto mt-1 h-16 w-1.5 rounded-full transition-all ${sealBroken ? "translate-x-2 rotate-45 bg-rose-500" : "bg-cyan-400"}`} />
                      <p className="mt-3 text-sm font-semibold">{activeProduct.title}</p>
                      <p className="text-xs text-slate-600">{activeProduct.subtitle}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-2 text-[11px] text-cyan-200">
                  {vertical === "wine" ? (sealBroken ? "Precinto alterado: la app marca riesgo y bloquea beneficios premium." : "Tap + descorche validado: origen, lote y certificación de botella en tiempo real.") : activeProduct.consumerValue}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={runScan} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{t.scan}</button>
                  <button onClick={() => { setSealBroken(true); setStage("idle"); }} className="rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{t.breakSeal}</button>
                  <button onClick={() => { setSealBroken(false); setStage("idle"); }} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{t.reset}</button>
                </div>
              </div>

              <div className="demo-phone rounded-[2rem] border-[10px] p-4 shadow-[0_0_50px_rgba(2,6,23,.55)]">
                <div className="mx-auto mb-3 h-6 w-24 rounded-b-2xl bg-black/90" />
                <div className="demo-screen relative overflow-hidden rounded-2xl border border-white/10 p-4">
                  {stage === "scan" ? <div className="laser-scan absolute left-0 right-0" /> : null}
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{pov === "consumer" ? "B2C Verify App" : "B2B Ops Console"}</span>
                    <span className="font-mono">{vertical.toUpperCase()}-A1</span>
                  </div>
                  <p className={`mt-3 text-sm font-semibold ${stage === "scan" ? "text-cyan-300" : outcome === "tampered" ? "text-rose-300" : outcome === "not_registered" ? "text-amber-300" : outcome === "replay" ? "text-violet-300" : "text-emerald-300"}`}>{stateLabel}</p>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs font-semibold text-slate-100">{activeProduct.title}</p>
                    <p className="mt-1 text-[11px] text-slate-300">{activeProduct.subtitle}</p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                      UID: <span className="font-mono text-cyan-300">04:A9:7F:2C:91</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                      Batch: <span className="font-mono text-blue-300">MZA-2026</span>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-[11px] text-slate-200">{pov === "consumer" ? `${activeProduct.consumerValue} ${outcome === "authentic" ? "· Certificado OK" : "· Revisión sugerida"}` : activeProduct.enterpriseValue}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                      <Badge tone={outcome === "authentic" ? "green" : outcome === "replay" ? "cyan" : "amber"}>{outcome === "authentic" ? "AUTH_OK" : outcome === "tampered" ? "SEC_BREACH" : outcome === "not_registered" ? "NOT_REGISTERED" : "REPLAY_SUSPECT"}</Badge>
                      <Badge tone="cyan">{pov === "consumer" ? "UX_PASS" : "API_EVENT"}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{pov === "consumer" ? t.consumerLabel : t.enterpriseLabel}</p>
          <div className="mt-4 space-y-4 text-sm text-slate-300">
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">{activeProduct.why}</div>
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/10 p-3">{activeProduct.economy}</div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-violet-100">{t.traceability}</div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{t.latestLabel}</p>
              <div className="mt-2 space-y-1 text-xs text-slate-300">
                {scanLog.length === 0 ? <p className="text-slate-400">—</p> : null}
                {scanLog.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-md border border-white/10 px-2 py-1">
                    <span>{item.status === "authentic" ? "Authentic" : item.status === "tampered" ? "Tampered" : item.status === "not_registered" ? "Not registered" : "Replay suspect"}</span>
                    <span className="font-mono text-[11px] text-slate-400">{item.at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
