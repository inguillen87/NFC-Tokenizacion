import Image from "next/image";

export type SimpleTrustVisualKind = "discover" | "signal" | "aftercare";

type VisualCopy = {
  sample: string;
  connectedProduct: string;
  wine: string;
  parcel: string;
  pouch: string;
  lot: string;
  digitalResult: string;
  validReading: string;
  labelRead: string;
  programOptions: string;
  warranty: string;
  benefit: string;
  support: string;
};

const VISUAL_COPY: Record<"es-AR" | "en" | "pt-BR", VisualCopy> = {
  "es-AR": {
    sample: "DEMO ILUSTRATIVA",
    connectedProduct: "PRODUCTO CONECTADO",
    wine: "Reserva Andina",
    parcel: "Paquete identificado",
    pouch: "Experiencia activa",
    lot: "LOTE RA-2407",
    digitalResult: "RESULTADO DIGITAL",
    validReading: "LECTURA RECIBIDA",
    labelRead: "ETIQUETA LEÍDA",
    programOptions: "ELEGÍ CÓMO SEGUIR",
    warranty: "Activar garantía",
    benefit: "Ver beneficios",
    support: "Hablar con la marca",
  },
  en: {
    sample: "ILLUSTRATIVE DEMO",
    connectedProduct: "CONNECTED PRODUCT",
    wine: "Andean Reserve",
    parcel: "Identified parcel",
    pouch: "Active experience",
    lot: "BATCH RA-2407",
    digitalResult: "DIGITAL RESULT",
    validReading: "READ RECEIVED",
    labelRead: "TAG READ",
    programOptions: "CHOOSE WHAT COMES NEXT",
    warranty: "Activate warranty",
    benefit: "View benefits",
    support: "Contact the brand",
  },
  "pt-BR": {
    sample: "DEMO ILUSTRATIVA",
    connectedProduct: "PRODUTO CONECTADO",
    wine: "Reserva Andina",
    parcel: "Pacote identificado",
    pouch: "Experiência ativa",
    lot: "LOTE RA-2407",
    digitalResult: "RESULTADO DIGITAL",
    validReading: "LEITURA RECEBIDA",
    labelRead: "ETIQUETA LIDA",
    programOptions: "ESCOLHA O PRÓXIMO PASSO",
    warranty: "Ativar garantia",
    benefit: "Ver benefícios",
    support: "Falar com a marca",
  },
};

const PHOTO_BY_KIND: Record<SimpleTrustVisualKind, string> = {
  discover: "/landing/connected-journey/nfc-wine-scan.png",
  signal: "/landing/connected-journey/nfc-parcel-result.png",
  aftercare: "/landing/connected-journey/nfc-pouch-actions.png",
};

export function SimpleTrustStepVisual({ kind, locale }: { kind: SimpleTrustVisualKind; locale: string }) {
  const normalizedLocale = locale === "en" || locale === "pt-BR" ? locale : "es-AR";
  const copy = VISUAL_COPY[normalizedLocale];

  return (
    <div
      className={`simple-trust-flow-visual simple-trust-flow-visual--${kind} trust-photo`}
      data-trust-scene={kind}
      aria-hidden="true"
    >
      <Image
        src={PHOTO_BY_KIND[kind]}
        alt=""
        fill
        quality={75}
        sizes="(max-width: 760px) calc(100vw - 4.5rem), (max-width: 1100px) calc(50vw - 3.5rem), 29vw"
        className="trust-photo__image trust-visual__device trust-visual__animated"
      />
      <span className="trust-photo__scrim" />
      {kind === "discover" ? (
        <DiscoverOverlay copy={copy} />
      ) : kind === "signal" ? (
        <SignalOverlay copy={copy} />
      ) : (
        <AftercareOverlay copy={copy} />
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg className="trust-photo__check" viewBox="0 0 20 20" fill="none" focusable="false">
      <circle cx="10" cy="10" r="8.5" />
      <path className="trust-visual__check trust-visual__animated" pathLength="1" d="m6.3 10.2 2.3 2.4 5-5.4" />
    </svg>
  );
}

function DiscoverOverlay({ copy }: { copy: VisualCopy }) {
  return (
    <>
      <svg className="trust-photo__signal-layer" viewBox="0 0 100 50" fill="none" focusable="false">
        <circle className="trust-visual__nfc-ring trust-visual__animated" cx="31.5" cy="25.5" r="4.4" />
        <circle className="trust-visual__nfc-ring trust-visual__nfc-ring--outer trust-visual__animated" cx="31.5" cy="25.5" r="7.2" />
        <path className="trust-visual__route trust-visual__animated" pathLength="1" d="M39 25.5c8 0 10-8 19-8 7 0 10 3 15 6" />
        <circle className="trust-visual__traveller trust-visual__animated" cx="51" cy="21" r="1.25" />
      </svg>
      <span className="trust-photo__tag-label trust-visual__tag-group trust-visual__animated">NFC</span>
      <div className="trust-photo__info-card trust-photo__info-card--discover trust-visual__card trust-visual__animated">
        <span>{copy.sample}</span>
        <strong>{copy.wine}</strong>
        <small>{copy.lot}</small>
        <CheckMark />
      </div>
    </>
  );
}

function SignalOverlay({ copy }: { copy: VisualCopy }) {
  return (
    <>
      <svg className="trust-photo__signal-layer" viewBox="0 0 100 50" fill="none" focusable="false">
        <circle className="trust-visual__nfc-ring trust-visual__animated" cx="35.5" cy="33" r="4" />
        <path className="trust-visual__wave trust-visual__animated" d="M40 29.4a5 5 0 0 1 0 7.2M43 27a8.2 8.2 0 0 1 0 12" />
        <path className="trust-visual__route trust-visual__animated" pathLength="1" d="M47 33c7 0 11-5 18-6" />
        <circle className="trust-visual__traveller trust-visual__animated" cx="55" cy="30" r="1.2" />
      </svg>
      <div className="trust-photo__info-card trust-photo__info-card--result trust-visual__result trust-visual__animated">
        <span>{copy.digitalResult}</span>
        <strong><CheckMark />{copy.validReading}</strong>
        <small>{copy.parcel}</small>
        <span className="trust-photo__meter"><i className="trust-visual__progress trust-visual__animated" /></span>
        <em>{copy.labelRead}</em>
      </div>
    </>
  );
}

function AftercareOverlay({ copy }: { copy: VisualCopy }) {
  const actions = [copy.warranty, copy.benefit, copy.support];

  return (
    <>
      <svg className="trust-photo__signal-layer" viewBox="0 0 100 50" fill="none" focusable="false">
        <circle className="trust-visual__nfc-ring trust-visual__animated" cx="41.5" cy="17.5" r="4.1" />
        <path className="trust-visual__route trust-visual__animated" pathLength="1" d="M47 18c10 0 12 9 20 9" />
        <circle className="trust-visual__traveller trust-visual__animated" cx="56" cy="22" r="1.2" />
      </svg>
      <div className="trust-photo__actions">
        <span className="trust-photo__actions-label">{copy.programOptions}</span>
        {actions.map((action, index) => (
          <span
            key={action}
            className={`trust-photo__action trust-visual__action trust-visual__action--${["one", "two", "three"][index]} trust-visual__animated`}
          >
            <i aria-hidden="true">{index === 0 ? "✓" : index === 1 ? "+" : "↗"}</i>
            {action}
          </span>
        ))}
      </div>
      <span className="trust-photo__product-note trust-visual__card trust-visual__animated">
        <small>{copy.connectedProduct}</small>
        <strong>{copy.pouch}</strong>
      </span>
    </>
  );
}
