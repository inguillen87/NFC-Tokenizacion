"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { HorizontalRailControls } from "./horizontal-rail-controls";
import { useConnectedProductIndustry } from "./connected-product-industry-context";
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
  steps: readonly [StepCopy, StepCopy, StepCopy];
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
};

const INDUSTRIES: readonly SimpleTrustIndustry[] = ["bottles", "perfume", "agro"];
const STEP_KINDS: readonly SimpleTrustVisualKind[] = ["discover", "signal", "aftercare"];
const DEMO_PROFILE_BY_INDUSTRY: Readonly<Record<SimpleTrustIndustry, "wine" | "packaging" | "agro">> = {
  bottles: "wine",
  perfume: "packaging",
  agro: "agro",
};

const JOURNEY_COPY: Record<JourneyLocale, JourneyCopy> = {
  "es-AR": {
    selectorLabel: "Elegí un rubro",
    railLabel: "Pasos del recorrido del producto",
    previous: "Paso anterior",
    next: "Paso siguiente",
    industries: {
      bottles: {
        label: "Botellas",
        descriptor: "Vinos, bebidas y aceites: una identidad por lote abre el pasaporte que acompaña al producto.",
        steps: [
          { label: "Identificá botella y lote", body: "El NFC o QR vincula esta botella con Reserva Andina y el lote RA-2407." },
          { label: "Abrí su pasaporte digital", body: "El celular muestra origen declarado, cosecha y recomendaciones vigentes publicadas por la bodega." },
          { label: "Continuá con el producto", body: "Desde el pasaporte, la persona consulta el lote, descubre cómo disfrutarlo o contacta a la bodega." },
        ],
      },
      perfume: {
        label: "Packaging",
        descriptor: "Cajas, estuches y envases: el packaging conecta materiales, cuidados y responsable en una sola vista.",
        steps: [
          { label: "Conectá el packaging", body: "La etiqueta vincula el Estuche Aurora con su referencia y partida de producción." },
          { label: "Mostrá materiales y cuidados", body: "El pasaporte reúne composición declarada, instrucciones y datos del responsable del producto." },
          { label: "Habilitá circularidad y servicio", body: "La persona encuentra cómo reciclar, consultar la garantía o contactar al fabricante, sin app." },
        ],
      },
      agro: {
        label: "Agro",
        descriptor: "Bidones, bolsas e insumos: la identificación correcta acerca documentación y soporte según el producto.",
        steps: [
          { label: "Reconocé bidón y lote", body: "El NFC o QR identifica el Insumo Horizonte y lo relaciona con el lote IH-2407." },
          { label: "Consultá información vigente", body: "El pasaporte presenta fabricante, lote, instrucciones y documentación publicada para ese insumo." },
          { label: "Derivá la consulta correcta", body: "Según el acceso disponible, el usuario abre la ficha, consulta documentación o contacta a soporte." },
        ],
      },
    },
  },
  en: {
    selectorLabel: "Choose an industry",
    railLabel: "Steps in the product journey",
    previous: "Previous step",
    next: "Next step",
    industries: {
      bottles: {
        label: "Bottles",
        descriptor: "Wine, drinks and oils: a batch identity opens the passport that travels with the product.",
        steps: [
          { label: "Identify bottle and batch", body: "NFC or QR links this bottle to Andean Reserve and batch RA-2407." },
          { label: "Open its digital passport", body: "The phone shows declared origin, harvest and current guidance published by the winery." },
          { label: "Continue with the product", body: "From the passport, people can check the batch, explore serving guidance or contact the winery." },
        ],
      },
      perfume: {
        label: "Packaging",
        descriptor: "Boxes, cases and containers: packaging connects materials, care and responsible party in one view.",
        steps: [
          { label: "Connect the package", body: "The tag links the Aurora Case to its reference and production run." },
          { label: "Show materials and care", body: "The passport brings together declared composition, instructions and responsible-party details." },
          { label: "Enable circularity and service", body: "People find recycling guidance, warranty information or manufacturer contact without an app." },
        ],
      },
      agro: {
        label: "Agriculture",
        descriptor: "Containers, bags and inputs: the right identity brings product documentation and support closer.",
        steps: [
          { label: "Recognize container and batch", body: "NFC or QR identifies the Horizon Input and links it to batch IH-2407." },
          { label: "Review current information", body: "The passport presents manufacturer, batch, instructions and documentation published for that input." },
          { label: "Route the right request", body: "Based on available access, the user opens the record, reviews documentation or contacts support." },
        ],
      },
    },
  },
  "pt-BR": {
    selectorLabel: "Escolha um setor",
    railLabel: "Etapas da jornada do produto",
    previous: "Etapa anterior",
    next: "Próxima etapa",
    industries: {
      bottles: {
        label: "Garrafas",
        descriptor: "Vinhos, bebidas e óleos: uma identidade por lote abre o passaporte que acompanha o produto.",
        steps: [
          { label: "Identifique garrafa e lote", body: "NFC ou QR vincula esta garrafa à Reserva Andina e ao lote RA-2407." },
          { label: "Abra o passaporte digital", body: "O celular mostra origem declarada, safra e orientações atuais publicadas pela vinícola." },
          { label: "Continue com o produto", body: "No passaporte, a pessoa consulta o lote, descobre como aproveitar ou fala com a vinícola." },
        ],
      },
      perfume: {
        label: "Packaging",
        descriptor: "Caixas, estojos e recipientes: a embalagem conecta materiais, cuidados e responsável em uma única tela.",
        steps: [
          { label: "Conecte a embalagem", body: "A etiqueta vincula o Estojo Aurora à sua referência e partida de produção." },
          { label: "Mostre materiais e cuidados", body: "O passaporte reúne composição declarada, instruções e dados do responsável pelo produto." },
          { label: "Ative circularidade e serviço", body: "A pessoa encontra reciclagem, garantia ou contato com o fabricante sem baixar um app." },
        ],
      },
      agro: {
        label: "Agro",
        descriptor: "Bombonas, sacos e insumos: a identificação correta aproxima documentação e suporte do produto.",
        steps: [
          { label: "Reconheça recipiente e lote", body: "NFC ou QR identifica o Insumo Horizonte e o relaciona ao lote IH-2407." },
          { label: "Consulte informação atual", body: "O passaporte apresenta fabricante, lote, instruções e documentação publicada para o insumo." },
          { label: "Direcione a solicitação", body: "Conforme o acesso disponível, o usuário abre a ficha, consulta documentos ou fala com o suporte." },
        ],
      },
    },
  },
};

export function resolveSimpleTrustJourneyLocale(locale: string | null | undefined): JourneyLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

export function SimpleTrustIndustryJourney({ locale, ctaLabel }: { locale: string; ctaLabel: string }) {
  const normalizedLocale = resolveSimpleTrustJourneyLocale(locale);
  const copy = JOURNEY_COPY[normalizedLocale];
  const sharedIndustry = useConnectedProductIndustry();
  const [localIndustry, setLocalIndustry] = useState<SimpleTrustIndustry>(SIMPLE_TRUST_DEFAULT_INDUSTRY);
  const activeIndustry = sharedIndustry?.activeIndustry ?? localIndustry;
  const setActiveIndustry = sharedIndustry?.setActiveIndustry ?? setLocalIndustry;
  const [tabOrientation, setTabOrientation] = useState<"vertical" | "horizontal">("vertical");
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

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1100px)");
    const syncOrientation = () => setTabOrientation(query.matches ? "horizontal" : "vertical");
    syncOrientation();
    query.addEventListener("change", syncOrientation);
    return () => query.removeEventListener("change", syncOrientation);
  }, []);

  function selectAndFocus(index: number) {
    const wrappedIndex = (index + INDUSTRIES.length) % INDUSTRIES.length;
    const nextIndustry = INDUSTRIES[wrappedIndex] ?? SIMPLE_TRUST_DEFAULT_INDUSTRY;
    setActiveIndustry(nextIndustry);
    tabRefs.current[nextIndustry]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;

    switch (event.key) {
      case tabOrientation === "horizontal" ? "ArrowRight" : "ArrowDown":
        nextIndex = index + 1;
        break;
      case tabOrientation === "horizontal" ? "ArrowLeft" : "ArrowUp":
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
            aria-orientation={tabOrientation}
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
            {activeCopy.steps.map((step, index) => {
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
              itemCount={activeCopy.steps.length}
              previousLabel={copy.previous}
              nextLabel={copy.next}
            />
          </div>
        </div>
      </div>
      <div className="simple-trust-flow-footer">
        <Link href={`/demo-lab?profile=${DEMO_PROFILE_BY_INDUSTRY[activeIndustry]}`} className="simple-trust-flow-cta">
          {ctaLabel}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
