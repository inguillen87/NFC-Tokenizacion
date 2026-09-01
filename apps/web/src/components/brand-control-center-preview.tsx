"use client";

import {
  BadgeCheck,
  BookOpen,
  Check,
  Headphones,
  RadioTower,
  ShieldCheck,
  Smartphone,
  Wine,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import styles from "./brand-control-center-preview.module.css";

type PreviewLocale = "es-AR" | "en" | "pt-BR";
type ExperienceKey = "story" | "warranty" | "contact";

type Experience = {
  label: string;
  helper: string;
  screenEyebrow: string;
  screenTitle: string;
  screenBody: string;
  screenAction: string;
  signal: string;
};

type PreviewCopy = {
  visualLabel: string;
  previewNotice: string;
  configureEyebrow: string;
  configureTitle: string;
  configureBody: string;
  liveEyebrow: string;
  liveBadge: string;
  productName: string;
  productLot: string;
  signalEyebrow: string;
  signalPrefix: string;
  truthNote: string;
  experiences: Record<ExperienceKey, Experience>;
};

const PREVIEW_COPY: Record<PreviewLocale, PreviewCopy> = {
  "es-AR": {
    visualLabel: "Simulador ilustrativo de lo que configura la marca, ve el cliente y recibe el equipo",
    previewNotice: "Ejemplo ilustrativo · Probá cada opción",
    configureEyebrow: "Tu equipo prepara",
    configureTitle: "Elegí qué querés activar.",
    configureBody: "La misma etiqueta puede abrir distintas experiencias sin cambiar el envase.",
    liveEyebrow: "El cliente recibe",
    liveBadge: "Vista en el celular",
    productName: "Reserva Andina",
    productLot: "Lote RA-2407",
    signalEyebrow: "nexID devuelve una señal útil",
    signalPrefix: "Lectura recibida",
    truthNote: "Datos ilustrativos. Las lecturas y acciones aparecen cuando la integración está activa.",
    experiences: {
      story: {
        label: "Historia y lote",
        helper: "Origen, cosecha y contenido del producto",
        screenEyebrow: "Conocé este vino",
        screenTitle: "Reserva Andina · Malbec",
        screenBody: "Cosecha 2022 · Valle de Uco · Origen declarado por la bodega.",
        screenAction: "Ver ficha del vino",
        signal: "El cliente abrió la historia del producto",
      },
      warranty: {
        label: "Garantía",
        helper: "Alta y seguimiento desde el producto",
        screenEyebrow: "Postventa",
        screenTitle: "Activá la garantía",
        screenBody: "El lote RA-2407 ya está identificado. Solo falta completar los datos de contacto.",
        screenAction: "Comenzar registro",
        signal: "El cliente eligió activar la garantía",
      },
      contact: {
        label: "Contacto",
        helper: "Una consulta directa con la marca",
        screenEyebrow: "Atención",
        screenTitle: "Hablá con la bodega",
        screenBody: "Consultá por conservación, maridaje o disponibilidad de este producto.",
        screenAction: "Iniciar consulta",
        signal: "El cliente pidió hablar con la marca",
      },
    },
  },
  en: {
    visualLabel: "Illustrative simulator of what the brand configures, the customer sees and the team receives",
    previewNotice: "Illustrative example · Try each option",
    configureEyebrow: "Your team prepares",
    configureTitle: "Choose what you want to activate.",
    configureBody: "The same label can open different experiences without changing the package.",
    liveEyebrow: "The customer receives",
    liveBadge: "Phone preview",
    productName: "Andean Reserve",
    productLot: "Batch RA-2407",
    signalEyebrow: "nexID returns a useful signal",
    signalPrefix: "Read received",
    truthNote: "Illustrative data. Reads and actions appear when the integration is active.",
    experiences: {
      story: { label: "Story and batch", helper: "Origin, vintage and product content", screenEyebrow: "Discover this wine", screenTitle: "Andean Reserve · Malbec", screenBody: "2022 vintage · Uco Valley · Origin declared by the winery.", screenAction: "View wine details", signal: "The customer opened the product story" },
      warranty: { label: "Warranty", helper: "Registration and follow-up from the product", screenEyebrow: "After-sales", screenTitle: "Activate the warranty", screenBody: "Batch RA-2407 is already identified. Only contact details remain.", screenAction: "Start registration", signal: "The customer chose to activate the warranty" },
      contact: { label: "Contact", helper: "A direct conversation with the brand", screenEyebrow: "Support", screenTitle: "Contact the winery", screenBody: "Ask about storage, pairing or availability for this product.", screenAction: "Start a conversation", signal: "The customer asked to contact the brand" },
    },
  },
  "pt-BR": {
    visualLabel: "Simulador ilustrativo do que a marca configura, o cliente vê e a equipe recebe",
    previewNotice: "Exemplo ilustrativo · Teste cada opção",
    configureEyebrow: "Sua equipe prepara",
    configureTitle: "Escolha o que deseja ativar.",
    configureBody: "A mesma etiqueta pode abrir experiências diferentes sem trocar a embalagem.",
    liveEyebrow: "O cliente recebe",
    liveBadge: "Prévia no celular",
    productName: "Reserva Andina",
    productLot: "Lote RA-2407",
    signalEyebrow: "A nexID devolve um sinal útil",
    signalPrefix: "Leitura recebida",
    truthNote: "Dados ilustrativos. Leituras e ações aparecem quando a integração está ativa.",
    experiences: {
      story: { label: "História e lote", helper: "Origem, safra e conteúdo do produto", screenEyebrow: "Conheça este vinho", screenTitle: "Reserva Andina · Malbec", screenBody: "Safra 2022 · Vale do Uco · Origem declarada pela vinícola.", screenAction: "Ver ficha do vinho", signal: "O cliente abriu a história do produto" },
      warranty: { label: "Garantia", helper: "Cadastro e acompanhamento pelo produto", screenEyebrow: "Pós-venda", screenTitle: "Ative a garantia", screenBody: "O lote RA-2407 já está identificado. Faltam apenas os dados de contato.", screenAction: "Iniciar cadastro", signal: "O cliente escolheu ativar a garantia" },
      contact: { label: "Contato", helper: "Uma conversa direta com a marca", screenEyebrow: "Atendimento", screenTitle: "Fale com a vinícola", screenBody: "Consulte conservação, harmonização ou disponibilidade deste produto.", screenAction: "Iniciar conversa", signal: "O cliente pediu para falar com a marca" },
    },
  },
};

const EXPERIENCE_ORDER: ExperienceKey[] = ["story", "warranty", "contact"];
const EXPERIENCE_ICONS = { story: BookOpen, warranty: ShieldCheck, contact: Headphones } as const;

function resolveLocale(locale: string): PreviewLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

export function BrandControlCenterPreview({ locale }: { locale: string }) {
  const copy = PREVIEW_COPY[resolveLocale(locale)];
  const [selected, setSelected] = useState<ExperienceKey>("story");
  const [motionReady, setMotionReady] = useState(false);
  const [motionActive, setMotionActive] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const experience = copy.experiences[selected];

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setMotionReady(true);
    if (typeof IntersectionObserver === "undefined") return setMotionActive(true);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && entry.intersectionRatio >= 0.16) {
        setMotionActive(true);
        observer.disconnect();
      }
    }, { rootMargin: "0px 0px -5%", threshold: [0, 0.16, 0.4] });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.preview}
      role="group"
      data-motion-ready={motionReady}
      data-motion-active={motionActive}
      aria-label={copy.visualLabel}
    >
      <div className={styles.notice}><BadgeCheck aria-hidden="true" />{copy.previewNotice}</div>

      <div className={styles.workspace}>
        <section className={styles.controls} aria-labelledby="brand-control-configure-title">
          <span className={styles.eyebrow}>{copy.configureEyebrow}</span>
          <h3 id="brand-control-configure-title">{copy.configureTitle}</h3>
          <p>{copy.configureBody}</p>
          <div className={styles.controlList}>
            {EXPERIENCE_ORDER.map((key) => {
              const item = copy.experiences[key];
              const Icon = EXPERIENCE_ICONS[key];
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected === key}
                  aria-controls="brand-control-live-preview"
                  onClick={() => setSelected(key)}
                >
                  <span><Icon aria-hidden="true" /></span>
                  <span><strong>{item.label}</strong><small>{item.helper}</small></span>
                  <Check aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </section>

        <section
          id="brand-control-live-preview"
          className={styles.livePreview}
          aria-live="polite"
          aria-atomic="true"
        >
          <div className={styles.liveHeader}>
            <div><span className={styles.eyebrow}>{copy.liveEyebrow}</span><strong>{copy.productName}</strong><small>{copy.productLot}</small></div>
            <span><Smartphone aria-hidden="true" />{copy.liveBadge}</span>
          </div>
          <div className={styles.scene}>
            <div className={styles.bottle} aria-hidden="true"><i /><Wine /><strong>{copy.productName}</strong><small>NFC</small></div>
            <div className={styles.radioWaves} aria-hidden="true"><i /><i /><i /></div>
            <div className={styles.phone} key={selected}>
              <span>{experience.screenEyebrow}</span>
              <h4>{experience.screenTitle}</h4>
              <p>{experience.screenBody}</p>
              <strong>{experience.screenAction}</strong>
            </div>
          </div>
        </section>
      </div>

      <footer className={styles.signalBar}>
        <span><RadioTower aria-hidden="true" />{copy.signalEyebrow}</span>
        <strong>{copy.signalPrefix} <i aria-hidden="true" /> {experience.signal}</strong>
        <small>{copy.truthNote}</small>
      </footer>
    </div>
  );
}
