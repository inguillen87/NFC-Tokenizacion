"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import { HorizontalRailControls } from "./horizontal-rail-controls";
import { SimpleTrustFlowMotion } from "./simple-trust-flow-motion";
import {
  SIMPLE_TRUST_DEFAULT_INDUSTRY,
  SimpleTrustStepVisual,
  type SimpleTrustIndustry,
  type SimpleTrustVisualKind,
} from "./simple-trust-step-visual";

type JourneyLocale = "es-AR" | "en" | "pt-BR";

type IndustryCopy = {
  label: string;
  descriptor: string;
};

type StepCopy = {
  label: string;
  body: string;
};

type JourneyCopy = {
  selectorLabel: string;
  railLabel: string;
  previous: string;
  next: string;
  industries: Record<SimpleTrustIndustry, IndustryCopy>;
  steps: readonly [StepCopy, StepCopy, StepCopy];
};

const INDUSTRIES: readonly SimpleTrustIndustry[] = ["bottles", "perfume", "agro"];
const STEP_KINDS: readonly SimpleTrustVisualKind[] = ["discover", "signal", "aftercare"];

const JOURNEY_COPY: Record<JourneyLocale, JourneyCopy> = {
  "es-AR": {
    selectorLabel: "Elegí un rubro",
    railLabel: "Pasos del recorrido del producto",
    previous: "Paso anterior",
    next: "Paso siguiente",
    industries: {
      bottles: {
        label: "Botellas",
        descriptor: "Vinos, bebidas y aceites: mirá cómo una botella abre información y acciones configuradas por la marca.",
      },
      perfume: {
        label: "Perfumería premium",
        descriptor: "Frascos y estuches premium: el empaque inicia una experiencia de producto y postventa definida por la marca.",
      },
      agro: {
        label: "Agro",
        descriptor: "Bidones, bolsas e insumos: la etiqueta muestra información y próximos pasos elegidos por la marca.",
      },
    },
    steps: [
      { label: "Acercá el celular", body: "El cliente acerca el teléfono a la etiqueta NFC del producto o escanea su QR." },
      { label: "Recibí una respuesta clara", body: "nexID lee la etiqueta digital y muestra la información elegida por la marca." },
      { label: "Elegí la próxima acción", body: "Desde el mismo recorrido, el cliente accede a las acciones configuradas para ese producto." },
    ],
  },
  en: {
    selectorLabel: "Choose an industry",
    railLabel: "Steps in the product journey",
    previous: "Previous step",
    next: "Next step",
    industries: {
      bottles: {
        label: "Bottles",
        descriptor: "Wine, drinks and oils: see how a bottle opens information and actions configured by the brand.",
      },
      perfume: {
        label: "Premium perfume",
        descriptor: "Premium bottles and boxes: the package starts a product and after-sales experience defined by the brand.",
      },
      agro: {
        label: "Agriculture",
        descriptor: "Containers, bags and inputs: the tag shows information and next steps selected by the brand.",
      },
    },
    steps: [
      { label: "Bring the phone close", body: "The customer taps the product's NFC tag or scans its QR code." },
      { label: "Get a clear response", body: "nexID reads the digital tag and shows the information selected by the brand." },
      { label: "Choose the next action", body: "From the same journey, customers access the actions configured for that product." },
    ],
  },
  "pt-BR": {
    selectorLabel: "Escolha um setor",
    railLabel: "Etapas da jornada do produto",
    previous: "Etapa anterior",
    next: "Próxima etapa",
    industries: {
      bottles: {
        label: "Garrafas",
        descriptor: "Vinhos, bebidas e óleos: veja como uma garrafa abre informações e ações configuradas pela marca.",
      },
      perfume: {
        label: "Perfumaria premium",
        descriptor: "Frascos e estojos premium: a embalagem inicia uma experiência de produto e pós-venda definida pela marca.",
      },
      agro: {
        label: "Agro",
        descriptor: "Bombonas, sacos e insumos: a etiqueta mostra informações e próximos passos escolhidos pela marca.",
      },
    },
    steps: [
      { label: "Aproxime o celular", body: "O cliente aproxima o celular da etiqueta NFC do produto ou escaneia seu QR." },
      { label: "Receba uma resposta clara", body: "A nexID lê a etiqueta digital e mostra as informações escolhidas pela marca." },
      { label: "Escolha a próxima ação", body: "Na mesma jornada, o cliente acessa as ações configuradas para esse produto." },
    ],
  },
};

export function resolveSimpleTrustJourneyLocale(locale: string | null | undefined): JourneyLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

export function SimpleTrustIndustryJourney({ locale }: { locale: string }) {
  const normalizedLocale = resolveSimpleTrustJourneyLocale(locale);
  const copy = JOURNEY_COPY[normalizedLocale];
  const [activeIndustry, setActiveIndustry] = useState<SimpleTrustIndustry>(SIMPLE_TRUST_DEFAULT_INDUSTRY);
  const tabRefs = useRef<Record<SimpleTrustIndustry, HTMLButtonElement | null>>({
    bottles: null,
    perfume: null,
    agro: null,
  });
  const instanceId = useId().replace(/:/g, "");
  const panelId = `${instanceId}-industry-panel`;
  const descriptorId = `${instanceId}-${activeIndustry}-industry-descriptor`;
  const railId = `${instanceId}-${activeIndustry}-industry-rail`;
  const activeCopy = copy.industries[activeIndustry];

  function selectAndFocus(index: number) {
    const wrappedIndex = (index + INDUSTRIES.length) % INDUSTRIES.length;
    const nextIndustry = INDUSTRIES[wrappedIndex] ?? SIMPLE_TRUST_DEFAULT_INDUSTRY;
    setActiveIndustry(nextIndustry);
    tabRefs.current[nextIndustry]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = index + 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = index - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = INDUSTRIES.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectAndFocus(nextIndex);
  }

  return (
    <div className="simple-trust-industry-journey" data-active-industry={activeIndustry}>
      <div className="simple-trust-industry-journey__layout">
        <div className="simple-trust-industry-journey__selector">
          <span className="simple-trust-industry-journey__selector-label">{copy.selectorLabel}</span>
          <div
            className="simple-trust-industry-tabs simple-trust-industry-tabs--desktop-lateral simple-trust-industry-tabs--mobile-horizontal"
            role="tablist"
            aria-label={copy.selectorLabel}
          >
            {INDUSTRIES.map((industry, index) => {
              const isActive = industry === activeIndustry;
              const tabId = `${instanceId}-${industry}-tab`;

              return (
                <button
                  key={industry}
                  ref={(node) => {
                    tabRefs.current[industry] = node;
                  }}
                  id={tabId}
                  className="simple-trust-industry-tab"
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={panelId}
                  tabIndex={isActive ? 0 : -1}
                  data-industry={industry}
                  onClick={() => setActiveIndustry(industry)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {copy.industries[industry].label}
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={activeIndustry}
          id={panelId}
          className={`simple-trust-industry-panel simple-trust-industry-panel--${activeIndustry}`}
          role="tabpanel"
          aria-labelledby={`${instanceId}-${activeIndustry}-tab`}
          aria-describedby={descriptorId}
        >
          <p id={descriptorId} className="simple-trust-industry-panel__descriptor">
            {activeCopy.descriptor}
          </p>

          <SimpleTrustFlowMotion
            key={activeIndustry}
            id={railId}
            ariaLabel={`${copy.railLabel}: ${activeCopy.label}`}
          >
            {copy.steps.map((step, index) => {
              const kind = STEP_KINDS[index] ?? "discover";

              return (
                <li key={kind} data-industry={activeIndustry} data-journey-step={kind}>
                  <SimpleTrustStepVisual kind={kind} locale={normalizedLocale} industry={activeIndustry} />
                  <span className="simple-trust-flow-step-number" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="simple-trust-flow-step-title">{step.label}</h3>
                  <p className="simple-trust-flow-step-copy">{step.body}</p>
                </li>
              );
            })}
          </SimpleTrustFlowMotion>

          <div className="simple-trust-industry-panel__controls">
            <HorizontalRailControls
              railId={railId}
              itemCount={copy.steps.length}
              previousLabel={copy.previous}
              nextLabel={copy.next}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
