"use client";

import {
  Check,
  ClipboardList,
  Package,
  PackageCheck,
  RadioTower,
  Settings2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type PreviewLocale = "es-AR" | "en" | "pt-BR";

type PreviewCopy = {
  visualLabel: string;
  previewNotice: string;
  beforeLabel: string;
  beforeTitle: string;
  beforeBody: string;
  beforeChannels: readonly [string, string, string];
  connector: string;
  afterLabel: string;
  afterTitle: string;
  afterBody: string;
  productName: string;
  productLot: string;
  ready: string;
  configureTitle: string;
  configureItems: readonly [string, string, string];
  recordTitle: string;
  recordItems: readonly [string, string];
  followup: string;
};

const PREVIEW_COPY: Record<PreviewLocale, PreviewCopy> = {
  "es-AR": {
    visualLabel: "Comparación ilustrativa entre un producto entregado y un producto conectado con nexID",
    previewNotice: "Ejemplo ilustrativo · Producto, lote y estados de muestra",
    beforeLabel: "Antes",
    beforeTitle: "Producto entregado",
    beforeBody: "La información y la postventa quedan repartidas en canales separados.",
    beforeChannels: ["Información", "Garantía", "Atención"],
    connector: "NFC o QR",
    afterLabel: "Con nexID",
    afterTitle: "Producto conectado",
    afterBody: "La etiqueta abre la experiencia que tu marca configuró para ese producto.",
    productName: "Reserva Andina",
    productLot: "Lote RA-2407",
    ready: "Experiencia lista",
    configureTitle: "Tu equipo configura",
    configureItems: [
      "Qué información ve el cliente",
      "Qué garantía, beneficio o atención se ofrece",
      "Qué contenido puede actualizarse",
    ],
    recordTitle: "nexID registra",
    recordItems: [
      "Las lecturas de la etiqueta",
      "Las acciones elegidas dentro de la experiencia",
    ],
    followup: "Tu equipo consulta esos registros para identificar qué necesita seguimiento.",
  },
  en: {
    visualLabel: "Illustrative comparison between a delivered product and a product connected with nexID",
    previewNotice: "Illustrative example · Sample product, batch and statuses",
    beforeLabel: "Before",
    beforeTitle: "Product delivered",
    beforeBody: "Information and after-sales support remain split across separate channels.",
    beforeChannels: ["Information", "Warranty", "Support"],
    connector: "NFC or QR",
    afterLabel: "With nexID",
    afterTitle: "Connected product",
    afterBody: "The tag opens the experience your brand configured for that product.",
    productName: "Andean Reserve",
    productLot: "Batch RA-2407",
    ready: "Experience ready",
    configureTitle: "Your team configures",
    configureItems: [
      "What information customers see",
      "Which warranty, benefit or support option is offered",
      "Which content can be updated",
    ],
    recordTitle: "nexID records",
    recordItems: [
      "Tag reads",
      "Actions selected within the experience",
    ],
    followup: "Your team reviews those records to identify what needs follow-up.",
  },
  "pt-BR": {
    visualLabel: "Comparação ilustrativa entre um produto entregue e um produto conectado com a nexID",
    previewNotice: "Exemplo ilustrativo · Produto, lote e estados de amostra",
    beforeLabel: "Antes",
    beforeTitle: "Produto entregue",
    beforeBody: "As informações e o pós-venda ficam distribuídos em canais separados.",
    beforeChannels: ["Informações", "Garantia", "Atendimento"],
    connector: "NFC ou QR",
    afterLabel: "Com nexID",
    afterTitle: "Produto conectado",
    afterBody: "A etiqueta abre a experiência configurada pela sua marca para esse produto.",
    productName: "Reserva Andina",
    productLot: "Lote RA-2407",
    ready: "Experiência pronta",
    configureTitle: "Sua equipe configura",
    configureItems: [
      "Quais informações o cliente vê",
      "Qual garantia, benefício ou atendimento é oferecido",
      "Qual conteúdo pode ser atualizado",
    ],
    recordTitle: "A nexID registra",
    recordItems: [
      "As leituras da etiqueta",
      "As ações escolhidas dentro da experiência",
    ],
    followup: "Sua equipe consulta esses registros para identificar o que precisa de acompanhamento.",
  },
};

function resolveLocale(locale: string): PreviewLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

export function BrandControlCenterPreview({ locale }: { locale: string }) {
  const copy = PREVIEW_COPY[resolveLocale(locale)];
  const [motionReady, setMotionReady] = useState(false);
  const [motionActive, setMotionActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotionQuery.matches) return;

    setMotionReady(true);
    if (typeof IntersectionObserver === "undefined") {
      setMotionActive(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.18) {
        setMotionActive(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -6%", threshold: [0, 0.18, 0.45] });

    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className="brand-control-preview"
      data-motion-ready={motionReady ? "true" : "false"}
      data-motion-active={motionActive ? "true" : "false"}
      aria-label={copy.visualLabel}
    >
      <div className="brand-control-preview__notice">
        <span aria-hidden="true" />
        {copy.previewNotice}
      </div>

      <div className="brand-control-comparison">
        <article className="brand-control-state brand-control-state--before">
          <div className="brand-control-state__head">
            <span className="brand-control-state__icon" aria-hidden="true"><Package /></span>
            <div>
              <span>{copy.beforeLabel}</span>
              <h3>{copy.beforeTitle}</h3>
            </div>
          </div>
          <p>{copy.beforeBody}</p>
          <div className="brand-control-silos" aria-hidden="true">
            {copy.beforeChannels.map((channel) => <span key={channel}>{channel}</span>)}
          </div>
        </article>

        <div className="brand-control-bridge" aria-label={copy.connector}>
          <span>{copy.connector}</span>
          <i aria-hidden="true" />
        </div>

        <article className="brand-control-state brand-control-state--after">
          <div className="brand-control-state__head">
            <span className="brand-control-state__icon" aria-hidden="true"><PackageCheck /></span>
            <div>
              <span>{copy.afterLabel}</span>
              <h3>{copy.afterTitle}</h3>
            </div>
          </div>
          <p>{copy.afterBody}</p>
          <div className="brand-control-product-chip">
            <span><RadioTower aria-hidden="true" />{copy.productName}</span>
            <small>{copy.productLot}</small>
            <strong><i aria-hidden="true" />{copy.ready}</strong>
          </div>
        </article>
      </div>

      <div className="brand-control-responsibilities">
        <section>
          <div className="brand-control-responsibilities__title">
            <span aria-hidden="true"><Settings2 /></span>
            <h3>{copy.configureTitle}</h3>
          </div>
          <ul>
            {copy.configureItems.map((item) => (
              <li key={item}><Check aria-hidden="true" />{item}</li>
            ))}
          </ul>
        </section>
        <section>
          <div className="brand-control-responsibilities__title">
            <span aria-hidden="true"><ClipboardList /></span>
            <h3>{copy.recordTitle}</h3>
          </div>
          <ul>
            {copy.recordItems.map((item) => (
              <li key={item}><Check aria-hidden="true" />{item}</li>
            ))}
          </ul>
          <p>{copy.followup}</p>
        </section>
      </div>
    </div>
  );
}
