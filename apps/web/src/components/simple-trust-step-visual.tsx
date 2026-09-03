import Image from "next/image";
import type { CSSProperties } from "react";

export type SimpleTrustVisualKind = "discover" | "signal" | "aftercare";
export type SimpleTrustIndustry = "bottles" | "perfume" | "agro";

export const SIMPLE_TRUST_DEFAULT_INDUSTRY: SimpleTrustIndustry = "bottles";

type ProductVisualCopy = {
  product: string;
  lot: string;
  actions: readonly [string, string, string];
};

type VisualCopy = {
  sample: string;
  detectedProduct: string;
  validReading: string;
  labelRead: string;
  phoneScreen: string;
  programOptions: string;
  products: Record<SimpleTrustIndustry, ProductVisualCopy>;
};

const VISUAL_COPY: Record<"es-AR" | "en" | "pt-BR", VisualCopy> = {
  "es-AR": {
    sample: "EJEMPLO ILUSTRATIVO",
    detectedProduct: "IDENTIDAD VINCULADA",
    validReading: "PASAPORTE ABIERTO",
    labelRead: "REGISTRO VINCULADO",
    phoneScreen: "EN EL CELULAR",
    programOptions: "INFORMACIÓN Y SERVICIOS",
    products: {
      bottles: {
        product: "Reserva Andina",
        lot: "LOTE RA-2407",
        actions: ["Ver origen y lote", "Cómo disfrutarlo", "Contactar a la bodega"],
      },
      perfume: {
        product: "Estuche Aurora",
        lot: "PARTIDA EA-2047",
        actions: ["Ver materiales", "Cómo reciclar", "Contactar al fabricante"],
      },
      agro: {
        product: "Insumo Horizonte",
        lot: "LOTE IH-2407",
        actions: ["Ver ficha y lote", "Documentación vigente", "Contactar soporte"],
      },
    },
  },
  en: {
    sample: "ILLUSTRATIVE EXAMPLE",
    detectedProduct: "IDENTITY LINKED",
    validReading: "PASSPORT OPEN",
    labelRead: "RECORD LINKED",
    phoneScreen: "ON THE PHONE",
    programOptions: "INFORMATION AND SERVICES",
    products: {
      bottles: {
        product: "Andean Reserve",
        lot: "BATCH RA-2407",
        actions: ["View origin and batch", "Serving guidance", "Contact the winery"],
      },
      perfume: {
        product: "Aurora Case",
        lot: "RUN EA-2047",
        actions: ["View materials", "How to recycle", "Contact manufacturer"],
      },
      agro: {
        product: "Horizon Input",
        lot: "BATCH IH-2407",
        actions: ["View record and batch", "Current documentation", "Contact support"],
      },
    },
  },
  "pt-BR": {
    sample: "EXEMPLO ILUSTRATIVO",
    detectedProduct: "IDENTIDADE VINCULADA",
    validReading: "PASSAPORTE ABERTO",
    labelRead: "REGISTRO VINCULADO",
    phoneScreen: "NO CELULAR",
    programOptions: "INFORMAÇÕES E SERVIÇOS",
    products: {
      bottles: {
        product: "Reserva Andina",
        lot: "LOTE RA-2407",
        actions: ["Ver origem e lote", "Como aproveitar", "Falar com a vinícola"],
      },
      perfume: {
        product: "Estojo Aurora",
        lot: "PARTIDA EA-2047",
        actions: ["Ver materiais", "Como reciclar", "Falar com o fabricante"],
      },
      agro: {
        product: "Insumo Horizonte",
        lot: "LOTE IH-2407",
        actions: ["Ver ficha e lote", "Documentação atual", "Falar com o suporte"],
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
    discover: "/landing/connected-journey/packaging-journey-01.webp",
    signal: "/landing/connected-journey/packaging-journey-02.webp",
    aftercare: "/landing/connected-journey/packaging-journey-03.webp",
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
    actionKinds: ["origin-and-batch", "serving-guidance", "winery-contact"],
    tag: { x: 31.2, y: 22.7 },
    phone: { x: 54, y: 25.5 },
    phoneOutline: { left: "39.5%", top: "12%", width: "22%", height: "72%", rotate: "-31deg", enterX: "1.25rem", enterY: "0.35rem" },
  },
  perfume: {
    productId: "estuche-aurora",
    photoBase: "estuche-aurora-packaging",
    actionKinds: ["materials", "recycling-guidance", "manufacturer-contact"],
    tag: { x: 43.7, y: 35.4 },
    phone: { x: 61.5, y: 36 },
    phoneOutline: { left: "55%", top: "48%", width: "16%", height: "64%", rotate: "-68deg", enterX: "1.1rem", enterY: "-0.2rem" },
  },
  agro: {
    productId: "insumo-horizonte",
    photoBase: "insumo-horizonte-agro",
    actionKinds: ["product-and-batch", "current-documentation", "technical-support"],
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
        className={`simple-trust-step-visual-shell simple-trust-step-visual-shell--${kind} trust-photo-frame`}
        data-trust-scene={kind}
        data-trust-phase={kind}
        data-trust-industry={normalizedIndustry}
        data-trust-product={visualMeta.productId}
        style={sceneStyle(visualMeta)}
        aria-hidden="true"
      >
        <TrustCallout kind={kind} copy={copy} product={product} meta={visualMeta} />
        <div className={`simple-trust-flow-visual simple-trust-flow-visual--${kind} trust-photo`}>
          <Image
            src={photoByKind[kind]}
            alt=""
            fill
            quality={75}
            loading={kind === "discover" ? "eager" : "lazy"}
            fetchPriority={kind === "discover" ? "high" : undefined}
            sizes="(max-width: 760px) calc(100vw - 4.5rem), (max-width: 1100px) calc(50vw - 3.5rem), 29vw"
            className={`trust-photo__image trust-visual__device trust-visual__scene-base trust-visual__scene-base--${kind} trust-visual__animated`}
            data-trust-photo-base={visualMeta.photoBase}
          />
          <span className="trust-photo__scrim" />
          {kind === "discover" ? (
            <DiscoverOverlay meta={visualMeta} />
          ) : kind === "signal" ? (
            <SignalOverlay meta={visualMeta} />
          ) : (
            <AftercareOverlay meta={visualMeta} />
          )}
        </div>
      </div>
      <span className="sr-only" data-trust-scene-summary={kind}>{accessibleSummary}</span>
    </>
  );
}

function TrustCallout({
  kind,
  copy,
  product,
  meta,
}: {
  kind: SimpleTrustVisualKind;
  copy: VisualCopy;
  product: ProductVisualCopy;
  meta: IndustryVisualMeta;
}) {
  if (kind === "discover") {
    return (
      <div
        className="trust-photo__info-card trust-photo__info-card--discover trust-photo__callout trust-photo__callout--discover trust-visual__card trust-visual__animated"
        data-trust-state="product-discovered"
      >
        <span className="trust-photo__callout-heading">{copy.detectedProduct}</span>
        <em className="trust-photo__demo-label">{copy.sample}</em>
        <strong>{product.product}</strong>
        <small>{product.lot}</small>
        <CheckMark />
      </div>
    );
  }

  if (kind === "signal") {
    return (
      <div
        className="trust-photo__info-card trust-photo__info-card--result trust-photo__phone-ui trust-photo__phone-ui--result trust-photo__callout trust-photo__callout--signal trust-visual__result trust-visual__response-state trust-visual__animated"
        data-trust-state="response-ready"
      >
        <span className="trust-photo__phone-kicker"><i className="trust-visual__phone-live trust-visual__animated" />{copy.phoneScreen}</span>
        <strong><CheckMark />{copy.validReading}</strong>
        <small className="trust-photo__phone-product"><b>{product.product}</b><span>{product.lot}</span></small>
        <span className="trust-photo__meter"><i className="trust-visual__progress trust-visual__animated" /></span>
      </div>
    );
  }

  return (
    <div className="trust-photo__actions trust-photo__phone-ui trust-photo__phone-ui--actions trust-photo__callout trust-photo__callout--aftercare trust-visual__actions-state trust-visual__card trust-visual__animated" data-trust-state="actions-ready">
      <span className="trust-photo__phone-kicker"><i className="trust-visual__phone-live trust-visual__animated" />{copy.phoneScreen}</span>
      <strong className="trust-photo__actions-product">{product.product}</strong>
      <span className="trust-photo__actions-label">{copy.programOptions}</span>
      <div className="trust-photo__action-grid">
        {product.actions.map((action, index) => (
          <span
            key={action}
            className={`trust-photo__action trust-visual__action trust-visual__action--${["one", "two", "three"][index]} trust-visual__animated`}
            data-trust-action={meta.actionKinds[index] ?? "support"}
          >
            <i aria-hidden="true">{index === 0 ? "✓" : index === 1 ? "+" : "↗"}</i>
            <span>{action}</span>
          </span>
        ))}
      </div>
    </div>
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

function DiscoverOverlay({ meta }: { meta: IndustryVisualMeta }) {
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
      <ContinuousRfExchange meta={meta} direction="to-tag" />
    </>
  );
}

function SignalOverlay({ meta }: { meta: IndustryVisualMeta }) {
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
      <ContinuousRfExchange meta={meta} direction="both" />
    </>
  );
}

function AftercareOverlay({ meta }: { meta: IndustryVisualMeta }) {
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
      <ContinuousRfExchange meta={meta} direction="to-phone" />
    </>
  );
}

function ContinuousRfExchange({
  meta,
  direction,
}: {
  meta: IndustryVisualMeta;
  direction: "to-tag" | "to-phone" | "both";
}) {
  const midpoint = {
    x: meta.tag.x + (meta.phone.x - meta.tag.x) * 0.5,
    y: meta.tag.y + (meta.phone.y - meta.tag.y) * 0.5,
  };

  return (
    <svg
      className="trust-photo__signal-layer trust-photo__signal-layer--continuous"
      data-trust-live-exchange={direction}
      viewBox="0 0 100 50"
      fill="none"
      focusable="false"
    >
      <circle className="trust-photo__rf-orbit trust-photo__rf-orbit--one" cx={meta.tag.x} cy={meta.tag.y} r="4.6" />
      <circle className="trust-photo__rf-orbit trust-photo__rf-orbit--two" cx={meta.tag.x} cy={meta.tag.y} r="7.4" />
      <path className="trust-photo__rf-stream trust-photo__rf-stream--out" pathLength="1" d={signalRoute(meta, direction === "to-tag" ? "to-tag" : "to-phone", -0.7)} />
      {direction === "both" ? (
        <path className="trust-photo__rf-stream trust-photo__rf-stream--return" pathLength="1" d={signalRoute(meta, "to-tag", 1.4)} />
      ) : null}
      <circle className="trust-photo__rf-packet trust-photo__rf-packet--out" cx={midpoint.x} cy={midpoint.y - 0.7} r="0.78" />
      {direction === "both" ? (
        <circle className="trust-photo__rf-packet trust-photo__rf-packet--return" cx={midpoint.x + 1.4} cy={midpoint.y + 1.4} r="0.78" />
      ) : null}
    </svg>
  );
}
