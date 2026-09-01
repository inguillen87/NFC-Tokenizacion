import Image from "next/image";
import type { CSSProperties } from "react";

export type SimpleTrustVisualKind = "discover" | "signal" | "aftercare";
export type SimpleTrustIndustry = "bottles" | "perfume" | "agro";

export const SIMPLE_TRUST_DEFAULT_INDUSTRY: SimpleTrustIndustry = "bottles";

type ProductVisualCopy = {
  product: string;
  lot: string;
  experienceActive: string;
  actions: readonly [string, string, string];
};

type VisualCopy = {
  sample: string;
  connectedProduct: string;
  validReading: string;
  labelRead: string;
  phoneScreen: string;
  programOptions: string;
  products: Record<SimpleTrustIndustry, ProductVisualCopy>;
};

const VISUAL_COPY: Record<"es-AR" | "en" | "pt-BR", VisualCopy> = {
  "es-AR": {
    sample: "DEMO ILUSTRATIVA",
    connectedProduct: "PRODUCTO CONECTADO",
    validReading: "LECTURA RECIBIDA",
    labelRead: "ETIQUETA LEÍDA",
    phoneScreen: "EN EL CELULAR",
    programOptions: "PRÓXIMAS ACCIONES",
    products: {
      bottles: {
        product: "Reserva Andina",
        lot: "LOTE RA-2407",
        experienceActive: "Experiencia activa",
        actions: ["Ver ficha del lote", "Acceder a beneficios", "Hablar con la marca"],
      },
      perfume: {
        product: "Esencia Aurora",
        lot: "SERIE EA-2047",
        experienceActive: "Experiencia activa",
        actions: ["Activar garantía", "Ver beneficios", "Hablar con la marca"],
      },
      agro: {
        product: "Insumo Horizonte",
        lot: "LOTE IH-2407",
        experienceActive: "Experiencia activa",
        actions: ["Consultar el lote", "Ver documentación", "Contactar soporte"],
      },
    },
  },
  en: {
    sample: "ILLUSTRATIVE DEMO",
    connectedProduct: "CONNECTED PRODUCT",
    validReading: "READ RECEIVED",
    labelRead: "TAG READ",
    phoneScreen: "ON THE PHONE",
    programOptions: "NEXT ACTIONS",
    products: {
      bottles: {
        product: "Andean Reserve",
        lot: "BATCH RA-2407",
        experienceActive: "Active experience",
        actions: ["View batch details", "Access benefits", "Contact the brand"],
      },
      perfume: {
        product: "Aurora Essence",
        lot: "SERIES EA-2047",
        experienceActive: "Active experience",
        actions: ["Activate warranty", "View benefits", "Contact the brand"],
      },
      agro: {
        product: "Horizon Input",
        lot: "BATCH IH-2407",
        experienceActive: "Active experience",
        actions: ["Check the batch", "View documentation", "Contact support"],
      },
    },
  },
  "pt-BR": {
    sample: "DEMO ILUSTRATIVA",
    connectedProduct: "PRODUTO CONECTADO",
    validReading: "LEITURA RECEBIDA",
    labelRead: "ETIQUETA LIDA",
    phoneScreen: "NO CELULAR",
    programOptions: "PRÓXIMAS AÇÕES",
    products: {
      bottles: {
        product: "Reserva Andina",
        lot: "LOTE RA-2407",
        experienceActive: "Experiência ativa",
        actions: ["Ver dados do lote", "Acessar benefícios", "Falar com a marca"],
      },
      perfume: {
        product: "Essência Aurora",
        lot: "SÉRIE EA-2047",
        experienceActive: "Experiência ativa",
        actions: ["Ativar garantia", "Ver benefícios", "Falar com a marca"],
      },
      agro: {
        product: "Insumo Horizonte",
        lot: "LOTE IH-2407",
        experienceActive: "Experiência ativa",
        actions: ["Consultar o lote", "Ver documentação", "Falar com o suporte"],
      },
    },
  },
};

const PHOTO_BY_KIND: Record<SimpleTrustVisualKind, string> = {
  discover: "/landing/connected-journey/wine-journey-01.webp",
  signal: "/landing/connected-journey/wine-journey-02.webp",
  aftercare: "/landing/connected-journey/wine-journey-03.webp",
};

const PHOTO_BY_INDUSTRY: Record<SimpleTrustIndustry, Record<SimpleTrustVisualKind, string>> = {
  bottles: PHOTO_BY_KIND,
  perfume: {
    discover: "/landing/connected-journey/perfume-journey-01.webp",
    signal: "/landing/connected-journey/perfume-journey-02.webp",
    aftercare: "/landing/connected-journey/perfume-journey-03.webp",
  },
  agro: {
    discover: "/landing/connected-journey/agro-journey-01.webp",
    signal: "/landing/connected-journey/agro-journey-02.webp",
    aftercare: "/landing/connected-journey/agro-journey-03.webp",
  },
};

type ScenePoint = { x: number; y: number };

type IndustryVisualMeta = {
  productId: string;
  photoBase: string;
  actionKinds: readonly [string, string, string];
  tag: ScenePoint;
  phone: ScenePoint;
  phoneOutline: {
    left: string;
    top: string;
    width: string;
    height: string;
    rotate: string;
    enterX: string;
    enterY: string;
  };
};

const INDUSTRY_VISUAL_META: Record<SimpleTrustIndustry, IndustryVisualMeta> = {
  bottles: {
    productId: "reserva-andina",
    photoBase: "reserva-andina-wine",
    actionKinds: ["batch-details", "benefits", "brand-support"],
    tag: { x: 31.2, y: 22.7 },
    phone: { x: 54, y: 25.5 },
    phoneOutline: { left: "39.5%", top: "12%", width: "22%", height: "72%", rotate: "-31deg", enterX: "1.25rem", enterY: "0.35rem" },
  },
  perfume: {
    productId: "esencia-aurora",
    photoBase: "esencia-aurora-perfume",
    actionKinds: ["warranty", "benefits", "brand-support"],
    tag: { x: 43.7, y: 35.4 },
    phone: { x: 61.5, y: 36 },
    phoneOutline: { left: "55%", top: "48%", width: "16%", height: "64%", rotate: "-68deg", enterX: "1.1rem", enterY: "-0.2rem" },
  },
  agro: {
    productId: "insumo-horizonte",
    photoBase: "insumo-horizonte-agro",
    actionKinds: ["batch-details", "documentation", "technical-support"],
    tag: { x: 43.6, y: 23.6 },
    phone: { x: 57.5, y: 29.5 },
    phoneOutline: { left: "50%", top: "30%", width: "18%", height: "56%", rotate: "-32deg", enterX: "1.15rem", enterY: "0.25rem" },
  },
};

type TrustSceneStyle = CSSProperties & {
  "--trust-tag-left": string;
  "--trust-tag-top": string;
  "--trust-tag-label-left": string;
  "--trust-tag-label-top": string;
  "--trust-phone-left": string;
  "--trust-phone-top": string;
  "--trust-phone-width": string;
  "--trust-phone-height": string;
  "--trust-phone-rotate": string;
  "--trust-phone-enter-x": string;
  "--trust-phone-enter-y": string;
};

function sceneStyle(meta: IndustryVisualMeta): TrustSceneStyle {
  return {
    "--trust-tag-left": `${meta.tag.x}%`,
    "--trust-tag-top": `${meta.tag.y * 2}%`,
    "--trust-tag-label-left": `${Math.max(2, meta.tag.x - 4)}%`,
    "--trust-tag-label-top": `${Math.max(2, meta.tag.y * 2 - 7)}%`,
    "--trust-phone-left": meta.phoneOutline.left,
    "--trust-phone-top": meta.phoneOutline.top,
    "--trust-phone-width": meta.phoneOutline.width,
    "--trust-phone-height": meta.phoneOutline.height,
    "--trust-phone-rotate": meta.phoneOutline.rotate,
    "--trust-phone-enter-x": meta.phoneOutline.enterX,
    "--trust-phone-enter-y": meta.phoneOutline.enterY,
  };
}

function signalRoute(meta: IndustryVisualMeta, direction: "to-tag" | "to-phone", yOffset = 0): string {
  const tag = { x: meta.tag.x + 5.7, y: meta.tag.y + yOffset };
  const phone = { x: meta.phone.x - 3.2, y: meta.phone.y + yOffset };
  const start = direction === "to-tag" ? phone : tag;
  const end = direction === "to-tag" ? tag : phone;
  const delta = end.x - start.x;
  return `M${start.x} ${start.y} C${start.x + delta * 0.34} ${start.y - 2.2}, ${start.x + delta * 0.68} ${end.y + 1.8}, ${end.x} ${end.y}`;
}

export function resolveSimpleTrustIndustry(industry: string | null | undefined): SimpleTrustIndustry {
  return industry === "perfume" || industry === "agro" || industry === "bottles"
    ? industry
    : SIMPLE_TRUST_DEFAULT_INDUSTRY;
}

export function SimpleTrustStepVisual({
  kind,
  locale,
  industry = SIMPLE_TRUST_DEFAULT_INDUSTRY,
}: {
  kind: SimpleTrustVisualKind;
  locale: string;
  industry?: SimpleTrustIndustry;
}) {
  const normalizedLocale = locale === "en" || locale === "pt-BR" ? locale : "es-AR";
  const normalizedIndustry = resolveSimpleTrustIndustry(industry);
  const copy = VISUAL_COPY[normalizedLocale];
  const product = copy.products[normalizedIndustry];
  const visualMeta = INDUSTRY_VISUAL_META[normalizedIndustry];
  const photoByKind = PHOTO_BY_INDUSTRY[normalizedIndustry] ?? PHOTO_BY_KIND;
  const accessibleSummary = kind === "discover"
    ? `${copy.sample}: ${product.product}, ${product.lot}.`
    : kind === "signal"
      ? `${copy.phoneScreen}: ${copy.validReading}. ${product.product}, ${product.lot}.`
      : `${copy.phoneScreen}: ${copy.programOptions}: ${product.actions.join(", ")}.`;

  return (
    <>
      <div
        className={`simple-trust-flow-visual simple-trust-flow-visual--${kind} trust-photo`}
        data-trust-scene={kind}
        data-trust-phase={kind}
        data-trust-industry={normalizedIndustry}
        data-trust-product={visualMeta.productId}
        style={sceneStyle(visualMeta)}
        aria-hidden="true"
      >
        <Image
          src={photoByKind[kind]}
          alt=""
          fill
          quality={75}
          sizes="(max-width: 760px) calc(100vw - 4.5rem), (max-width: 1100px) calc(50vw - 3.5rem), 29vw"
          className={`trust-photo__image trust-visual__device trust-visual__scene-base trust-visual__scene-base--${kind} trust-visual__animated`}
          data-trust-photo-base={visualMeta.photoBase}
        />
        <span className="trust-photo__scrim" />
        {kind === "discover" ? (
          <DiscoverOverlay copy={copy} product={product} meta={visualMeta} />
        ) : kind === "signal" ? (
          <SignalOverlay copy={copy} product={product} meta={visualMeta} />
        ) : (
          <AftercareOverlay copy={copy} product={product} meta={visualMeta} />
        )}
      </div>
      <span className="sr-only" data-trust-scene-summary={kind}>{accessibleSummary}</span>
    </>
  );
}

function ProductTagMarker({ productId }: { productId: string }) {
  return (
    <>
      <span
        className="trust-photo__tag-anchor trust-visual__tag-anchor trust-visual__animated"
        data-trust-anchor={`${productId}-nfc-label`}
      />
      <span
        className="trust-photo__tag-label trust-visual__tag-group trust-visual__animated"
        data-trust-marker="nfc-label"
      >
        NFC
      </span>
    </>
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

function DiscoverOverlay({ copy, product, meta }: { copy: VisualCopy; product: ProductVisualCopy; meta: IndustryVisualMeta }) {
  const traveller = {
    x: (meta.phone.x + meta.tag.x) / 2,
    y: (meta.phone.y + meta.tag.y) / 2,
  };

  return (
    <>
      <span
        className="trust-photo__phone-motion trust-photo__phone-motion--approach trust-visual__phone-approach trust-visual__animated"
        data-trust-motion="phone-approach"
      />
      <ProductTagMarker productId={meta.productId} />
      <svg
        className="trust-photo__signal-layer trust-photo__signal-layer--approach"
        data-trust-exchange="phone-to-tag"
        viewBox="0 0 100 50"
        fill="none"
        focusable="false"
      >
        <circle className="trust-visual__nfc-ring trust-visual__animated" cx={meta.tag.x} cy={meta.tag.y} r="4.4" />
        <circle className="trust-visual__nfc-ring trust-visual__nfc-ring--outer trust-visual__animated" cx={meta.tag.x} cy={meta.tag.y} r="7.2" />
        <path className="trust-visual__route trust-visual__route--approach trust-visual__animated" pathLength="1" d={signalRoute(meta, "to-tag")} />
        <circle className="trust-visual__traveller trust-visual__traveller--reverse trust-visual__animated" cx={traveller.x} cy={traveller.y} r="1.25" />
      </svg>
      <div
        className="trust-photo__info-card trust-photo__info-card--discover trust-visual__card trust-visual__animated"
        data-trust-state="product-discovered"
      >
        <span>{copy.sample}</span>
        <strong>{product.product}</strong>
        <small>{product.lot}</small>
        <CheckMark />
      </div>
    </>
  );
}

function SignalOverlay({ copy, product, meta }: { copy: VisualCopy; product: ProductVisualCopy; meta: IndustryVisualMeta }) {
  const requestPacket = {
    x: meta.tag.x + (meta.phone.x - meta.tag.x) * 0.48,
    y: meta.tag.y + (meta.phone.y - meta.tag.y) * 0.48,
  };

  return (
    <>
      <ProductTagMarker productId={meta.productId} />
      <svg
        className="trust-photo__signal-layer trust-photo__signal-layer--reading"
        data-trust-exchange="read-and-response"
        viewBox="0 0 100 50"
        fill="none"
        focusable="false"
      >
        <circle className="trust-visual__nfc-ring trust-visual__read-pulse trust-visual__animated" cx={meta.tag.x} cy={meta.tag.y} r="4.4" />
        <circle className="trust-visual__nfc-ring trust-visual__nfc-ring--outer trust-visual__read-pulse trust-visual__animated" cx={meta.tag.x} cy={meta.tag.y} r="7.2" />
        <path
          className="trust-visual__wave trust-visual__read-wave trust-visual__animated"
          d={`M${meta.tag.x + 6.3} ${meta.tag.y - 3.7}a5 5 0 0 1 0 7.2M${meta.tag.x + 9.3} ${meta.tag.y - 6.1}a8.2 8.2 0 0 1 0 12`}
        />
        <path className="trust-visual__route trust-visual__read-request trust-visual__animated" pathLength="1" d={signalRoute(meta, "to-phone", -1.1)} />
        <path className="trust-visual__route trust-visual__response-route trust-visual__response-return trust-visual__animated" pathLength="1" d={signalRoute(meta, "to-tag", 1.7)} />
        <circle className="trust-visual__traveller trust-visual__read-packet trust-visual__animated" cx={requestPacket.x} cy={requestPacket.y - 1.1} r="1.2" />
        <circle className="trust-visual__traveller trust-visual__response-packet trust-visual__animated" cx={requestPacket.x + 1.8} cy={requestPacket.y + 1.7} r="1.2" />
      </svg>
      <div
        className="trust-photo__info-card trust-photo__info-card--result trust-photo__phone-ui trust-photo__phone-ui--result trust-visual__result trust-visual__response-state trust-visual__animated"
        data-trust-state="response-ready"
      >
        <span className="trust-photo__phone-kicker"><i className="trust-visual__phone-live trust-visual__animated" />{copy.phoneScreen}</span>
        <strong><CheckMark />{copy.validReading}</strong>
        <small className="trust-photo__phone-product"><b>{product.product}</b><span>{product.lot}</span></small>
        <span className="trust-photo__meter"><i className="trust-visual__progress trust-visual__animated" /></span>
        <em>{copy.labelRead}</em>
      </div>
    </>
  );
}

function AftercareOverlay({ copy, product, meta }: { copy: VisualCopy; product: ProductVisualCopy; meta: IndustryVisualMeta }) {
  const actionPacket = {
    x: meta.tag.x + (meta.phone.x - meta.tag.x) * 0.5,
    y: meta.tag.y + (meta.phone.y - meta.tag.y) * 0.5,
  };

  return (
    <>
      <ProductTagMarker productId={meta.productId} />
      <svg
        className="trust-photo__signal-layer trust-photo__signal-layer--actions"
        data-trust-exchange="response-to-actions"
        viewBox="0 0 100 50"
        fill="none"
        focusable="false"
      >
        <circle className="trust-visual__nfc-ring trust-visual__animated" cx={meta.tag.x} cy={meta.tag.y} r="4.4" />
        <path className="trust-visual__route trust-visual__route--actions trust-visual__animated" pathLength="1" d={signalRoute(meta, "to-phone")} />
        <circle className="trust-visual__traveller trust-visual__action-packet trust-visual__animated" cx={actionPacket.x} cy={actionPacket.y} r="1.2" />
      </svg>
      <div className="trust-photo__actions trust-photo__phone-ui trust-photo__phone-ui--actions trust-visual__actions-state trust-visual__card trust-visual__animated" data-trust-state="actions-ready">
        <span className="trust-photo__phone-kicker"><i className="trust-visual__phone-live trust-visual__animated" />{copy.phoneScreen}</span>
        <strong className="trust-photo__actions-product">{product.product}</strong>
        <span className="trust-photo__actions-label">{copy.programOptions}</span>
        {product.actions.map((action, index) => (
          <span
            key={action}
            className={`trust-photo__action trust-visual__action trust-visual__action--${["one", "two", "three"][index]} trust-visual__animated`}
            data-trust-action={meta.actionKinds[index] ?? "support"}
          >
            <i aria-hidden="true">{index === 0 ? "✓" : index === 1 ? "+" : "↗"}</i>
            {action}
          </span>
        ))}
      </div>
      <span
        className="trust-photo__product-note trust-visual__card trust-visual__animated"
        data-trust-state="connected-product-active"
      >
        <small>{copy.connectedProduct}</small>
        <strong>{product.product}</strong>
        <em className="trust-photo__product-status">{product.experienceActive}</em>
      </span>
    </>
  );
}
