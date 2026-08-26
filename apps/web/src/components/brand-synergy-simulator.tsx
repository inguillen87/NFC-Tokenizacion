"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ChevronRight,
  Coins,
  DatabaseZap,
  Handshake,
  LockKeyhole,
  Navigation,
  Network,
  PackageCheck,
  Pill,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sprout,
  Zap,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  industry: string;
  icon: React.ReactNode;
  activeBg: string;
  activeBorder: string;
  scannedProduct: string;
  scannedBatch: string;
  partnerBrand: string;
  partnerBenefit: string;
  partnerBenefitDesc: string;
  feeText: string;
  crmSignal: string;
  policyGate: string;
  businessResult: string;
  proofMode: string;
}

type MobilePane = "business" | "activation";

export function BrandSynergySimulator({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";

  const copy = {
    badge: isEn
      ? "FROM PRODUCT TO NEXT ACTION"
      : isBr
        ? "DO PRODUTO À PRÓXIMA AÇÃO"
        : "DEL PRODUCTO A LA PRÓXIMA ACCIÓN",
    title: isEn
      ? "Products that verify, learn and trigger business."
      : isBr
        ? "Produtos que informam, orientam e mantêm a relação ativa."
        : "Productos que informan, orientan y mantienen activa la relación.",
    body: isEn
      ? "A tap is not just a certificate. nexID can validate NFC/SUN message evidence, apply consent and policy, and route an eligible commercial action without exposing private customer data."
      : isBr
        ? "Cada consulta pode mostrar informações aprovadas, aplicar regras definidas e habilitar uma ação útil sem expor dados pessoais."
        : "Cada consulta puede mostrar información aprobada, aplicar reglas definidas y habilitar una acción útil sin exponer datos personales.",
    flow: isEn
      ? ["Product", "Tap", "Policy", "Reward"]
      : isBr
        ? ["Produto", "Consulta", "Regras", "Próximo passo"]
        : ["Producto", "Consulta", "Reglas", "Próximo paso"],
    select: isEn ? "Select scenario" : isBr ? "Selecionar cenario" : "Seleccionar escenario",
    portal: isEn ? "View product experience" : isBr ? "Ver experiência do produto" : "Ver experiencia del producto",
    lab: isEn ? "Open demonstrations" : isBr ? "Abrir demonstrações" : "Abrir demostraciones",
    terminalTitle: isEn ? "Guided journey" : isBr ? "Jornada guiada" : "Recorrido guiado",
    channel: isEn ? "Hypothetical scenario" : isBr ? "Cenario hipotetico" : "Escenario hipotetico",
    physicalTap: isEn ? "1 - Product consulted" : isBr ? "1 - Produto consultado" : "1 - Producto consultado",
    authenticity: isEn ? "2 - Information and controls reviewed" : isBr ? "2 - Informações e controles revisados" : "2 - Información y controles revisados",
    query: isEn ? "3 - Available rules reviewed" : isBr ? "3 - Regras disponíveis revisadas" : "3 - Reglas disponibles revisadas",
    voucher: isEn ? "4 - Action unlocked" : isBr ? "4 - Acao habilitada" : "4 - Accion habilitada",
    verified: isEn
      ? "Demo check: SUN response + configured policy"
      : isBr
        ? "Resultado de demonstração conforme as regras configuradas"
        : "Resultado de demostración según las reglas configuradas",
    matching: isEn
      ? "Evaluating a configurable offer under demo rules..."
      : isBr
        ? "Revisando a próxima ação disponível neste exemplo..."
        : "Revisando la próxima acción disponible en este ejemplo...",
    category: isEn ? "Category" : isBr ? "Categoria" : "Categoría",
    boardTitle: isEn ? "Illustrative activation" : isBr ? "Ativação ilustrativa" : "Activación ilustrativa",
    boardSubtitle: isEn
      ? "What a team could operate after an eligible NFC event."
      : isBr
        ? "O que uma equipe poderia oferecer após uma consulta válida."
        : "Lo que un equipo podría ofrecer después de una consulta válida.",
    hypothesisBadge: isEn ? "HYPOTHETICAL SCENARIO" : isBr ? "CENARIO HIPOTETICO" : "ESCENARIO HIPOTETICO",
    hypothesisNote: isEn
      ? "Generic brands, benefits and outcomes illustrate a configurable workflow. They are not customers, partners or measured performance."
      : isBr
        ? "Marcas, benefícios e resultados genéricos ilustram um percurso configurável. Não são clientes, parceiros nem resultados medidos."
        : "Marcas, beneficios y resultados genéricos ilustran un recorrido configurable. No son clientes, socios ni resultados medidos.",
    signalLabel: isEn ? "Team signal" : isBr ? "Sinal para a equipe" : "Señal para el equipo",
    policyLabel: isEn ? "Applied rule" : isBr ? "Regra aplicada" : "Regla aplicada",
    resultLabel: isEn ? "Business result" : isBr ? "Resultado de negocio" : "Resultado comercial",
    proofLabel: isEn ? "Public proof" : isBr ? "Prova publica" : "Prueba publica",
    proofVerifiedTitle: isEn ? "Observed information" : isBr ? "Informação observada" : "Información observada",
    proofVerifiedBody: isEn ? "Product message and rules" : isBr ? "Mensagem e regras do produto" : "Mensaje y reglas del producto",
    proofPrivateTitle: isEn ? "Private" : isBr ? "Privado" : "Privado",
    proofPrivateBody: isEn
      ? "Consent and PII stay inside nexID"
      : isBr
        ? "Os dados pessoais permanecem protegidos"
        : "Los datos personales quedan protegidos",
    proofActionTitle: isEn ? "Actionable" : isBr ? "Acionavel" : "Accionable",
    proofActionBody: isEn
      ? "CRM signal, voucher or claim"
      : isBr
        ? "Aviso, benefício ou consulta"
        : "Aviso, beneficio o consulta",
    metricMatchLabel: isEn ? "Scenario basis" : isBr ? "Base do cenario" : "Base del escenario",
    metricMatchValue: isEn ? "Buyer assumption" : isBr ? "Premissa do comprador" : "Supuesto del comprador",
    metricRiskLabel: isEn ? "Risk model" : isBr ? "Modelo de risco" : "Modelo de riesgo",
    metricRiskValue: isEn ? "To validate" : isBr ? "A validar" : "A validar",
    metricDataLabel: isEn ? "Data" : isBr ? "Dados" : "Datos",
    privateDataLabel: isEn ? "private" : isBr ? "privado" : "privado",
    illustrativeLabel: isEn ? "Illustrative" : isBr ? "Ilustrativo" : "Ilustrativo",
    mobileViewLabel: isEn ? "Simulator view" : isBr ? "Vista do simulador" : "Vista del simulador",
    businessView: isEn ? "Decision" : isBr ? "Decisão" : "Decisión",
    activationView: isEn ? "Activation" : isBr ? "Ativação" : "Activación",
    privacy: isEn
      ? "Public proof stays hash-only. Customer identity, route detail and contracts remain private inside nexID."
      : isBr
        ? "A evidência pública mostra apenas o necessário. Identidade, percurso e acordos permanecem privados na nexID."
        : "La evidencia pública muestra únicamente lo necesario. La identidad, el recorrido y los acuerdos permanecen privados en nexID.",
  };

  const scenarios = useMemo<Scenario[]>(
    () => [
      {
        id: "agro-field",
        name: isEn ? "Seeds + field support" : isBr ? "Sementes + suporte no campo" : "Semillas + asistencia en campo",
        industry: isEn ? "Agriculture and inputs" : isBr ? "Agro e insumos" : "Agro e insumos",
        icon: <Sprout className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-emerald-600 to-teal-500",
        activeBorder: "border-emerald-500",
        scannedProduct: isEn ? "Seed batch demonstration" : isBr ? "Lote de demonstração de sementes" : "Lote de semillas de demostración",
        scannedBatch: "DEMO-AGRO-2026-001",
        partnerBrand: isEn ? "Authorized technical team" : isBr ? "Equipe técnica autorizada" : "Equipo técnico autorizado",
        partnerBenefit: isEn ? "Batch guidance and support" : isBr ? "Orientação e suporte do lote" : "Información y asistencia del lote",
        partnerBenefitDesc: isEn
          ? "Shows approved information and the available support path."
          : isBr
            ? "Mostra informações aprovadas e o caminho de suporte disponível."
            : "Muestra información aprobada y el camino de asistencia disponible.",
        feeText: isEn ? "Batch + use rules" : isBr ? "Lote + regras de uso" : "Lote + reglas de uso",
        crmSignal: isEn ? "Batch query in the field" : isBr ? "Consulta do lote no campo" : "Consulta del lote en campo",
        policyGate: isEn ? "Enabled batch + current information" : isBr ? "Lote habilitado + informação vigente" : "Lote habilitado + información vigente",
        businessResult: isEn ? "Information and support available" : isBr ? "Informação e suporte disponíveis" : "Información y asistencia disponibles",
        proofMode: isEn ? "Query record with protected data" : isBr ? "Registro da consulta com dados protegidos" : "Registro de consulta con datos protegidos",
      },
      {
        id: "pharma-information",
        name: isEn ? "Medicines + approved information" : isBr ? "Medicamentos + informação aprovada" : "Medicamentos + información aprobada",
        industry: isEn ? "Pharmaceutical and health" : isBr ? "Medicamentos e saúde" : "Medicamentos y salud",
        icon: <Pill className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-sky-600 to-cyan-500",
        activeBorder: "border-sky-500",
        scannedProduct: isEn ? "Identified package demonstration" : isBr ? "Embalagem identificada de demonstração" : "Envase identificado de demostración",
        scannedBatch: "DEMO-SALUD-2026-001",
        partnerBrand: isEn ? "Authorized information channel" : isBr ? "Canal de informação autorizado" : "Canal de información autorizado",
        partnerBenefit: isEn ? "Approved information and next steps" : isBr ? "Informação aprovada e próximos passos" : "Información aprobada y próximos pasos",
        partnerBenefitDesc: isEn
          ? "Shows batch information and the action defined for that product."
          : isBr
            ? "Mostra informações do lote e a ação definida para esse produto."
            : "Muestra información del lote y la acción definida para ese producto.",
        feeText: isEn ? "Package + approved rules" : isBr ? "Embalagem + regras aprovadas" : "Envase + reglas aprobadas",
        crmSignal: isEn ? "Package query recorded" : isBr ? "Consulta da embalagem registrada" : "Consulta del envase registrada",
        policyGate: isEn ? "Current batch + approved information" : isBr ? "Lote vigente + informação aprovada" : "Lote vigente + información aprobada",
        businessResult: isEn ? "Clear information and guided support" : isBr ? "Informação clara e suporte orientado" : "Información clara y asistencia guiada",
        proofMode: isEn ? "Query result with defined limits" : isBr ? "Resultado da consulta com limites definidos" : "Resultado de consulta con límites definidos",
      },
      {
        id: "sneakers-club",
        name: isEn ? "Fashion + after-sales" : isBr ? "Moda + pós-venda" : "Moda + postventa",
        industry: isEn ? "Fashion and premium experiences" : isBr ? "Moda e experiências premium" : "Moda y experiencias premium",
        icon: <Sparkles className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-yellow-500 to-amber-600",
        activeBorder: "border-yellow-500",
        scannedProduct: isEn ? "Limited-edition product demo" : isBr ? "Produto demo de edicao limitada" : "Producto demo de edicion limitada",
        scannedBatch: "DEMO-LUXURY-2026-001",
        partnerBrand: isEn ? "Illustrative premium club" : isBr ? "Clube premium ilustrativo" : "Club premium ilustrativo",
        partnerBenefit: isEn ? "Configurable access benefit" : isBr ? "Benefício de acesso configurável" : "Beneficio de acceso configurable",
        partnerBenefitDesc: isEn
          ? "Verified ownership acts as a private membership signal."
          : isBr
            ? "A titularidade verificada atua como sinal de membresia privada."
            : "La titularidad aprobada puede habilitar un beneficio privado.",
        feeText: isEn ? "Ownership + after-sales rules" : isBr ? "Titularidade + regras de pós-venda" : "Titularidad + reglas de postventa",
        crmSignal: isEn ? "Ownership query recorded" : isBr ? "Consulta de titularidade registrada" : "Consulta de titularidad registrada",
        policyGate: isEn ? "Current query + ownership + risk" : isBr ? "Consulta vigente + titularidade + risco" : "Consulta vigente + titularidad + riesgo",
        businessResult: isEn ? "VIP club access and resale trust" : isBr ? "Acesso VIP e confianca para revenda" : "Acceso VIP y confianza para reventa",
        proofMode: isEn ? "Ownership record with protected data" : isBr ? "Registro de titularidade com dados protegidos" : "Registro de titularidad con datos protegidos",
      },
    ],
    [isBr, isEn]
  );

  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [step, setStep] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mobilePane, setMobilePane] = useState<MobilePane>("business");
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) || scenarios[0];

  useEffect(() => {
    setStep(0);
  }, [activeId]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(3);
      return;
    }
    if (isPaused) return;

    const interval = window.setInterval(() => {
      setStep((previous) => (previous < 3 ? previous + 1 : previous));
    }, 950);

    return () => window.clearInterval(interval);
  }, [activeId, isPaused]);

  useEffect(() => {
    if (isPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActiveId((currentId) => {
        const currentIndex = scenarios.findIndex((scenario) => scenario.id === currentId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % scenarios.length : 0;
        return scenarios[nextIndex].id;
      });
    }, 4000);

    return () => window.clearInterval(interval);
  }, [isPaused, scenarios]);

  function selectScenario(id: string) {
    setActiveId(id);
    setStep(0);
  }

  function rowState(requiredStep: number) {
    return { "data-visible": step >= requiredStep ? "true" : "false" };
  }

  return (
    <div
      className="brand-synergy-simulator relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 p-8 shadow-2xl backdrop-blur-xl md:p-10"
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_50%)]" />

      <div className="brand-synergy-command-grid relative grid items-start gap-10 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="brand-synergy-narrative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-300">
            <Network className="h-3 w-3" />
            {copy.badge}
          </span>

          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-white md:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">{copy.body}</p>
          <div className="brand-synergy-hypothesis-note mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-200">{copy.hypothesisBadge}</p>
            <p className="mt-1 text-xs leading-5 text-slate-300">{copy.hypothesisNote}</p>
          </div>

          <div className="brand-synergy-flow mt-6 flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-bold">
            <span className="brand-synergy-flow__chip brand-synergy-flow__chip--brand inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-800 px-3 py-1.5 text-white whitespace-nowrap">
              <PackageCheck className="h-3.5 w-3.5" />
              {copy.flow[0]}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="brand-synergy-flow__chip brand-synergy-flow__chip--tap inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/20 px-3 py-1.5 text-cyan-300 whitespace-nowrap">
              <Smartphone className="h-3.5 w-3.5" />
              {copy.flow[1]}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="brand-synergy-flow__chip brand-synergy-flow__chip--nexid inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/20 px-3 py-1.5 font-black text-purple-300 whitespace-nowrap">
              <DatabaseZap className="h-3.5 w-3.5" />
              {copy.flow[2]}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="brand-synergy-flow__chip brand-synergy-flow__chip--reward inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-3 py-1.5 text-emerald-300 whitespace-nowrap">
              <Handshake className="h-3.5 w-3.5" />
              {copy.flow[3]}
            </span>
          </div>

          <div className="brand-synergy-scenario-picker mt-6 flex flex-col gap-2">
            <p className="brand-synergy-scenario-picker__label text-[10px] font-semibold uppercase tracking-widest text-slate-500">{copy.select}</p>
            <div className="flex flex-wrap gap-2.5">
              {scenarios.map((scenario) => {
                const isActive = scenario.id === activeId;
                return (
                  <button
                    type="button"
                    key={scenario.id}
                    onClick={() => selectScenario(scenario.id)}
                    aria-pressed={isActive}
                    className={`brand-synergy-scenario-pill ${isActive ? "is-active" : ""} flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all duration-300 ${
                      isActive
                        ? `${scenario.activeBg} ${scenario.activeBorder} text-white shadow-lg`
                        : "border-white/10 bg-slate-900/60 text-slate-400 hover:border-white/20 hover:text-white"
                    }`}
                  >
                    {scenario.icon}
                    {scenario.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="brand-synergy-mobile-view-switch" role="group" aria-label={copy.mobileViewLabel}>
            <button
              type="button"
              aria-pressed={mobilePane === "business"}
              onClick={() => setMobilePane("business")}
            >
              <Handshake className="h-4 w-4" />
              {copy.businessView}
            </button>
            <button
              type="button"
              aria-pressed={mobilePane === "activation"}
              onClick={() => setMobilePane("activation")}
            >
              <Activity className="h-4 w-4" />
              {copy.activationView}
            </button>
          </div>

          <div className="brand-synergy-business-pane" data-mobile-active={mobilePane === "business" ? "true" : "false"}>
            <div className="brand-synergy-proof-grid mt-6 grid gap-2 sm:grid-cols-3">
              <div>
                <ShieldCheck className="h-4 w-4" />
                <strong>{copy.proofVerifiedTitle}</strong>
                <span>{copy.proofVerifiedBody}</span>
              </div>
              <div>
                <LockKeyhole className="h-4 w-4" />
                <strong>{copy.proofPrivateTitle}</strong>
                <span>{copy.proofPrivateBody}</span>
              </div>
              <div>
                <DatabaseZap className="h-4 w-4" />
                <strong>{copy.proofActionTitle}</strong>
                <span>{copy.proofActionBody}</span>
              </div>
            </div>

            <div className="brand-synergy-outcome-grid mt-6 grid gap-3 sm:grid-cols-2">
              <article>
                <span>{copy.signalLabel}</span>
                <strong>{activeScenario.crmSignal}</strong>
              </article>
              <article>
                <span>{copy.policyLabel}</span>
                <strong>{activeScenario.policyGate}</strong>
              </article>
              <article>
                <span>{copy.resultLabel}</span>
                <strong>{activeScenario.businessResult}</strong>
              </article>
              <article>
                <span>{copy.proofLabel}</span>
                <strong>{activeScenario.proofMode}</strong>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/login?next=/me"
                className="brand-synergy-primary-cta inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-3 text-sm font-black uppercase tracking-wider text-slate-950 shadow-lg transition-all hover:-translate-y-0.5 hover:from-cyan-400 hover:to-teal-400 hover:shadow-cyan-500/30"
              >
                {copy.portal} <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="/demo-lab"
                className="brand-synergy-secondary-cta inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/5"
              >
                {copy.lab}
              </a>
            </div>
          </div>
        </div>

        <div className="brand-synergy-live-panel" data-mobile-active={mobilePane === "activation" ? "true" : "false"}>
          <div className="brand-synergy-live-panel__head">
            <span>{copy.boardTitle}</span>
            <strong>{copy.boardSubtitle}</strong>
          </div>

          <div className="brand-synergy-live-panel__metrics">
            <div>
              <span>{copy.metricMatchLabel}</span>
              <strong>{copy.metricMatchValue}</strong>
            </div>
            <div>
              <span>{copy.metricRiskLabel}</span>
              <strong>{copy.metricRiskValue}</strong>
            </div>
            <div>
              <span>{copy.metricDataLabel}</span>
              <strong>{copy.privateDataLabel}</strong>
            </div>
          </div>

          <div
            className="brand-synergy-terminal rounded-2xl border border-white/10 bg-white/[0.03] shadow-xl"
            role="region"
            aria-label={copy.boardTitle}
            aria-live="off"
          >
            <div className="brand-synergy-terminal__chrome flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-purple-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">{copy.terminalTitle}</span>
              </div>
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-slate-500">
                <Activity className="h-3 w-3 text-cyan-400" />
                {copy.channel}
              </span>
            </div>

            <div className="brand-synergy-terminal__rows p-4 font-mono text-[11.5px] text-slate-300">
              <div className="brand-synergy-terminal-row brand-synergy-terminal-row--tap rounded-xl border border-white/10 bg-slate-900 p-3" data-visible="true">
                <p className="mb-2 text-[9px] uppercase tracking-wider text-slate-500">{copy.physicalTap}</p>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-100">{activeScenario.scannedProduct}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{activeScenario.scannedBatch}</p>
                  </div>
                  <Smartphone className="h-5 w-5 shrink-0 text-purple-400" />
                </div>
              </div>

              <div
                className="brand-synergy-terminal-row brand-synergy-terminal-row--auth rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3"
                {...rowState(1)}
              >
                <p className="mb-2 text-[9px] uppercase tracking-wider text-slate-500">{copy.authenticity}</p>
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="text-xs">{copy.verified}</span>
                </div>
              </div>

              <div
                className="brand-synergy-terminal-row brand-synergy-terminal-row--query rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3"
                {...rowState(2)}
              >
                <p className="mb-2 text-[9px] uppercase tracking-wider text-slate-500">{copy.query}</p>
                <p className="flex items-center gap-1.5 text-xs text-cyan-300">
                  <Navigation className="h-3 w-3 text-cyan-400" />
                  {copy.matching}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {copy.category}: {activeScenario.industry}
                </p>
              </div>

              <div
                className="brand-synergy-terminal-row brand-synergy-terminal-row--voucher relative overflow-hidden rounded-xl border border-purple-500/40 bg-purple-950/40 p-3"
                {...rowState(3)}
              >
                <div className="absolute bottom-1 right-1 opacity-10">
                  <Zap className="h-16 w-16 text-purple-400" />
                </div>
                <p className="mb-2 text-[9px] uppercase tracking-wider text-purple-300">{copy.voucher}</p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-400">{activeScenario.partnerBrand}</p>
                <p className="mt-1 text-sm font-black leading-tight text-white">{activeScenario.partnerBenefit}</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{activeScenario.partnerBenefitDesc}</p>
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-purple-500/20 pt-2 text-[10px]">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Coins className="h-3 w-3 text-amber-400" />
                    {activeScenario.feeText}
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-400">
                    {copy.illustrativeLabel}
                  </span>
                </div>
              </div>

              <div className="brand-synergy-privacy-note rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs leading-5 text-cyan-100">
                {copy.privacy}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
