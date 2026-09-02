"use client";

import {
  Activity,
  BadgeCheck,
  BookOpenText,
  Check,
  Layers3,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { DEMO_PRODUCT_PROFILES } from "../lib/demo-product-profiles";
import styles from "./brand-control-center-preview.module.css";

type PreviewLocale = "es-AR" | "en" | "pt-BR";
type LayerKey = "identity" | "content" | "services" | "signals";

type Layer = {
  label: string;
  helper: string;
  panelEyebrow: string;
  panelTitle: string;
  panelBody: string;
  facts: readonly { label: string; value: string }[];
  event: string;
  context: string;
  nextAction: string;
};

type PreviewCopy = {
  visualLabel: string;
  previewNotice: string;
  engineLabel: string;
  engineStatus: string;
  controlEyebrow: string;
  controlTitle: string;
  controlBody: string;
  controlLegend: string;
  controlFoot: string;
  digitalTwin: string;
  twinStatus: string;
  signalEyebrow: string;
  signalTitle: string;
  returnedLabel: string;
  contextLabel: string;
  nextLabel: string;
  truthNote: string;
  mediaLabel: string;
  layers: Record<LayerKey, Layer>;
};

const LAYER_ORDER: LayerKey[] = ["identity", "content", "services", "signals"];
const LAYER_ICONS = {
  identity: Layers3,
  content: BookOpenText,
  services: ShieldCheck,
  signals: Activity,
} as const;

const DEMO_PRODUCT = DEMO_PRODUCT_PROFILES.wine;

const PREVIEW_COPY: Record<PreviewLocale, PreviewCopy> = {
  "es-AR": {
    visualLabel: "Simulación interactiva de la operación de producto de nexID",
    previewNotice: "Simulación ilustrativa · Sin datos reales",
    engineLabel: "Vista de operación nexID",
    engineStatus: "Modo demo",
    controlEyebrow: "Detrás de cada etiqueta",
    controlTitle: "Explorá la capa digital.",
    controlBody: "Acá ves qué configura la marca y qué información recibe su equipo después de cada interacción.",
    controlLegend: "Capas del producto conectado",
    controlFoot: "Una identidad enlaza contenido, servicios y señales.",
    digitalTwin: "Identidad digital del producto",
    twinStatus: "Estado simulado",
    signalEyebrow: "Información recibida",
    signalTitle: "Lo que recibe tu equipo",
    returnedLabel: "Qué ocurrió",
    contextLabel: "Con qué contexto",
    nextLabel: "Qué puede hacer tu equipo",
    truthNote: "Escena y datos ilustrativos. En una integración activa, cada evento conserva su fuente y momento.",
    mediaLabel: "Botella premium y celular conectándose mediante una etiqueta NFC",
    layers: {
      identity: {
        label: "Identidad",
        helper: "Producto, marca y lote",
        panelEyebrow: "Capa 01 · Identidad",
        panelTitle: "Cada etiqueta vincula producto, marca y lote.",
        panelBody: "La etiqueta enlaza el producto físico con una identidad digital preparada por la marca.",
        facts: [
          { label: "Producto", value: DEMO_PRODUCT.name },
          { label: "Lote", value: DEMO_PRODUCT.lot },
          { label: "Marca", value: DEMO_PRODUCT.brand },
        ],
        event: "Producto reconocido",
        context: `${DEMO_PRODUCT.name} · Lote ${DEMO_PRODUCT.lot}`,
        nextAction: "Abrir la experiencia asignada",
      },
      content: {
        label: "Contenido",
        helper: "Lo que la marca publica",
        panelEyebrow: "Capa 02 · Contenido",
        panelTitle: "La información evoluciona sin tocar el envase.",
        panelBody: "Tu equipo actualiza la ficha que acompaña al producto, aun después de haberlo distribuido.",
        facts: [
          { label: "Historia", value: "Publicada" },
          { label: "Origen", value: "Declarado por la marca" },
          { label: "Ficha", value: "Lista para actualizar" },
        ],
        event: "Ficha del producto abierta",
        context: `Contenido · ${DEMO_PRODUCT.name}`,
        nextAction: "Entender qué información consultó",
      },
      services: {
        label: "Servicios",
        helper: "Garantía, beneficios y atención",
        panelEyebrow: "Capa 03 · Servicios",
        panelTitle: "Definí qué servicio ofrece cada producto.",
        panelBody: "La marca decide qué servicio aparece para ese producto y lo administra desde el mismo lugar.",
        facts: [
          { label: "Garantía", value: "Habilitada" },
          { label: "Beneficios", value: "Disponibles" },
          { label: "Atención", value: "Canal activo" },
        ],
        event: "Garantía iniciada",
        context: `${DEMO_PRODUCT.name} · Lote ${DEMO_PRODUCT.lot}`,
        nextAction: "Continuar desde postventa",
      },
      signals: {
        label: "Señales",
        helper: "Acciones con contexto",
        panelEyebrow: "Capa 04 · Señales",
        panelTitle: "Cada acción llega con el contexto necesario.",
        panelBody: "nexID registra la acción elegida para que el equipo sepa qué pasó y pueda continuar.",
        facts: [
          { label: "Etiqueta", value: "Leída" },
          { label: "Ficha", value: "Abierta" },
          { label: "Garantía", value: "Iniciada" },
        ],
        event: "El cliente inició una garantía",
        context: "Producto + lote + acción",
        nextAction: "Asignar seguimiento",
      },
    },
  },
  en: {
    visualLabel: "Interactive simulation of nexID product operations",
    previewNotice: "Illustrative simulation · No real data",
    engineLabel: "nexID operations view",
    engineStatus: "Demo mode",
    controlEyebrow: "Behind every label",
    controlTitle: "Explore the digital layer.",
    controlBody: "See what the brand configures and what information its team receives after every interaction.",
    controlLegend: "Connected product layers",
    controlFoot: "One identity links content, services and signals.",
    digitalTwin: "Product digital identity",
    twinStatus: "Simulated state",
    signalEyebrow: "Information received",
    signalTitle: "What your team receives",
    returnedLabel: "What happened",
    contextLabel: "With what context",
    nextLabel: "What your team can do",
    truthNote: "Illustrative scene and data. In an active integration, each event keeps its source and time.",
    mediaLabel: "Premium bottle and phone connecting through an NFC label",
    layers: {
      identity: {
        label: "Identity",
        helper: "Product, brand and batch",
        panelEyebrow: "Layer 01 · Identity",
        panelTitle: "Each label links product, brand and batch.",
        panelBody: "The label links the physical product to a digital identity prepared by the brand.",
        facts: [
          { label: "Product", value: DEMO_PRODUCT.name },
          { label: "Batch", value: DEMO_PRODUCT.lot },
          { label: "Brand", value: DEMO_PRODUCT.brand },
        ],
        event: "Product recognized",
        context: `${DEMO_PRODUCT.name} · Batch ${DEMO_PRODUCT.lot}`,
        nextAction: "Open the assigned experience",
      },
      content: {
        label: "Content",
        helper: "What the brand publishes",
        panelEyebrow: "Layer 02 · Content",
        panelTitle: "Information evolves without changing the package.",
        panelBody: "Your team updates the product profile even after the product has been distributed.",
        facts: [
          { label: "Story", value: "Published" },
          { label: "Origin", value: "Declared by the brand" },
          { label: "Profile", value: "Ready to update" },
        ],
        event: "Product profile opened",
        context: `Content · ${DEMO_PRODUCT.name}`,
        nextAction: "Understand what information was viewed",
      },
      services: {
        label: "Services",
        helper: "Warranty, benefits and support",
        panelEyebrow: "Layer 03 · Services",
        panelTitle: "Define which service each product offers.",
        panelBody: "The brand decides which service appears for that product and manages it from one place.",
        facts: [
          { label: "Warranty", value: "Enabled" },
          { label: "Benefits", value: "Available" },
          { label: "Support", value: "Channel active" },
        ],
        event: "Warranty started",
        context: `${DEMO_PRODUCT.name} · Batch ${DEMO_PRODUCT.lot}`,
        nextAction: "Continue in after-sales",
      },
      signals: {
        label: "Signals",
        helper: "Actions with context",
        panelEyebrow: "Layer 04 · Signals",
        panelTitle: "Every action arrives with the context your team needs.",
        panelBody: "nexID records the chosen action so the team knows what happened and can continue.",
        facts: [
          { label: "Label", value: "Read" },
          { label: "Profile", value: "Opened" },
          { label: "Warranty", value: "Started" },
        ],
        event: "The customer started a warranty",
        context: "Product + batch + action",
        nextAction: "Assign follow-up",
      },
    },
  },
  "pt-BR": {
    visualLabel: "Simulação interativa da operação de produto da nexID",
    previewNotice: "Simulação ilustrativa · Sem dados reais",
    engineLabel: "Visão de operação nexID",
    engineStatus: "Modo demo",
    controlEyebrow: "Por trás de cada etiqueta",
    controlTitle: "Explore a camada digital.",
    controlBody: "Veja o que a marca configura e quais informações a equipe recebe após cada interação.",
    controlLegend: "Camadas do produto conectado",
    controlFoot: "Uma identidade conecta conteúdo, serviços e sinais.",
    digitalTwin: "Identidade digital do produto",
    twinStatus: "Estado simulado",
    signalEyebrow: "Informação recebida",
    signalTitle: "O que sua equipe recebe",
    returnedLabel: "O que aconteceu",
    contextLabel: "Com qual contexto",
    nextLabel: "O que sua equipe pode fazer",
    truthNote: "Cena e dados ilustrativos. Em uma integração ativa, cada evento mantém sua fonte e momento.",
    mediaLabel: "Garrafa premium e celular conectados por uma etiqueta NFC",
    layers: {
      identity: {
        label: "Identidade",
        helper: "Produto, marca e lote",
        panelEyebrow: "Camada 01 · Identidade",
        panelTitle: "Cada etiqueta conecta produto, marca e lote.",
        panelBody: "A etiqueta conecta o produto físico a uma identidade digital preparada pela marca.",
        facts: [
          { label: "Produto", value: DEMO_PRODUCT.name },
          { label: "Lote", value: DEMO_PRODUCT.lot },
          { label: "Marca", value: DEMO_PRODUCT.brand },
        ],
        event: "Produto reconhecido",
        context: `${DEMO_PRODUCT.name} · Lote ${DEMO_PRODUCT.lot}`,
        nextAction: "Abrir a experiência atribuída",
      },
      content: {
        label: "Conteúdo",
        helper: "O que a marca publica",
        panelEyebrow: "Camada 02 · Conteúdo",
        panelTitle: "A informação evolui sem trocar a embalagem.",
        panelBody: "Sua equipe atualiza a ficha mesmo depois que o produto foi distribuído.",
        facts: [
          { label: "História", value: "Publicada" },
          { label: "Origem", value: "Declarada pela marca" },
          { label: "Ficha", value: "Pronta para atualizar" },
        ],
        event: "Ficha do produto aberta",
        context: `Conteúdo · ${DEMO_PRODUCT.name}`,
        nextAction: "Entender qual informação foi consultada",
      },
      services: {
        label: "Serviços",
        helper: "Garantia, benefícios e atendimento",
        panelEyebrow: "Camada 03 · Serviços",
        panelTitle: "Defina qual serviço cada produto oferece.",
        panelBody: "A marca decide qual serviço aparece para o produto e o administra no mesmo lugar.",
        facts: [
          { label: "Garantia", value: "Habilitada" },
          { label: "Benefícios", value: "Disponíveis" },
          { label: "Atendimento", value: "Canal ativo" },
        ],
        event: "Garantia iniciada",
        context: `${DEMO_PRODUCT.name} · Lote ${DEMO_PRODUCT.lot}`,
        nextAction: "Continuar no pós-venda",
      },
      signals: {
        label: "Sinais",
        helper: "Ações com contexto",
        panelEyebrow: "Camada 04 · Sinais",
        panelTitle: "Cada ação chega com o contexto que a equipe precisa.",
        panelBody: "A nexID registra a ação escolhida para a equipe saber o que aconteceu e continuar.",
        facts: [
          { label: "Etiqueta", value: "Lida" },
          { label: "Ficha", value: "Aberta" },
          { label: "Garantia", value: "Iniciada" },
        ],
        event: "O cliente iniciou uma garantia",
        context: "Produto + lote + ação",
        nextAction: "Atribuir acompanhamento",
      },
    },
  },
};

function resolveLocale(locale: string): PreviewLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

export function BrandControlCenterPreview({ locale }: { locale: string }) {
  const copy = PREVIEW_COPY[resolveLocale(locale)];
  const [selected, setSelected] = useState<LayerKey>("identity");
  const [motionMode, setMotionMode] = useState<"pending" | "ready" | "reduced">("pending");
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const groupId = useId();
  const layer = copy.layers[selected];
  const motionActive = motionMode === "ready" && inView && pageVisible;

  useEffect(() => {
    const root = rootRef.current;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionMode(reducedMotionQuery.matches ? "reduced" : "ready");
    const syncVisibility = () => setPageVisible(!document.hidden);
    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      setMotionMode(event.matches ? "reduced" : "ready");
    };

    syncMotion();
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    reducedMotionQuery.addEventListener("change", onReducedMotionChange);

    if (!root || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return () => {
        document.removeEventListener("visibilitychange", syncVisibility);
        reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.12)),
      { rootMargin: "64px 0px", threshold: [0, 0.12, 0.35] },
    );
    observer.observe(root);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
      reducedMotionQuery.removeEventListener("change", onReducedMotionChange);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.preview}
      role="group"
      data-layer={selected}
      data-motion-mode={motionMode}
      data-motion-active={motionActive ? "true" : "false"}
      aria-label={copy.visualLabel}
    >
      <header className={styles.topBar}>
        <span className={styles.notice}><BadgeCheck aria-hidden="true" />{copy.previewNotice}</span>
        <span className={styles.engine}><Sparkles aria-hidden="true" />{copy.engineLabel}<i />{copy.engineStatus}</span>
      </header>

      <div className={styles.workspace}>
        <section className={styles.controls} aria-labelledby={`${groupId}-title`}>
          <span className={styles.eyebrow}>{copy.controlEyebrow}</span>
          <h3 id={`${groupId}-title`}>{copy.controlTitle}</h3>
          <p>{copy.controlBody}</p>

          <fieldset className={styles.controlList}>
            <legend>{copy.controlLegend}</legend>
            {LAYER_ORDER.map((key, index) => {
              const item = copy.layers[key];
              const Icon = LAYER_ICONS[key];
              const inputId = `${groupId}-${key}`;
              return (
                <label key={key} htmlFor={inputId} data-selected={selected === key ? "true" : "false"}>
                  <input
                    id={inputId}
                    type="radio"
                    name={`${groupId}-layer`}
                    value={key}
                    checked={selected === key}
                    onChange={() => setSelected(key)}
                  />
                  <span className={styles.controlNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <span className={styles.controlIcon}><Icon aria-hidden="true" /></span>
                  <span className={styles.controlCopy}><strong>{item.label}</strong><small>{item.helper}</small></span>
                  <Check className={styles.controlCheck} aria-hidden="true" />
                </label>
              );
            })}
          </fieldset>

          <p className={styles.controlFoot}><RadioTower aria-hidden="true" />{copy.controlFoot}</p>
        </section>

        <figure className={styles.theatre} aria-label={copy.mediaLabel}>
          <Image
            className={styles.media}
            src="/landing/nexid-product-orchestration-wine.webp"
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 58vw"
            aria-hidden="true"
          />
          <span className={styles.cinematicVeil} aria-hidden="true" />
          <span className={styles.colorBloom} aria-hidden="true" />

          <div className={styles.rfStage} key={`rf-${selected}`} aria-hidden="true">
            <span className={styles.nfcCore}><i />NFC</span>
            <span className={`${styles.rfArc} ${styles.rfArcOne}`} />
            <span className={`${styles.rfArc} ${styles.rfArcTwo}`} />
            <span className={`${styles.rfArc} ${styles.rfArcThree}`} />
            <span className={`${styles.rfArc} ${styles.rfArcFour}`} />
            <span className={styles.rfParticleOne} />
            <span className={styles.rfParticleTwo} />
            <span className={styles.rfParticleThree} />
          </div>

          <svg className={styles.signalMap} viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id={`${groupId}-signal-gradient`} x1="0" x2="1">
                <stop offset="0" stopColor="#22d3ee" />
                <stop offset="0.55" stopColor="#2dd4bf" />
                <stop offset="1" stopColor="#a78bfa" />
              </linearGradient>
              <filter id={`${groupId}-signal-glow`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="7" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <path className={styles.signalHalo} pathLength={1} d="M575 350 C645 292, 710 262, 790 244" />
            <path
              className={styles.signalTrace}
              pathLength={1}
              d="M575 350 C645 292, 710 262, 790 244"
              stroke={`url(#${groupId}-signal-gradient)`}
              filter={`url(#${groupId}-signal-glow)`}
            />
            <path className={styles.returnTrace} pathLength={1} d="M790 270 C730 334, 672 372, 610 390" />
            <circle className={styles.signalNode} cx="575" cy="350" r="7" />
            <circle className={styles.signalNodeTarget} cx="790" cy="244" r="8" />
          </svg>

          <figcaption className={styles.twinCard} key={`card-${selected}`}>
            <div className={styles.twinHeader}>
              <span><Layers3 aria-hidden="true" />{copy.digitalTwin}</span>
              <small><i />{copy.twinStatus}</small>
            </div>
            <span className={styles.twinEyebrow}>{layer.panelEyebrow}</span>
            <h4>{layer.panelTitle}</h4>
            <p>{layer.panelBody}</p>
            <dl className={styles.factList}>
              {layer.facts.map((fact) => (
                <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
              ))}
            </dl>
          </figcaption>
        </figure>
      </div>

      <section className={styles.signalConsole} aria-labelledby={`${groupId}-signal-title`}>
        <div className={styles.signalTitle}>
          <RadioTower aria-hidden="true" />
          <span><small>{copy.signalEyebrow}</small><strong id={`${groupId}-signal-title`}>{copy.signalTitle}</strong></span>
        </div>
        <dl className={styles.signalDetails} key={`signal-${selected}`}>
          <div><dt>{copy.returnedLabel}</dt><dd>{layer.event}</dd></div>
          <div><dt>{copy.contextLabel}</dt><dd>{layer.context}</dd></div>
          <div><dt>{copy.nextLabel}</dt><dd>{layer.nextAction}</dd></div>
        </dl>
        <p className={styles.truthNote}>{copy.truthNote}</p>
      </section>

      <span className={styles.srStatus} role="status" aria-live="polite">
        {layer.label}: {layer.event}. {layer.nextAction}.
      </span>
    </div>
  );
}
