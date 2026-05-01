"use client";

import { useMemo, useState } from "react";
import { Badge, Card, SectionHeading } from "@product/ui";
import type { AppLocale } from "@product/config";

type Vertical = "wine" | "events" | "cosmetics" | "agro";
type Stage = "idle" | "scan" | "result";
type Result = "valid" | "tampered" | "duplicate";

type Scenario = {
  title: string;
  subtitle: string;
  summary: string;
  productHint: string;
  secureHint: string;
  ntagHint: string;
  eventLabel: string;
  mapKey: "mendoza" | "cdmx" | "saopaulo" | "santafe";
  passport: string[];
};

const copy: Record<AppLocale, {
  eyebrow: string;
  title: string;
  description: string;
  trigger: string;
  reset: string;
  scanning: string;
  waiting: string;
  valid: string;
  tampered: string;
  duplicate: string;
  physical: string;
  mobile: string;
  enterprise: string;
  verticals: Record<Vertical, string>;
  timeline: string;
  buyer: string;
  owner: string;
  reseller: string;
}> = {
  "es-AR": {
    eyebrow: "Interactive product experience",
    title: "Escenarios NFC reales para reuniones comerciales",
    description: "Vino, eventos, cosmética y agro con interacción física simulada + lectura móvil + evento en feed enterprise.",
    trigger: "Activar escenario",
    reset: "Reiniciar",
    scanning: "Escaneando chip NFC...",
    waiting: "Listo para demo",
    valid: "Autenticidad validada",
    tampered: "Tamper detectado",
    duplicate: "Intento duplicado",
    physical: "Producto físico",
    mobile: "Vista mobile",
    enterprise: "Evento enterprise",
    timeline: "Timeline de lectura",
    buyer: "Comprador",
    owner: "Empresa",
    reseller: "Reseller",
    verticals: { wine: "Wine", events: "Events", cosmetics: "Cosmetics", agro: "Agro" },
  },
  "pt-BR": {
    eyebrow: "Interactive product experience",
    title: "Cenários NFC reais para reuniões comerciais",
    description: "Vinho, eventos, cosméticos e agro com interação física simulada + leitura mobile + evento enterprise.",
    trigger: "Ativar cenário",
    reset: "Reiniciar",
    scanning: "Lendo chip NFC...",
    waiting: "Pronto para demo",
    valid: "Autenticidade validada",
    tampered: "Tamper detectado",
    duplicate: "Tentativa duplicada",
    physical: "Produto físico",
    mobile: "Visão mobile",
    enterprise: "Evento enterprise",
    timeline: "Linha do tempo",
    buyer: "Comprador",
    owner: "Empresa",
    reseller: "Revendedor",
    verticals: { wine: "Wine", events: "Events", cosmetics: "Cosmetics", agro: "Agro" },
  },
  en: {
    eyebrow: "Interactive product experience",
    title: "Real NFC scenarios for enterprise demos",
    description: "Wine, events, cosmetics and agro with simulated physical interaction + mobile read + enterprise feed event.",
    trigger: "Run scenario",
    reset: "Reset",
    scanning: "Reading NFC chip...",
    waiting: "Ready for demo",
    valid: "Authenticity validated",
    tampered: "Tamper detected",
    duplicate: "Duplicate attempt",
    physical: "Physical product",
    mobile: "Mobile view",
    enterprise: "Enterprise event",
    timeline: "Read timeline",
    buyer: "Buyer",
    owner: "Owner",
    reseller: "Reseller",
    verticals: { wine: "Wine", events: "Events", cosmetics: "Cosmetics", agro: "Agro" },
  },
};

const scenarios: Record<AppLocale, Record<Vertical, Scenario>> = {
  "es-AR": {
    wine: {
      title: "Gran Reserva Malbec",
      subtitle: "Descorche con circuito de sello",
      summary: "El corcho sale, el circuito cambia estado y la app confirma autenticidad + botella abierta.",
      productHint: "Bodega / Mendoza",
      secureHint: "Bottle uncorked — Mendoza",
      ntagHint: "NTAG 424 DNA TT recomendado",
      eventLabel: "Mendoza · AR · 21:14",
      mapKey: "mendoza",
      passport: ["Varietal: Malbec", "Alcohol: 14.1%", "Barrica: 12 meses", "Servicio: 16°C"],
    },
    events: {
      title: "Festival access wristband",
      subtitle: "Tap de pulsera para check-in",
      summary: "Tap instantáneo en acceso, zona VIP y detección de reingreso duplicado.",
      productHint: "Venue / Ciudad de México",
      secureHint: "Wristband verified — VIP",
      ntagHint: "NTAG215 ideal para access low-friction",
      eventLabel: "CDMX · MX · 22:03",
      mapKey: "cdmx",
      passport: ["Zone: VIP A", "Session: Main Stage", "Status: First entry", "Upsell: Backstage pass"],
    },
    cosmetics: {
      title: "Derm Repair C+",
      subtitle: "Tapa desenroscada y sello abierto",
      summary: "Se abre el anillo de seguridad, se valida autenticidad y se muestra lote + vida útil.",
      productHint: "Retail / São Paulo",
      secureHint: "Cap opened — authenticity ok",
      ntagHint: "Secure profile para anti-grey market",
      eventLabel: "São Paulo · BR · 18:40",
      mapKey: "saopaulo",
      passport: ["Batch: COS-77", "Shelf-life: 11 meses", "Use: Noche", "Skin-safe lot: Verified"],
    },
    agro: {
      title: "Agro seed pack",
      subtitle: "Bolsa abierta con trazabilidad",
      summary: "Se corta el cierre, el chip informa lote, origen, cadena de custodia y guía de uso seguro.",
      productHint: "Campo / Santa Fe",
      secureHint: "Bag opened — chain-of-custody",
      ntagHint: "NTAG 424 TT para tamper sensible",
      eventLabel: "Santa Fe · AR · 07:26",
      mapKey: "santafe",
      passport: ["Lote: AGR-332", "Origen: Córdoba", "Dosis: 180 ml/ha", "Ficha seguridad: Disponible"],
    },
  },
  "pt-BR": {
    wine: { title: "Gran Reserva Malbec", subtitle: "Desarrolhamento com circuito", summary: "A rolha sai, o circuito muda estado e o app confirma autenticidade + garrafa aberta.", productHint: "Vinícola / Mendoza", secureHint: "Bottle uncorked — Mendoza", ntagHint: "NTAG 424 DNA TT recomendado", eventLabel: "Mendoza · AR · 21:14", mapKey: "mendoza", passport: ["Varietal: Malbec", "Álcool: 14.1%", "Barrica: 12 meses", "Serviço: 16°C"] },
    events: { title: "Pulseira de evento", subtitle: "Tap de pulseira para check-in", summary: "Tap instantâneo na entrada, zona VIP e detecção de tentativa duplicada.", productHint: "Venue / Cidade do México", secureHint: "Wristband verified — VIP", ntagHint: "NTAG215 ideal para access low-friction", eventLabel: "CDMX · MX · 22:03", mapKey: "cdmx", passport: ["Zona: VIP A", "Sessão: Main Stage", "Status: Primeiro acesso", "Upsell: Backstage"] },
    cosmetics: { title: "Derm Repair C+", subtitle: "Tampa aberta e selo rompido", summary: "Anel de segurança abre, autenticidade validada e passaporte do produto exibido.", productHint: "Retail / São Paulo", secureHint: "Cap opened — authenticity ok", ntagHint: "Perfil secure para anti-grey market", eventLabel: "São Paulo · BR · 18:40", mapKey: "saopaulo", passport: ["Batch: COS-77", "Shelf-life: 11 meses", "Uso: Noturno", "Lote seguro: Verified"] },
    agro: { title: "Pacote agro", subtitle: "Bolsa aberta com rastreabilidade", summary: "Fecho rasgado, chip informa lote, origem, cadeia de custódia e guia técnica.", productHint: "Campo / Santa Fe", secureHint: "Bag opened — chain-of-custody", ntagHint: "NTAG 424 TT para tamper sensível", eventLabel: "Santa Fe · AR · 07:26", mapKey: "santafe", passport: ["Lote: AGR-332", "Origem: Córdoba", "Dose: 180 ml/ha", "Safety sheet: Disponível"] },
  },
  en: {
    wine: { title: "Gran Reserva Malbec", subtitle: "Uncork action with tamper circuit", summary: "The cork pops, circuit state changes, and the app confirms authenticity + opened bottle.", productHint: "Winery / Mendoza", secureHint: "Bottle uncorked — Mendoza", ntagHint: "NTAG 424 DNA TT recommended", eventLabel: "Mendoza · AR · 21:14", mapKey: "mendoza", passport: ["Varietal: Malbec", "Alcohol: 14.1%", "Barrel: 12 months", "Serve: 16°C"] },
    events: { title: "Festival access wristband", subtitle: "Wristband tap for entry", summary: "Instant entry check, VIP zone info, and duplicate attempt detection.", productHint: "Venue / Mexico City", secureHint: "Wristband verified — VIP", ntagHint: "NTAG215 is ideal for low-friction access", eventLabel: "CDMX · MX · 22:03", mapKey: "cdmx", passport: ["Zone: VIP A", "Session: Main Stage", "Status: First entry", "Upsell: Backstage pass"] },
    cosmetics: { title: "Derm Repair C+", subtitle: "Cap unscrewed and seal opened", summary: "Tamper ring opens, authenticity is validated, and batch/shelf-life is shown.", productHint: "Retail / São Paulo", secureHint: "Cap opened — authenticity ok", ntagHint: "Secure profile for anti-grey market", eventLabel: "São Paulo · BR · 18:40", mapKey: "saopaulo", passport: ["Batch: COS-77", "Shelf-life: 11 months", "Usage: Night", "Skin-safe lot: Verified"] },
    agro: { title: "Agro seed pack", subtitle: "Bag opened with traceability", summary: "Bag is opened, chip reveals lot, origin, custody chain, and safety guidance.", productHint: "Field / Santa Fe", secureHint: "Bag opened — chain-of-custody", ntagHint: "NTAG 424 TT for tamper-sensitive sectors", eventLabel: "Santa Fe · AR · 07:26", mapKey: "santafe", passport: ["Lot: AGR-332", "Origin: Córdoba", "Dose: 180 ml/ha", "Safety sheet: Available"] },
  },
};

export function InteractiveDemoSection({ locale }: { locale: AppLocale }) {
  const t = copy[locale] || copy["es-AR"];
  const data = scenarios[locale] || scenarios["es-AR"];
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [stage, setStage] = useState<Stage>("idle");
  const [result, setResult] = useState<Result>("valid");
  const [timeline, setTimeline] = useState<Array<{ id: number; label: string }>>([]);

  const active = data[vertical];

  const run = () => {
    setStage("scan");
    window.setTimeout(() => {
      const next = vertical === "events" ? "duplicate" : vertical === "wine" && Math.random() > 0.66 ? "tampered" : "valid";
      setResult(next);
      setStage("result");
      setTimeline((prev) => [{ id: Date.now(), label: `${active.eventLabel} · ${next.toUpperCase()}` }, ...prev.slice(0, 5)]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nexid-scan-event", {
          detail: {
            mapKey: active.mapKey,
            vertical,
            label: active.eventLabel,
            result: next,
          },
        }));
      }
    }, 850);
  };

  const statusLabel = useMemo(() => {
    if (stage === "scan") return t.scanning;
    if (stage === "idle") return t.waiting;
    if (result === "tampered") return t.tampered;
    if (result === "duplicate") return t.duplicate;
    return t.valid;
  }, [stage, result, t]);

  return (
    <section id="demo" className="container-shell py-16">
      <SectionHeading eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(t.verticals) as Vertical[]).map((item) => (
          <button suppressHydrationWarning key={item} onClick={() => { setVertical(item); setStage("idle"); }} className={`rounded-full border px-4 py-2 text-sm transition ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>
            {t.verticals[item]}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="p-5">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{t.physical}</p>
              <div className="mt-4 grid h-64 place-items-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-200 via-slate-100 to-slate-300 text-slate-900">
                {vertical === "wine" ? <div className={`uncork-demo ${stage === "scan" ? "scanning" : ""} ${result === "tampered" ? "tampered" : ""}`} /> : null}
                {vertical === "events" ? <div className={`wristband-demo ${stage === "scan" ? "scanning" : ""}`} /> : null}
                {vertical === "cosmetics" ? <div className={`cosmetic-demo ${stage === "scan" ? "scanning" : ""} ${result === "tampered" ? "tampered" : ""}`} /> : null}
                {vertical === "agro" ? <div className={`agro-demo ${stage === "scan" ? "scanning" : ""} ${result === "tampered" ? "tampered" : ""}`} /> : null}
              </div>
              <p className="mt-3 text-xs text-slate-300">{active.summary}</p>
              <div className="mt-3 flex gap-2">
                <button suppressHydrationWarning onClick={run} className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-200">{t.trigger}</button>
                <button suppressHydrationWarning onClick={() => { setStage("idle"); setResult("valid"); }} className="rounded-lg border border-white/20 px-3 py-2 text-xs text-slate-200">{t.reset}</button>
              </div>
            </div>

            <div className="demo-phone rounded-[2rem] border-[10px] border-slate-800 bg-slate-950 p-4">
              <div className="mx-auto mb-3 h-6 w-24 rounded-b-2xl bg-black/90" />
              <div className="demo-screen rounded-2xl border border-white/10 bg-slate-900 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{t.mobile}</p>
                <p className={`mt-2 text-sm font-semibold ${result === "tampered" ? "text-rose-300" : result === "duplicate" ? "text-amber-300" : "text-emerald-300"}`}>{statusLabel}</p>
                <p className="mt-3 text-sm font-semibold text-white">{active.title}</p>
                <p className="text-xs text-slate-400">{active.subtitle}</p>
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-2 text-[11px] text-slate-200">{active.productHint}</div>
                <div className="mt-3 space-y-1 text-[11px] text-slate-300">
                  {active.passport.map((row) => <p key={row}>• {row}</p>)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                  <Badge tone={result === "tampered" ? "amber" : "green"}>{result === "tampered" ? "TAMPER" : "AUTH_OK"}</Badge>
                  <Badge tone="cyan">{vertical === "events" ? "NTAG215" : "NTAG424_TT"}</Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cyan-300">{t.enterprise}</p>
          <div className="mt-3 space-y-3 text-sm text-slate-300">
            <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">{active.secureHint}</div>
            <div className="rounded-xl border border-violet-300/20 bg-violet-500/10 p-3 text-violet-100">{active.ntagHint}</div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
              <p>{t.buyer}: {locale === "en" ? "I can verify instantly before buying." : locale === "pt-BR" ? "Posso verificar instantaneamente antes de comprar." : "Puedo verificar instantáneamente antes de comprar."}</p>
              <p className="mt-1">{t.owner}: {locale === "en" ? "I monitor openings, duplicates and regions in real time." : locale === "pt-BR" ? "Monitoro aberturas, duplicados e regiões em tempo real." : "Monitoreo aperturas, duplicados y regiones en tiempo real."}</p>
              <p className="mt-1">{t.reseller}: {locale === "en" ? "I sell encoded tags + recurring SaaS with clear ROI." : locale === "pt-BR" ? "Vendo tags codificadas + SaaS recorrente com ROI claro." : "Vendo tags codificados + SaaS recurrente con ROI claro."}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-cyan-300">{t.timeline}</p>
              <div className="mt-2 space-y-2">
                {timeline.length === 0 ? <p className="text-xs text-slate-500">—</p> : null}
                {timeline.map((ev) => <div key={ev.id} className="rounded-md border border-white/10 px-2 py-1 text-xs">{ev.label}</div>)}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </section>
  );
}
