"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@product/ui";
import { AlertTriangle, CheckCircle2, Fingerprint, Play, ShieldCheck, Siren, Tags } from "lucide-react";

type Props = {
  locale: "es-AR" | "pt-BR" | "en";
};

type Stage = "registered" | "activated" | "valid" | "replay" | "risk";
type Scenario = "wine" | "bracelet" | "pharma";

const stageOrder: Stage[] = ["registered", "activated", "valid", "replay", "risk"];

const stagesByLocale: Record<Props["locale"], { title: string; subtitle: string; helper: string; autoplay: string; stop: string; scenariosTitle: string; impactTitle: string; scenarios: Record<Scenario, string>; impactByScenario: Record<Scenario, Array<{ label: string; value: string }>>; actions: Array<{ id: Stage; label: string }>; cards: Record<Stage, { status: string; note: string; icon: "tags" | "shield" | "ok" | "siren" | "risk" }> }> = {
  "es-AR": {
    title: "Simulador desktop (sin celular)",
    subtitle: "Mostrá el proceso completo de una botella demo en una reunión: registro, activación, validación y alertas.",
    helper: "Cambiá de estado para que un cliente/inversor entienda cómo se mueve una unidad real a lo largo del ciclo trust.",
    autoplay: "Autoplay recorrido",
    stop: "Detener",
    scenariosTitle: "Escenario demo",
    impactTitle: "Impacto que podés contar",
    scenarios: { wine: "Bodega / botella", bracelet: "Evento / brazalete", pharma: "Farmacia / cosmética" },
    impactByScenario: {
      wine: [
        { label: "Claim comercial", value: "Origen y autenticidad por botella" },
        { label: "Riesgo controlado", value: "Anti-relleno y trazabilidad lote" },
        { label: "Qué ve ventas", value: "Historia + confianza en un tap" },
      ],
      bracelet: [
        { label: "Claim comercial", value: "Acceso verificado por pulsera" },
        { label: "Riesgo controlado", value: "Reuso / falsificación de acceso" },
        { label: "Qué ve ventas", value: "Control de aforo y experiencia premium" },
      ],
      pharma: [
        { label: "Claim comercial", value: "Producto genuino al consumidor" },
        { label: "Riesgo controlado", value: "Canal informal y copia visual" },
        { label: "Qué ve ventas", value: "Confianza en punto de venta" },
      ],
    },
    actions: [
      { id: "registered", label: "Tag registrada" },
      { id: "activated", label: "Tag activada" },
      { id: "valid", label: "Escaneo válido" },
      { id: "replay", label: "Replay sospechoso" },
      { id: "risk", label: "Riesgo / bloqueo" },
    ],
    cards: {
      registered: { status: "NOT_ACTIVE", note: "UID en manifest pero aún no habilitada para mercado.", icon: "tags" },
      activated: { status: "READY_FOR_SCAN", note: "Unidad activada, lista para primer tap físico.", icon: "shield" },
      valid: { status: "VALID", note: "SUN correcto, UID allowlisted y contador consistente.", icon: "ok" },
      replay: { status: "REPLAY_SUSPECT", note: "El contador no avanzó respecto a lectura previa.", icon: "siren" },
      risk: { status: "INVALID / NOT_REGISTERED", note: "Tag fuera de lote o payload inválido. Revisar proveedor.", icon: "risk" },
    },
  },
  "pt-BR": {
    title: "Simulador desktop (sem celular)",
    subtitle: "Mostre o fluxo completo de uma garrafa demo em reunião: registro, ativação, validação e alertas.",
    helper: "Troque o estado para que cliente/investidor veja como uma unidade real evolui no ciclo trust.",
    autoplay: "Autoplay do fluxo",
    stop: "Parar",
    scenariosTitle: "Cenário demo",
    impactTitle: "Impacto para comunicar",
    scenarios: { wine: "Vinícola / garrafa", bracelet: "Evento / pulseira", pharma: "Farmácia / cosméticos" },
    impactByScenario: {
      wine: [
        { label: "Claim comercial", value: "Origem e autenticidade por garrafa" },
        { label: "Risco controlado", value: "Anti-refill e rastreio por lote" },
        { label: "O que vendas mostra", value: "História + confiança em um tap" },
      ],
      bracelet: [
        { label: "Claim comercial", value: "Acesso verificado por pulseira" },
        { label: "Risco controlado", value: "Reuso / fraude de ingresso" },
        { label: "O que vendas mostra", value: "Controle de lotação e experiência premium" },
      ],
      pharma: [
        { label: "Claim comercial", value: "Produto genuíno ao consumidor" },
        { label: "Risco controlado", value: "Canal paralelo e cópia visual" },
        { label: "O que vendas mostra", value: "Confiança no ponto de venda" },
      ],
    },
    actions: [
      { id: "registered", label: "Tag registrada" },
      { id: "activated", label: "Tag ativada" },
      { id: "valid", label: "Scan válido" },
      { id: "replay", label: "Replay suspeito" },
      { id: "risk", label: "Risco / bloqueio" },
    ],
    cards: {
      registered: { status: "NOT_ACTIVE", note: "UID no manifest, mas ainda não liberada para mercado.", icon: "tags" },
      activated: { status: "READY_FOR_SCAN", note: "Unidade ativada e pronta para primeiro tap físico.", icon: "shield" },
      valid: { status: "VALID", note: "SUN correto, UID allowlisted e contador consistente.", icon: "ok" },
      replay: { status: "REPLAY_SUSPECT", note: "Contador não aumentou em relação à leitura anterior.", icon: "siren" },
      risk: { status: "INVALID / NOT_REGISTERED", note: "Tag fora do lote ou payload inválido. Revisar fornecedor.", icon: "risk" },
    },
  },
  en: {
    title: "Desktop simulator (no phone required)",
    subtitle: "Show the full demo bottle lifecycle in meetings: registration, activation, validation and risk alerts.",
    helper: "Switch states so clients/investors can understand how one real unit moves across the trust cycle.",
    autoplay: "Autoplay flow",
    stop: "Stop",
    scenariosTitle: "Demo scenario",
    impactTitle: "Business impact you can pitch",
    scenarios: { wine: "Winery / bottle", bracelet: "Event / wristband", pharma: "Pharma / cosmetics" },
    impactByScenario: {
      wine: [
        { label: "Commercial claim", value: "Origin + authenticity per bottle" },
        { label: "Controlled risk", value: "Anti-refill and batch traceability" },
        { label: "Sales narrative", value: "Story + trust in one tap" },
      ],
      bracelet: [
        { label: "Commercial claim", value: "Verified access per wristband" },
        { label: "Controlled risk", value: "Re-use / entry fraud" },
        { label: "Sales narrative", value: "Capacity control + premium UX" },
      ],
      pharma: [
        { label: "Commercial claim", value: "Genuine product at point of sale" },
        { label: "Controlled risk", value: "Grey market and visual counterfeits" },
        { label: "Sales narrative", value: "Consumer trust at purchase moment" },
      ],
    },
    actions: [
      { id: "registered", label: "Tag registered" },
      { id: "activated", label: "Tag activated" },
      { id: "valid", label: "Valid scan" },
      { id: "replay", label: "Replay suspect" },
      { id: "risk", label: "Risk / blocked" },
    ],
    cards: {
      registered: { status: "NOT_ACTIVE", note: "UID exists in manifest, but unit is not live yet.", icon: "tags" },
      activated: { status: "READY_FOR_SCAN", note: "Unit is activated and ready for first physical tap.", icon: "shield" },
      valid: { status: "VALID", note: "SUN is correct, UID is allowlisted and counter is healthy.", icon: "ok" },
      replay: { status: "REPLAY_SUSPECT", note: "Counter did not increase versus previous read.", icon: "siren" },
      risk: { status: "INVALID / NOT_REGISTERED", note: "Tag outside batch or payload invalid. Review supplier.", icon: "risk" },
    },
  },
};

export function DemoProcessSimulator({ locale }: Props) {
  const copy = stagesByLocale[locale];
  const [stage, setStage] = useState<Stage>("registered");
  const [scenario, setScenario] = useState<Scenario>("wine");
  const [playing, setPlaying] = useState(false);

  const current = copy.cards[stage];
  const progress = ((stageOrder.indexOf(stage) + 1) / stageOrder.length) * 100;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setStage((currentStage) => {
        const idx = stageOrder.indexOf(currentStage);
        return stageOrder[(idx + 1) % stageOrder.length];
      });
    }, 1600);
    return () => clearInterval(timer);
  }, [playing]);

  const Icon = useMemo(() => {
    if (current.icon === "tags") return Tags;
    if (current.icon === "shield") return Fingerprint;
    if (current.icon === "ok") return CheckCircle2;
    if (current.icon === "siren") return Siren;
    return AlertTriangle;
  }, [current.icon]);

  return (
    <Card className="p-6">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
        <ShieldCheck className="h-4 w-4" />
        {copy.title}
      </p>
      <h3 className="mt-3 text-lg font-semibold text-white">{copy.subtitle}</h3>
      <p className="mt-2 text-sm text-slate-300">{copy.helper}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.scenariosTitle}</span>
        {(Object.keys(copy.scenarios) as Scenario[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setScenario(item)}
            className={`rounded-full border px-3 py-1 text-xs transition ${scenario === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"}`}
          >
            {copy.scenarios[item]}
          </button>
        ))}
      </div>

      <div className="mt-3">
        <button
          type="button"
          onClick={() => setPlaying((value) => !value)}
          className="inline-flex items-center gap-2 rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100 transition hover:bg-cyan-500/20"
        >
          <Play className="h-3.5 w-3.5" />
          {playing ? copy.stop : copy.autoplay}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {copy.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => setStage(action.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${stage === action.id ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300 hover:border-cyan-300/30 hover:text-cyan-100"}`}
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="mt-4 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full bg-cyan-400/80 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <Icon className="h-4 w-4 text-cyan-300" />
          {current.status}
        </p>
        <p className="mt-2 text-sm text-slate-300">{current.note}</p>
        <p className="mt-2 text-xs text-slate-400">
          {scenario === "wine"
            ? "Narrative tip: connect this state with bottle provenance and anti-refill value."
            : scenario === "bracelet"
              ? "Narrative tip: connect this state with access rights and gate fraud prevention."
              : "Narrative tip: connect this state with product authenticity and patient confidence."}
        </p>
      </div>

      <div className="mt-4">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{copy.impactTitle}</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {copy.impactByScenario[scenario].map((item) => (
            <div key={`${scenario}-${item.label}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-cyan-200">{item.label}</p>
              <p className="mt-1 text-xs text-slate-200">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
