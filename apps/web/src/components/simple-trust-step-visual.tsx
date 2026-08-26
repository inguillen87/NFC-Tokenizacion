export type SimpleTrustVisualKind = "discover" | "signal" | "aftercare";

type VisualCopy = {
  sample: string;
  product: string;
  productType: string;
  lot: string;
  origin: string;
  digitalResult: string;
  validReading: string;
  controls: string;
  physicalLimit: string;
  programOptions: string;
  warranty: string;
  available: string;
  benefit: string;
  brandExperience: string;
  support: string;
  channelEnabled: string;
};

const VISUAL_COPY: Record<"es-AR" | "en" | "pt-BR", VisualCopy> = {
  "es-AR": {
    sample: "MUESTRA ILUSTRATIVA",
    product: "Reserva Andina",
    productType: "Malbec 2024",
    lot: "LOTE  RA-2407",
    origin: "ORIGEN DECLARADO  MENDOZA, AR",
    digitalResult: "RESULTADO DIGITAL",
    validReading: "LECTURA VÁLIDA",
    controls: "CONTROLES  3 DE 3",
    physicalLimit: "RESULTADO DE LA ETIQUETA DIGITAL",
    programOptions: "OPCIONES DEL PROGRAMA",
    warranty: "GARANTÍA",
    available: "DISPONIBLE",
    benefit: "BENEFICIO",
    brandExperience: "EXPERIENCIA DE MARCA",
    support: "ATENCIÓN",
    channelEnabled: "CANAL HABILITADO",
  },
  en: {
    sample: "ILLUSTRATIVE SAMPLE",
    product: "Andean Reserve",
    productType: "Malbec 2024",
    lot: "BATCH  RA-2407",
    origin: "DECLARED ORIGIN  MENDOZA, AR",
    digitalResult: "DIGITAL RESULT",
    validReading: "VALID READING",
    controls: "CHECKS  3 OF 3",
    physicalLimit: "DIGITAL LABEL RESULT",
    programOptions: "PROGRAM OPTIONS",
    warranty: "WARRANTY",
    available: "AVAILABLE",
    benefit: "BENEFIT",
    brandExperience: "BRAND EXPERIENCE",
    support: "SUPPORT",
    channelEnabled: "CHANNEL ENABLED",
  },
  "pt-BR": {
    sample: "AMOSTRA ILUSTRATIVA",
    product: "Reserva Andina",
    productType: "Malbec 2024",
    lot: "LOTE  RA-2407",
    origin: "ORIGEM DECLARADA  MENDOZA, AR",
    digitalResult: "RESULTADO DIGITAL",
    validReading: "LEITURA VÁLIDA",
    controls: "CONTROLES  3 DE 3",
    physicalLimit: "RESULTADO DA ETIQUETA DIGITAL",
    programOptions: "OPÇÕES DO PROGRAMA",
    warranty: "GARANTIA",
    available: "DISPONÍVEL",
    benefit: "BENEFÍCIO",
    brandExperience: "EXPERIÊNCIA DA MARCA",
    support: "ATENDIMENTO",
    channelEnabled: "CANAL HABILITADO",
  },
};

export function SimpleTrustStepVisual({ kind, locale }: { kind: SimpleTrustVisualKind; locale: string }) {
  const normalizedLocale = locale === "en" || locale === "pt-BR" ? locale : "es-AR";
  const copy = VISUAL_COPY[normalizedLocale];

  return (
    <div
      className={`simple-trust-flow-visual simple-trust-flow-visual--${kind}`}
      data-trust-scene={kind}
      aria-hidden="true"
    >
      {kind === "discover" ? (
        <DiscoverVisual copy={copy} />
      ) : kind === "signal" ? (
        <SignalVisual copy={copy} />
      ) : (
        <AftercareVisual copy={copy} />
      )}
    </div>
  );
}

function DiscoverVisual({ copy }: { copy: VisualCopy }) {
  return (
    <svg viewBox="0 0 320 150" fill="none" focusable="false">
      <path
        className="trust-visual__surface trust-visual__product"
        d="M54 20h20v16c9 4 15 12 15 22v47c0 11-8 19-19 19H58c-11 0-19-8-19-19V58c0-10 6-18 15-22V20Z"
      />
      <path className="trust-visual__line" d="M54 31h20M45 53h38" />
      <rect className="trust-visual__tag" x="47" y="66" width="34" height="31" rx="9" />
      <text className="trust-visual__tag-text" x="64" y="85" textAnchor="middle">NFC</text>

      <path className="trust-visual__route trust-visual__animated" d="M90 76h67" />
      <circle className="trust-visual__traveller trust-visual__animated" cx="112" cy="76" r="4" />

      <g className="trust-visual__card trust-visual__animated">
        <rect className="trust-visual__surface" x="159" y="18" width="139" height="114" rx="18" />
        <text className="trust-visual__eyebrow" x="174" y="37">{copy.sample}</text>
        <text className="trust-visual__title" x="174" y="56">{copy.product}</text>
        <text className="trust-visual__body" x="174" y="70">{copy.productType}</text>
        <path className="trust-visual__divider" d="M174 80h109" />
        <text className="trust-visual__value" x="174" y="96">{copy.lot}</text>
        <text className="trust-visual__value trust-visual__value--small" x="174" y="114">{copy.origin}</text>
        <circle className="trust-visual__positive-fill" cx="280" cy="54" r="9" />
        <path className="trust-visual__positive-mark" d="m276 54 3 3 5-6" />
      </g>
    </svg>
  );
}

function SignalVisual({ copy }: { copy: VisualCopy }) {
  return (
    <svg viewBox="0 0 320 150" fill="none" focusable="false">
      <rect className="trust-visual__surface" x="24" y="17" width="70" height="116" rx="20" />
      <path className="trust-visual__line" d="M47 29h24M52 121h14" />
      <rect className="trust-visual__tag" x="42" y="49" width="34" height="34" rx="8" />
      <path className="trust-visual__accent" d="M49 57h7v7h-7zM62 57h7v7h-7zM49 70h7v7h-7zM63 69h3v3h3v5h-7v-4" />
      <text className="trust-visual__phone-label" x="59" y="101" textAnchor="middle">RA-2407</text>

      <path className="trust-visual__route trust-visual__animated" d="M95 75h57" />
      <path className="trust-visual__wave trust-visual__animated" d="M107 65a14 14 0 0 1 0 20M116 58a24 24 0 0 1 0 34" />

      <g className="trust-visual__result trust-visual__animated">
        <rect className="trust-visual__surface" x="154" y="22" width="144" height="106" rx="19" />
        <text className="trust-visual__eyebrow" x="169" y="40">{copy.digitalResult}</text>
        <circle className="trust-visual__positive-fill" cx="174" cy="59" r="9" />
        <path className="trust-visual__positive-mark trust-visual__check" d="m170 59 3 3 6-7" />
        <text className="trust-visual__status" x="190" y="62">{copy.validReading}</text>
        <rect className="trust-visual__status-pill" x="168" y="74" width="72" height="17" rx="8.5" />
        <text className="trust-visual__status-pill-text" x="204" y="85" textAnchor="middle">{copy.controls}</text>
        <text className="trust-visual__time" x="248" y="85">14:32</text>
        <text className="trust-visual__limit" x="169" y="108">{copy.physicalLimit}</text>
        <rect className="trust-visual__progress-track" x="169" y="116" width="112" height="5" rx="2.5" />
        <rect className="trust-visual__progress trust-visual__animated" x="169" y="116" width="112" height="5" rx="2.5" />
      </g>
    </svg>
  );
}

function AftercareVisual({ copy }: { copy: VisualCopy }) {
  return (
    <svg viewBox="0 0 320 150" fill="none" focusable="false">
      <text className="trust-visual__eyebrow" x="25" y="21">{copy.sample}</text>
      <path
        className="trust-visual__surface trust-visual__product"
        d="M48 31h20v12c8 4 13 11 13 19v42c0 10-7 17-17 17h-12c-10 0-17-7-17-17V62c0-8 5-15 13-19V31Z"
      />
      <path className="trust-visual__line" d="M48 39h20M41 59h34" />
      <rect className="trust-visual__tag" x="44" y="70" width="28" height="27" rx="8" />
      <path className="trust-visual__positive-mark" d="m51 83 4 4 9-10" />

      <path className="trust-visual__route trust-visual__animated" d="M82 77h43c18 0 14-38 34-38h25M125 77h59M125 77c18 0 14 38 34 38h25" />

      <text className="trust-visual__eyebrow" x="192" y="12">{copy.programOptions}</text>
      <g className="trust-visual__action trust-visual__action--one trust-visual__animated">
        <rect className="trust-visual__surface" x="186" y="17" width="112" height="39" rx="12" />
        <path className="trust-visual__accent" d="M204 27l8 3v7c0 5-3 9-8 11-5-2-8-6-8-11v-7l8-3Z" />
        <text className="trust-visual__action-label" x="220" y="34">{copy.warranty}</text>
        <text className="trust-visual__action-value" x="220" y="47">{copy.available}</text>
      </g>
      <g className="trust-visual__action trust-visual__action--two trust-visual__animated">
        <rect className="trust-visual__surface" x="186" y="58" width="112" height="36" rx="12" />
        <path className="trust-visual__accent" d="M196 70h16v13h-16zM204 68v15M194 73h20M200 68c-4-4 0-7 4 0M208 68c4-4 0-7-4 0" />
        <text className="trust-visual__action-label" x="220" y="72">{copy.benefit}</text>
        <text className="trust-visual__action-value trust-visual__action-value--small" x="220" y="84">{copy.brandExperience}</text>
      </g>
      <g className="trust-visual__action trust-visual__action--three trust-visual__animated">
        <rect className="trust-visual__surface" x="186" y="96" width="112" height="39" rx="12" />
        <path className="trust-visual__accent" d="M195 107h18v13h-10l-6 5v-5h-2z" />
        <text className="trust-visual__action-label" x="220" y="111">{copy.support}</text>
        <text className="trust-visual__action-value trust-visual__action-value--small" x="220" y="124">{copy.channelEnabled}</text>
      </g>
    </svg>
  );
}
