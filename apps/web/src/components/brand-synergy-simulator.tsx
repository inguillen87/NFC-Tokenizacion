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
  ShieldCheck,
  Smartphone,
  Sparkles,
  Ticket,
  Wine,
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
      ? "NEXID BRAND SYNERGY ENGINE"
      : isBr
        ? "MOTOR DE SINERGIA DE MARCAS"
        : "MOTOR DE SINERGIA DE MARCAS",
    title: isEn
      ? "Products that verify, learn and trigger business."
      : isBr
        ? "Produtos que verificam, aprendem e ativam negocio."
        : "Productos que verifican, aprenden y activan negocio.",
    body: isEn
      ? "A tap is not just a certificate. nexID can prove the product, read consent and policy, and route a trusted commercial action without exposing private customer data."
      : isBr
        ? "Um tap nao e apenas um certificado. nexID prova o produto, aplica consentimento e politica, e aciona uma resposta comercial sem expor dados privados."
        : "Un tap no es solo un certificado. nexID prueba el producto, aplica consentimiento y politica, y dispara una accion comercial sin exponer datos privados.",
    flow: isEn
      ? ["Product", "Tap", "Policy", "Reward"]
      : isBr
        ? ["Produto", "Tap", "Politica", "Beneficio"]
        : ["Producto", "Tap", "Politica", "Beneficio"],
    select: isEn ? "Select scenario" : isBr ? "Selecionar cenario" : "Seleccionar escenario",
    portal: isEn ? "Simulate portal and wallet" : isBr ? "Simular portal e wallet" : "Simular portal y wallet",
    lab: isEn ? "Open Demo Lab" : isBr ? "Abrir Demo Lab" : "Abrir Demo Lab",
    terminalTitle: isEn ? "Guided offer model" : isBr ? "Modelo guiado de oferta" : "Modelo guiado de oferta",
    channel: isEn ? "Hypothetical scenario" : isBr ? "Cenario hipotetico" : "Escenario hipotetico",
    physicalTap: isEn ? "1 - Physical tap detected" : isBr ? "1 - Tap fisico detectado" : "1 - Tap fisico detectado",
    authenticity: isEn ? "2 - Authenticity check" : isBr ? "2 - Checagem de autenticidade" : "2 - Chequeo de autenticidad",
    query: isEn ? "3 - Business policy query" : isBr ? "3 - Consulta de politica comercial" : "3 - Consulta de politica comercial",
    voucher: isEn ? "4 - Action unlocked" : isBr ? "4 - Acao habilitada" : "4 - Accion habilitada",
    verified: isEn
      ? "Demo check: SUN response + configured policy"
      : isBr
        ? "Cheque demo: resposta SUN + politica configurada"
        : "Chequeo demo: respuesta SUN + politica configurada",
    matching: isEn
      ? "Evaluating a configurable offer under demo rules..."
      : isBr
        ? "Avaliando uma oferta configuravel com regras demo..."
        : "Evaluando una oferta configurable con reglas demo...",
    category: isEn ? "Category" : isBr ? "Categoria" : "Categoria",
    boardTitle: isEn ? "Hypothetical activation model" : isBr ? "Modelo hipotetico de ativacao" : "Modelo hipotetico de activacion",
    boardSubtitle: isEn
      ? "What a team could operate after a trusted tap."
      : isBr
        ? "O que uma equipe poderia operar depois de um tap confiavel."
        : "Lo que un equipo podria operar despues de un tap confiable.",
    hypothesisBadge: isEn ? "HYPOTHETICAL SCENARIO" : isBr ? "CENARIO HIPOTETICO" : "ESCENARIO HIPOTETICO",
    hypothesisNote: isEn
      ? "Generic brands, benefits and outcomes illustrate a configurable workflow. They are not customers, partners or measured performance."
      : isBr
        ? "Marcas, beneficios e resultados genericos ilustram um fluxo configuravel. Nao sao clientes, parceiros nem performance medida."
        : "Marcas, beneficios y resultados genericos ilustran un flujo configurable. No son clientes, partners ni performance medida.",
    signalLabel: isEn ? "CRM signal" : isBr ? "Sinal CRM" : "Senal CRM",
    policyLabel: isEn ? "Policy gate" : isBr ? "Regra de politica" : "Regla de politica",
    resultLabel: isEn ? "Business result" : isBr ? "Resultado de negocio" : "Resultado comercial",
    proofLabel: isEn ? "Public proof" : isBr ? "Prova publica" : "Prueba publica",
    proofVerifiedTitle: isEn ? "Verified" : isBr ? "Verificado" : "Verificado",
    proofVerifiedBody: isEn ? "SUN + product policy" : isBr ? "SUN + politica do produto" : "SUN + politica de producto",
    proofPrivateTitle: isEn ? "Private" : isBr ? "Privado" : "Privado",
    proofPrivateBody: isEn
      ? "Consent and PII stay inside nexID"
      : isBr
        ? "Consentimento e PII ficam dentro de nexID"
        : "Consentimiento y PII quedan dentro de nexID",
    proofActionTitle: isEn ? "Actionable" : isBr ? "Acionavel" : "Accionable",
    proofActionBody: isEn
      ? "CRM signal, voucher or claim"
      : isBr
        ? "Sinal CRM, voucher ou claim"
        : "Senal CRM, voucher o reclamo",
    metricMatchLabel: isEn ? "Scenario basis" : isBr ? "Base do cenario" : "Base del escenario",
    metricMatchValue: isEn ? "Buyer assumption" : isBr ? "Premissa do comprador" : "Supuesto del comprador",
    metricRiskLabel: isEn ? "Risk model" : isBr ? "Modelo de risco" : "Modelo de riesgo",
    metricRiskValue: isEn ? "To validate" : isBr ? "A validar" : "A validar",
    metricDataLabel: isEn ? "Data" : isBr ? "Dados" : "Datos",
    privateDataLabel: isEn ? "private" : isBr ? "privado" : "privado",
    illustrativeLabel: isEn ? "Illustrative" : isBr ? "Ilustrativo" : "Ilustrativo",
    mobileViewLabel: isEn ? "Simulator view" : isBr ? "Vista do simulador" : "Vista del simulador",
    businessView: isEn ? "Decision" : isBr ? "Decisao" : "Decision",
    activationView: isEn ? "Activation" : isBr ? "Ativacao" : "Activacion",
    privacy: isEn
      ? "Public proof stays hash-only. Customer identity, route detail and contracts remain private inside nexID."
      : isBr
        ? "A prova publica fica hash-only. Identidade, rota e contratos ficam privados dentro de nexID."
        : "La prueba publica queda hash-only. Identidad, ruta y contratos quedan privados dentro de nexID.",
  };

  const scenarios = useMemo<Scenario[]>(
    () => [
      {
        id: "wine-tourism",
        name: isEn ? "Wine + VIP transfer" : isBr ? "Vinhos + traslado VIP" : "Vinos + traslados VIP",
        industry: isEn ? "Beverages and tourism" : isBr ? "Bebidas e turismo" : "Bebidas y turismo",
        icon: <Wine className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-purple-600 to-violet-500",
        activeBorder: "border-purple-500",
        scannedProduct: isEn ? "Premium wine demo lot" : isBr ? "Lote demo de vinho premium" : "Lote demo de vino premium",
        scannedBatch: "DEMO-WINE-2026-001",
        partnerBrand: isEn ? "Authorized mobility operator" : isBr ? "Operador de mobilidade autorizado" : "Operador de movilidad autorizado",
        partnerBenefit: isEn ? "Configurable return transfer" : isBr ? "Traslado de retorno configuravel" : "Traslado de retorno configurable",
        partnerBenefitDesc: isEn
          ? "Safe return to the hotel after a validated tasting."
          : isBr
            ? "Permite voltar ao hotel com seguranca depois da degustacao."
            : "Permite regresar al hotel con seguridad despues de la degustacion.",
        feeText: isEn ? "Eligibility + consent" : isBr ? "Elegibilidade + consentimento" : "Elegibilidad + consentimiento",
        crmSignal: isEn ? "High-value tourist, verified tasting" : isBr ? "Turista VIP, degustacao verificada" : "Turista VIP, cata verificada",
        policyGate: isEn ? "Same-day tap + consent + route safety" : isBr ? "Tap no dia + consentimento + rota segura" : "Tap del dia + consentimiento + ruta segura",
        businessResult: isEn ? "Configurable benefit and commercial attribution" : isBr ? "Beneficio configuravel e atribuicao comercial" : "Beneficio configurable y atribucion comercial",
        proofMode: isEn ? "Hash-only + consent token" : isBr ? "Hash-only + token de consentimento" : "Hash-only + token de consentimiento",
      },
      {
        id: "festivals-food",
        name: isEn ? "Events + gastronomy" : isBr ? "Festivais + gastronomia" : "Festivales + gastronomia",
        industry: isEn ? "Entertainment and food" : isBr ? "Entretenimento e gastronomia" : "Entretenimiento y gastronomia",
        icon: <Ticket className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-orange-500 to-amber-400",
        activeBorder: "border-orange-500",
        scannedProduct: isEn ? "Serialized event wristband" : isBr ? "Pulseira serializada de evento" : "Pulsera serializada de evento",
        scannedBatch: "DEMO-EVENT-2026-001",
        partnerBrand: isEn ? "Participating venue operator" : isBr ? "Operador gastronomico participante" : "Operador gastronomico participante",
        partnerBenefit: isEn ? "Configurable on-site benefit" : isBr ? "Beneficio configuravel no evento" : "Beneficio configurable en el evento",
        partnerBenefitDesc: isEn
          ? "Unlocked only for verified attendees inside the venue."
          : isBr
            ? "Liberada apenas para assistentes verificados dentro do evento."
            : "Habilitada solo para asistentes verificados dentro del predio.",
        feeText: isEn ? "Access proof + audience match" : isBr ? "Prova de acesso + audiencia" : "Prueba de acceso + audiencia",
        crmSignal: isEn ? "Verified attendee inside venue" : isBr ? "Assistente verificado no evento" : "Asistente verificado en el predio",
        policyGate: isEn ? "Wristband valid + location window" : isBr ? "Pulseira valida + janela de localizacao" : "Pulsera valida + ventana de ubicacion",
        businessResult: isEn ? "On-site redemption and sponsor attribution" : isBr ? "Canje no local e atribuicao ao patrocinador" : "Canje en predio y atribucion al sponsor",
        proofMode: isEn ? "Access proof + hash-only" : isBr ? "Prova de acesso + hash-only" : "Prueba de acceso + hash-only",
      },
      {
        id: "sneakers-club",
        name: isEn ? "Luxury + club access" : isBr ? "Luxo + acesso club" : "Lujo + experiencias club",
        industry: isEn ? "Fashion and nightlife" : isBr ? "Moda e eventos VIP" : "Moda y eventos VIP",
        icon: <Sparkles className="h-4 w-4" />,
        activeBg: "bg-gradient-to-r from-yellow-500 to-amber-600",
        activeBorder: "border-yellow-500",
        scannedProduct: isEn ? "Limited-edition product demo" : isBr ? "Produto demo de edicao limitada" : "Producto demo de edicion limitada",
        scannedBatch: "DEMO-LUXURY-2026-001",
        partnerBrand: isEn ? "Participating private club" : isBr ? "Clube privado participante" : "Club privado participante",
        partnerBenefit: isEn ? "Configurable access benefit" : isBr ? "Beneficio de acesso configuravel" : "Beneficio de acceso configurable",
        partnerBenefitDesc: isEn
          ? "Verified ownership acts as a private membership signal."
          : isBr
            ? "A titularidade verificada atua como sinal de membresia privada."
            : "La titularidad verificada actua como senal de membresia privada.",
        feeText: isEn ? "Revenue share + fraud gate" : isBr ? "Receita compartilhada + antifraude" : "Revenue share + antifraude",
        crmSignal: isEn ? "Owner verified, resale-safe profile" : isBr ? "Dono verificado, perfil seguro para revenda" : "Dueno verificado, perfil seguro para reventa",
        policyGate: isEn ? "Fresh tap + ownership + risk gate" : isBr ? "Tap fresco + titularidade + risco" : "Tap fresco + titularidad + riesgo",
        businessResult: isEn ? "VIP club access and resale trust" : isBr ? "Acesso VIP e confianca para revenda" : "Acceso VIP y confianza para reventa",
        proofMode: isEn ? "Ownership proof + private CRM" : isBr ? "Prova de titularidade + CRM privado" : "Prueba de propiedad + CRM privado",
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
              <Wine className="h-3.5 w-3.5" />
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
