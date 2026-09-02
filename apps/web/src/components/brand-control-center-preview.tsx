"use client";

import {
  Activity,
  BadgeCheck,
  BookOpenText,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  Gift,
  Layers3,
  Link2,
  MessageCircle,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { DEMO_PRODUCT_PROFILES } from "../lib/demo-product-profiles";
import styles from "./brand-control-center-preview.module.css";

type PreviewLocale = "es-AR" | "en" | "pt-BR";
type ModeKey = "identity" | "content" | "services" | "signals";
type ContentKey = "story" | "origin" | "care";
type ServiceKey = "warranty" | "benefit" | "contact";
type EventKind = "identity" | "content" | "service";
type EventFilter = "all" | EventKind;

type ProductIdentity = {
  brand: string;
  product: string;
  lot: string;
};

type ModeCopy = {
  label: string;
  helper: string;
  eyebrow: string;
  title: string;
  body: string;
};

type OptionCopy = {
  label: string;
  helper: string;
  event: string;
};

type DemoEvent = {
  id: number;
  kind: EventKind;
  title: string;
  detail: string;
  time: string;
};

type PreviewCopy = {
  visualLabel: string;
  notice: string;
  demoStatus: string;
  sceneLabel: string;
  sceneAlt: string;
  connected: string;
  tabsLabel: string;
  resultLabel: string;
  customerView: string;
  livePreview: string;
  noSelection: string;
  modes: Record<ModeKey, ModeCopy>;
  identity: {
    brand: string;
    product: string;
    lot: string;
    action: string;
    linked: string;
    edited: string;
    diagramTitle: string;
    tagLabel: string;
    event: string;
  };
  content: {
    legend: string;
    visible: string;
    previewTitle: string;
    items: Record<ContentKey, OptionCopy>;
  };
  services: {
    legend: string;
    enabled: string;
    previewTitle: string;
    items: Record<ServiceKey, OptionCopy>;
  };
  signals: {
    filtersLabel: string;
    filters: Record<EventFilter, string>;
    dashboardTitle: string;
    reads: string;
    opened: string;
    requested: string;
    feedTitle: string;
    empty: string;
  };
  latest: string;
  latestEmpty: string;
  context: string;
  next: string;
  nextSteps: Record<EventKind, string>;
  now: string;
  truth: string;
  sampleEvents: readonly DemoEvent[];
};

const MODE_ORDER: ModeKey[] = ["identity", "content", "services", "signals"];
const CONTENT_ORDER: ContentKey[] = ["story", "origin", "care"];
const SERVICE_ORDER: ServiceKey[] = ["warranty", "benefit", "contact"];

const MODE_ICONS = {
  identity: Link2,
  content: BookOpenText,
  services: SlidersHorizontal,
  signals: Activity,
} as const;

const CONTENT_ICONS = {
  story: BookOpenText,
  origin: Tag,
  care: PackageCheck,
} as const;

const SERVICE_ICONS = {
  warranty: ShieldCheck,
  benefit: Gift,
  contact: MessageCircle,
} as const;

const DEMO_PRODUCT = DEMO_PRODUCT_PROFILES.wine;

const PREVIEW_COPY: Record<PreviewLocale, PreviewCopy> = {
  "es-AR": {
    visualLabel: "Banco de trabajo interactivo de una experiencia de producto nexID",
    notice: "Demo interactiva · Datos ilustrativos",
    demoStatus: "Los cambios se ven al instante",
    sceneLabel: "Producto conectado de muestra",
    sceneAlt: "Botella premium y celular acercándose a una etiqueta NFC sobre un fondo luminoso",
    connected: "Etiqueta demo vinculada",
    tabsLabel: "Elegí qué querés configurar",
    resultLabel: "Resultado de esta configuración",
    customerView: "Vista del cliente",
    livePreview: "Previsualización en vivo",
    noSelection: "Activá al menos una opción para verla acá.",
    modes: {
      identity: { label: "Identidad", helper: "Vinculá producto y lote", eyebrow: "01 · Punto de partida", title: "Decile a la etiqueta qué producto representa.", body: "Editá los datos de muestra y vinculalos. Esa identidad acompaña el contenido, los servicios y cada evento posterior." },
      content: { label: "Contenido", helper: "Elegí qué información mostrar", eyebrow: "02 · Experiencia del cliente", title: "Publicá sólo lo que ayuda a entender el producto.", body: "Activá o desactivá bloques. La vista del celular cambia en el momento, sin modificar el envase." },
      services: { label: "Servicios", helper: "Configurá acciones útiles", eyebrow: "03 · Después de la compra", title: "Definí qué puede hacer el cliente desde el producto.", body: "Garantía, beneficios y contacto son acciones independientes. Probá cada una y mirá el evento que recibe el equipo." },
      signals: { label: "Actividad", helper: "Consultá qué ocurrió", eyebrow: "04 · Información para operar", title: "Pasá de una lectura aislada a una acción con contexto.", body: "Filtrá los eventos de muestra para ver qué producto intervino, qué abrió el cliente y qué seguimiento corresponde." },
    },
    identity: { brand: "Marca", product: "Producto", lot: "Lote", action: "Vincular etiqueta demo", linked: "Identidad lista", edited: "Hay cambios sin vincular", diagramTitle: "La etiqueta ya sabe qué representa", tagLabel: "ID de etiqueta", event: "Identidad vinculada" },
    content: {
      legend: "Contenido visible", visible: "bloques activos", previewTitle: "Conocé este vino",
      items: {
        story: { label: "Historia del producto", helper: "Cosecha, elaboración y propuesta de la marca", event: "Historia consultada" },
        origin: { label: "Origen y lote", helper: "Procedencia declarada y referencia del lote", event: "Origen consultado" },
        care: { label: "Cómo disfrutarlo", helper: "Servicio, conservación y recomendaciones", event: "Recomendaciones consultadas" },
      },
    },
    services: {
      legend: "Acciones disponibles", enabled: "servicios activos", previewTitle: "¿Cómo querés seguir?",
      items: {
        warranty: { label: "Activar garantía", helper: "Formulario y seguimiento desde el producto", event: "Garantía iniciada" },
        benefit: { label: "Acceder a un beneficio", helper: "Experiencia o recompensa definida por la marca", event: "Beneficio abierto" },
        contact: { label: "Hablar con la marca", helper: "Consulta vinculada al producto y lote", event: "Contacto solicitado" },
      },
    },
    signals: { filtersLabel: "Filtrar actividad ilustrativa", filters: { all: "Todo", identity: "Identidad", content: "Contenido", service: "Servicios" }, dashboardTitle: "Actividad que vuelve a tu equipo", reads: "Identidades vinculadas", opened: "Contenidos consultados", requested: "Servicios iniciados", feedTitle: "Eventos recientes · últimos 8", empty: "No hay eventos en este filtro." },
    latest: "Última acción del demo",
    latestEmpty: "Interactuá con la vista para generar un evento ilustrativo.",
    context: "Contexto",
    next: "Siguiente paso",
    nextSteps: { identity: "Publicar la experiencia vinculada", content: "Revisar el contenido consultado", service: "Asignar seguimiento de postventa" },
    now: "Ahora",
    truth: "Simulación sin datos reales ni escritura en producción. Los eventos aparecen sólo dentro de esta vista.",
    sampleEvents: [
      { id: 3, kind: "service", title: "Garantía iniciada", detail: "Reserva Andina · Lote RA-2407", time: "Hace 2 min" },
      { id: 2, kind: "content", title: "Historia consultada", detail: "Reserva Andina · Ficha de producto", time: "Hace 8 min" },
      { id: 1, kind: "identity", title: "Identidad vinculada", detail: "Reserva Andina · Lote RA-2407", time: "Hace 14 min" },
    ],
  },
  en: {
    visualLabel: "Interactive nexID product experience workbench",
    notice: "Interactive demo · Illustrative data",
    demoStatus: "Changes appear instantly",
    sceneLabel: "Sample connected product",
    sceneAlt: "Premium bottle and phone approaching an NFC label on a bright background",
    connected: "Demo label linked",
    tabsLabel: "Choose what you want to configure",
    resultLabel: "Result of this configuration",
    customerView: "Customer view",
    livePreview: "Live preview",
    noSelection: "Enable at least one option to see it here.",
    modes: {
      identity: { label: "Identity", helper: "Link product and batch", eyebrow: "01 · Starting point", title: "Tell the label which product it represents.", body: "Edit the sample data and link it. That identity follows the content, services and every later event." },
      content: { label: "Content", helper: "Choose what to show", eyebrow: "02 · Customer experience", title: "Publish only what helps people understand the product.", body: "Turn blocks on or off. The phone view changes instantly without changing the package." },
      services: { label: "Services", helper: "Configure useful actions", eyebrow: "03 · After purchase", title: "Define what customers can do from the product.", body: "Warranty, benefits and contact are independent actions. Try each one and see the event your team receives." },
      signals: { label: "Activity", helper: "See what happened", eyebrow: "04 · Information to operate", title: "Turn an isolated read into an action with context.", body: "Filter the sample events to see which product was involved, what the customer opened and what follow-up comes next." },
    },
    identity: { brand: "Brand", product: "Product", lot: "Batch", action: "Link demo label", linked: "Identity ready", edited: "Unlinked changes", diagramTitle: "The label now knows what it represents", tagLabel: "Label ID", event: "Identity linked" },
    content: {
      legend: "Visible content", visible: "active blocks", previewTitle: "Discover this wine",
      items: {
        story: { label: "Product story", helper: "Harvest, making and the brand's story", event: "Story viewed" },
        origin: { label: "Origin and batch", helper: "Declared source and batch reference", event: "Origin viewed" },
        care: { label: "How to enjoy it", helper: "Serving, storage and recommendations", event: "Recommendations viewed" },
      },
    },
    services: {
      legend: "Available actions", enabled: "active services", previewTitle: "What would you like to do?",
      items: {
        warranty: { label: "Activate warranty", helper: "Form and follow-up from the product", event: "Warranty started" },
        benefit: { label: "Access a benefit", helper: "Experience or reward defined by the brand", event: "Benefit opened" },
        contact: { label: "Contact the brand", helper: "Question linked to product and batch", event: "Contact requested" },
      },
    },
    signals: { filtersLabel: "Filter illustrative activity", filters: { all: "All", identity: "Identity", content: "Content", service: "Services" }, dashboardTitle: "Activity returned to your team", reads: "Linked identities", opened: "Content views", requested: "Services started", feedTitle: "Recent events · latest 8", empty: "There are no events in this filter." },
    latest: "Latest demo action",
    latestEmpty: "Interact with the preview to generate an illustrative event.",
    context: "Context",
    next: "Next step",
    nextSteps: { identity: "Publish the linked experience", content: "Review the content viewed", service: "Assign after-sales follow-up" },
    now: "Now",
    truth: "Simulation with no real data or production writes. Events exist only inside this view.",
    sampleEvents: [
      { id: 3, kind: "service", title: "Warranty started", detail: "Reserva Andina · Batch RA-2407", time: "2 min ago" },
      { id: 2, kind: "content", title: "Story viewed", detail: "Reserva Andina · Product profile", time: "8 min ago" },
      { id: 1, kind: "identity", title: "Identity linked", detail: "Reserva Andina · Batch RA-2407", time: "14 min ago" },
    ],
  },
  "pt-BR": {
    visualLabel: "Bancada interativa de experiência de produto nexID",
    notice: "Demo interativa · Dados ilustrativos",
    demoStatus: "As mudanças aparecem na hora",
    sceneLabel: "Produto conectado de demonstração",
    sceneAlt: "Garrafa premium e celular se aproximando de uma etiqueta NFC em fundo claro",
    connected: "Etiqueta demo vinculada",
    tabsLabel: "Escolha o que deseja configurar",
    resultLabel: "Resultado desta configuração",
    customerView: "Visão do cliente",
    livePreview: "Pré-visualização ao vivo",
    noSelection: "Ative pelo menos uma opção para vê-la aqui.",
    modes: {
      identity: { label: "Identidade", helper: "Vincule produto e lote", eyebrow: "01 · Ponto de partida", title: "Diga à etiqueta qual produto ela representa.", body: "Edite os dados de exemplo e vincule-os. Essa identidade acompanha o conteúdo, os serviços e cada evento posterior." },
      content: { label: "Conteúdo", helper: "Escolha o que mostrar", eyebrow: "02 · Experiência do cliente", title: "Publique apenas o que ajuda a entender o produto.", body: "Ative ou desative blocos. A tela do celular muda na hora, sem alterar a embalagem." },
      services: { label: "Serviços", helper: "Configure ações úteis", eyebrow: "03 · Depois da compra", title: "Defina o que o cliente pode fazer a partir do produto.", body: "Garantia, benefícios e contato são ações independentes. Teste cada uma e veja o evento que sua equipe recebe." },
      signals: { label: "Atividade", helper: "Veja o que aconteceu", eyebrow: "04 · Informação para operar", title: "Transforme uma leitura isolada em uma ação com contexto.", body: "Filtre os eventos de exemplo para ver qual produto participou, o que o cliente abriu e qual acompanhamento vem depois." },
    },
    identity: { brand: "Marca", product: "Produto", lot: "Lote", action: "Vincular etiqueta demo", linked: "Identidade pronta", edited: "Há alterações sem vincular", diagramTitle: "A etiqueta agora sabe o que representa", tagLabel: "ID da etiqueta", event: "Identidade vinculada" },
    content: {
      legend: "Conteúdo visível", visible: "blocos ativos", previewTitle: "Conheça este vinho",
      items: {
        story: { label: "História do produto", helper: "Safra, elaboração e proposta da marca", event: "História consultada" },
        origin: { label: "Origem e lote", helper: "Procedência declarada e referência do lote", event: "Origem consultada" },
        care: { label: "Como aproveitar", helper: "Serviço, conservação e recomendações", event: "Recomendações consultadas" },
      },
    },
    services: {
      legend: "Ações disponíveis", enabled: "serviços ativos", previewTitle: "Como deseja continuar?",
      items: {
        warranty: { label: "Ativar garantia", helper: "Formulário e acompanhamento pelo produto", event: "Garantia iniciada" },
        benefit: { label: "Acessar um benefício", helper: "Experiência ou recompensa definida pela marca", event: "Benefício aberto" },
        contact: { label: "Falar com a marca", helper: "Consulta vinculada ao produto e lote", event: "Contato solicitado" },
      },
    },
    signals: { filtersLabel: "Filtrar atividade ilustrativa", filters: { all: "Tudo", identity: "Identidade", content: "Conteúdo", service: "Serviços" }, dashboardTitle: "Atividade que volta para sua equipe", reads: "Identidades vinculadas", opened: "Conteúdos consultados", requested: "Serviços iniciados", feedTitle: "Eventos recentes · últimos 8", empty: "Não há eventos neste filtro." },
    latest: "Última ação da demo",
    latestEmpty: "Interaja com a prévia para gerar um evento ilustrativo.",
    context: "Contexto",
    next: "Próximo passo",
    nextSteps: { identity: "Publicar a experiência vinculada", content: "Revisar o conteúdo consultado", service: "Atribuir acompanhamento de pós-venda" },
    now: "Agora",
    truth: "Simulação sem dados reais nem gravação em produção. Os eventos existem apenas nesta visualização.",
    sampleEvents: [
      { id: 3, kind: "service", title: "Garantia iniciada", detail: "Reserva Andina · Lote RA-2407", time: "Há 2 min" },
      { id: 2, kind: "content", title: "História consultada", detail: "Reserva Andina · Ficha do produto", time: "Há 8 min" },
      { id: 1, kind: "identity", title: "Identidade vinculada", detail: "Reserva Andina · Lote RA-2407", time: "Há 14 min" },
    ],
  },
};

function resolveLocale(locale: string): PreviewLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

function countEvents(events: readonly DemoEvent[]): Record<EventKind, number> {
  return events.reduce<Record<EventKind, number>>(
    (counts, event) => ({ ...counts, [event.kind]: counts[event.kind] + 1 }),
    { identity: 0, content: 0, service: 0 },
  );
}

const DEFAULT_IDENTITY: ProductIdentity = {
  brand: DEMO_PRODUCT.brand,
  product: DEMO_PRODUCT.name,
  lot: DEMO_PRODUCT.lot,
};

export function BrandControlCenterPreview({ locale }: { locale: string }) {
  const resolvedLocale = resolveLocale(locale);
  const copy = PREVIEW_COPY[resolvedLocale];
  const [selected, setSelected] = useState<ModeKey>("identity");
  const [linkedIdentity, setLinkedIdentity] = useState<ProductIdentity>(DEFAULT_IDENTITY);
  const [draftIdentity, setDraftIdentity] = useState<ProductIdentity>(DEFAULT_IDENTITY);
  const [content, setContent] = useState<Record<ContentKey, boolean>>({ story: true, origin: true, care: false });
  const [services, setServices] = useState<Record<ServiceKey, boolean>>({ warranty: true, benefit: false, contact: true });
  const [events, setEvents] = useState<DemoEvent[]>(() => [...copy.sampleEvents]);
  const [eventCounts, setEventCounts] = useState<Record<EventKind, number>>(() => countEvents(copy.sampleEvents));
  const [filter, setFilter] = useState<EventFilter>("all");
  const [pulseKey, setPulseKey] = useState(0);
  const [motionMode, setMotionMode] = useState<"pending" | "ready" | "reduced">("pending");
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const groupId = useId();
  const mode = copy.modes[selected];
  const motionActive = motionMode === "ready" && inView && pageVisible;
  const { brand, product, lot } = linkedIdentity;
  const identityLinked = draftIdentity.brand === brand && draftIdentity.product === product && draftIdentity.lot === lot;

  const activeContent = useMemo(() => CONTENT_ORDER.filter((key) => content[key]), [content]);
  const activeServices = useMemo(() => SERVICE_ORDER.filter((key) => services[key]), [services]);
  const visibleEvents = useMemo(() => events.filter((event) => filter === "all" || event.kind === filter), [events, filter]);
  const latestEvent = events[0];

  useEffect(() => {
    const root = rootRef.current;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotion = () => setMotionMode(reducedMotionQuery.matches ? "reduced" : "ready");
    const syncVisibility = () => setPageVisible(!document.hidden);
    const onReducedMotionChange = (event: MediaQueryListEvent) => setMotionMode(event.matches ? "reduced" : "ready");

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

  useEffect(() => {
    setEvents([...copy.sampleEvents]);
    setEventCounts(countEvents(copy.sampleEvents));
    setFilter("all");
  }, [copy.sampleEvents, resolvedLocale]);

  const recordEvent = (kind: EventKind, title: string, detail: string) => {
    setEvents((current) => [{ id: Date.now(), kind, title, detail, time: copy.now }, ...current].slice(0, 8));
    setEventCounts((current) => ({ ...current, [kind]: current[kind] + 1 }));
    setPulseKey((current) => current + 1);
  };

  const handleIdentitySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextIdentity = {
      brand: draftIdentity.brand.trim().slice(0, 50) || DEFAULT_IDENTITY.brand,
      product: draftIdentity.product.trim().slice(0, 60) || DEFAULT_IDENTITY.product,
      lot: draftIdentity.lot.trim().slice(0, 32) || DEFAULT_IDENTITY.lot,
    };
    setDraftIdentity(nextIdentity);
    setLinkedIdentity(nextIdentity);
    recordEvent("identity", copy.identity.event, nextIdentity.product + " · " + nextIdentity.lot);
  };

  const updateIdentity = (field: keyof ProductIdentity, value: string) => {
    setDraftIdentity((current) => ({ ...current, [field]: value }));
  };

  const selectMode = (key: ModeKey) => {
    setSelected(key);
    setPulseKey((current) => current + 1);
  };

  const toggleContent = (key: ContentKey) => {
    setContent((current) => ({ ...current, [key]: !current[key] }));
    setPulseKey((current) => current + 1);
  };

  const toggleService = (key: ServiceKey) => {
    setServices((current) => ({ ...current, [key]: !current[key] }));
    setPulseKey((current) => current + 1);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, key: ModeKey) => {
    const currentIndex = MODE_ORDER.indexOf(key);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % MODE_ORDER.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + MODE_ORDER.length) % MODE_ORDER.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = MODE_ORDER.length - 1;
    if (nextIndex === currentIndex) return;
    event.preventDefault();
    const nextKey = MODE_ORDER[nextIndex];
    selectMode(nextKey);
    window.requestAnimationFrame(() => document.getElementById(groupId + "-mode-" + nextKey)?.focus());
  };

  const modePanelId = groupId + "-mode-panel";

  return (
    <div ref={rootRef} className={styles.preview} role="group" data-mode={selected} data-motion-mode={motionMode} data-motion-active={motionActive ? "true" : "false"} aria-label={copy.visualLabel}>
      <header className={styles.topBar}>
        <span className={styles.notice}><BadgeCheck aria-hidden="true" />{copy.notice}</span>
        <span className={styles.demoStatus}><Sparkles aria-hidden="true" />{copy.demoStatus}<i /></span>
      </header>

      <figure className={styles.contextScene} aria-label={copy.sceneAlt}>
        <Image className={styles.sceneImage} src="/landing/nexid-product-orchestration-wine-light-v2.webp" alt="" fill sizes="(max-width: 900px) 100vw, 78vw" aria-hidden="true" />
        <figcaption className={styles.productIdentity}>
          <small>{copy.sceneLabel}</small>
          <strong>{product || DEMO_PRODUCT.name}</strong>
          <span>{brand || DEMO_PRODUCT.brand} · {lot || DEMO_PRODUCT.lot}</span>
          <em><CircleDot aria-hidden="true" />{copy.connected}</em>
        </figcaption>
        <div className={styles.rfLink} key={pulseKey} aria-hidden="true">
          <span className={styles.rfCore}>NFC</span><span className={styles.rfWaveOne} /><span className={styles.rfWaveTwo} /><span className={styles.rfWaveThree} /><i className={styles.rfParticleOne} /><i className={styles.rfParticleTwo} />
        </div>
      </figure>

      <div className={styles.modeTabs} role="tablist" aria-label={copy.tabsLabel}>
        {MODE_ORDER.map((key, index) => {
          const Icon = MODE_ICONS[key];
          const item = copy.modes[key];
          return (
            <button key={key} id={groupId + "-mode-" + key} type="button" role="tab" aria-selected={selected === key} aria-controls={modePanelId} tabIndex={selected === key ? 0 : -1} onClick={() => selectMode(key)} onKeyDown={(event) => handleTabKeyDown(event, key)}>
              <span>{String(index + 1).padStart(2, "0")}</span><Icon aria-hidden="true" /><strong>{item.label}</strong><small>{item.helper}</small>
            </button>
          );
        })}
      </div>

      <div className={styles.workbench}>
        <section className={styles.editor} id={modePanelId} role="tabpanel" aria-labelledby={groupId + "-mode-" + selected} key={"editor-" + selected}>
          <span className={styles.eyebrow}>{mode.eyebrow}</span>
          <h3>{mode.title}</h3>
          <p className={styles.modeBody}>{mode.body}</p>

          {selected === "identity" ? (
            <form className={styles.identityForm} onSubmit={handleIdentitySubmit}>
              <label>{copy.identity.brand}<input name="demo-brand" value={draftIdentity.brand} required maxLength={50} onChange={(event) => updateIdentity("brand", event.target.value)} /></label>
              <label>{copy.identity.product}<input name="demo-product" value={draftIdentity.product} required maxLength={60} onChange={(event) => updateIdentity("product", event.target.value)} /></label>
              <label>{copy.identity.lot}<input name="demo-lot" value={draftIdentity.lot} required maxLength={32} onChange={(event) => updateIdentity("lot", event.target.value)} /></label>
              <button type="submit"><Link2 aria-hidden="true" />{copy.identity.action}</button>
              <p className={identityLinked ? styles.readyState : styles.editedState} role="status">{identityLinked ? <Check aria-hidden="true" /> : <CircleDot aria-hidden="true" />}{identityLinked ? copy.identity.linked : copy.identity.edited}</p>
            </form>
          ) : null}

          {selected === "content" ? (
            <fieldset className={styles.optionList}>
              <legend>{copy.content.legend}<span>{activeContent.length}/3 {copy.content.visible}</span></legend>
              {CONTENT_ORDER.map((key) => {
                const Icon = CONTENT_ICONS[key];
                const item = copy.content.items[key];
                return <label key={key} data-enabled={content[key] ? "true" : "false"}><input type="checkbox" checked={content[key]} onChange={() => toggleContent(key)} /><span className={styles.optionIcon}><Icon aria-hidden="true" /></span><span><strong>{item.label}</strong><small>{item.helper}</small></span><i aria-hidden="true"><b /></i></label>;
              })}
            </fieldset>
          ) : null}

          {selected === "services" ? (
            <fieldset className={styles.optionList}>
              <legend>{copy.services.legend}<span>{activeServices.length}/3 {copy.services.enabled}</span></legend>
              {SERVICE_ORDER.map((key) => {
                const Icon = SERVICE_ICONS[key];
                const item = copy.services.items[key];
                return <label key={key} data-enabled={services[key] ? "true" : "false"}><input type="checkbox" checked={services[key]} onChange={() => toggleService(key)} /><span className={styles.optionIcon}><Icon aria-hidden="true" /></span><span><strong>{item.label}</strong><small>{item.helper}</small></span><i aria-hidden="true"><b /></i></label>;
              })}
            </fieldset>
          ) : null}

          {selected === "signals" ? (
            <div className={styles.signalControls}>
              <span>{copy.signals.filtersLabel}</span>
              <div role="group" aria-label={copy.signals.filtersLabel}>{(Object.keys(copy.signals.filters) as EventFilter[]).map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>{copy.signals.filters[key]}</button>)}</div>
              <p><RadioTower aria-hidden="true" />{copy.truth}</p>
            </div>
          ) : null}
        </section>

        <section className={styles.result} aria-label={copy.resultLabel} key={"result-" + selected}>
          {selected === "identity" ? (
            <div className={styles.identityResult}>
              <header><span><Layers3 aria-hidden="true" />{copy.resultLabel}</span><em>{identityLinked ? copy.identity.linked : copy.identity.edited}</em></header>
              <h4>{copy.identity.diagramTitle}</h4>
              <div className={styles.identityDiagram}>
                <div className={styles.tagNode}><RadioTower aria-hidden="true" /><small>{copy.identity.tagLabel}</small><strong>NX-R24-07</strong></div>
                <span className={styles.linkTrace}><i /><i /><i /></span>
                <div className={styles.productNode}><PackageCheck aria-hidden="true" /><small>{product || DEMO_PRODUCT.name}</small><strong>{lot || DEMO_PRODUCT.lot}</strong><span>{brand || DEMO_PRODUCT.brand}</span></div>
              </div>
            </div>
          ) : null}

          {selected === "content" || selected === "services" ? (
            <div className={styles.phoneStage}>
              <header><span><Eye aria-hidden="true" />{copy.customerView}</span><em>{copy.livePreview}</em></header>
              <div className={styles.phone}>
                <span className={styles.phoneSpeaker} />
                <div className={styles.phoneHero}><small>{product || DEMO_PRODUCT.name}</small><strong>{selected === "content" ? copy.content.previewTitle : copy.services.previewTitle}</strong><span>{brand || DEMO_PRODUCT.brand} · {lot || DEMO_PRODUCT.lot}</span></div>
                <div className={styles.phoneOptions}>
                  {selected === "content" && activeContent.map((key) => {
                    const Icon = CONTENT_ICONS[key];
                    const item = copy.content.items[key];
                    return <button key={key} type="button" onClick={() => recordEvent("content", item.event, (product || DEMO_PRODUCT.name) + " · " + item.label)}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.helper}</small></span><ChevronRight aria-hidden="true" /></button>;
                  })}
                  {selected === "services" && activeServices.map((key) => {
                    const Icon = SERVICE_ICONS[key];
                    const item = copy.services.items[key];
                    return <button key={key} type="button" onClick={() => recordEvent("service", item.event, (product || DEMO_PRODUCT.name) + " · " + (lot || DEMO_PRODUCT.lot))}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.helper}</small></span><ChevronRight aria-hidden="true" /></button>;
                  })}
                  {((selected === "content" && activeContent.length === 0) || (selected === "services" && activeServices.length === 0)) ? <p className={styles.emptyPreview}>{copy.noSelection}</p> : null}
                </div>
              </div>
            </div>
          ) : null}

          {selected === "signals" ? (
            <div className={styles.activityBoard}>
              <header><span><Activity aria-hidden="true" />{copy.signals.dashboardTitle}</span><em>{copy.notice}</em></header>
              <div className={styles.metrics}>
                <div><Link2 aria-hidden="true" /><strong key={"identity-" + eventCounts.identity}>{eventCounts.identity}</strong><span>{copy.signals.reads}</span><i className={styles.metricBar}><b style={{ width: Math.min(100, 24 + eventCounts.identity * 14) + "%" }} /></i></div>
                <div><BookOpenText aria-hidden="true" /><strong key={"content-" + eventCounts.content}>{eventCounts.content}</strong><span>{copy.signals.opened}</span><i className={styles.metricBar}><b style={{ width: Math.min(100, 24 + eventCounts.content * 14) + "%" }} /></i></div>
                <div><ShieldCheck aria-hidden="true" /><strong key={"service-" + eventCounts.service}>{eventCounts.service}</strong><span>{copy.signals.requested}</span><i className={styles.metricBar}><b style={{ width: Math.min(100, 24 + eventCounts.service * 14) + "%" }} /></i></div>
              </div>
              <h4>{copy.signals.feedTitle}</h4>
              <ol className={styles.eventFeed}>{visibleEvents.map((event) => <li key={event.id} data-kind={event.kind}><i /><span><strong>{event.title}</strong><small>{event.detail}</small></span><time>{event.time}</time></li>)}</ol>
              {visibleEvents.length === 0 ? <p className={styles.emptyFeed}>{copy.signals.empty}</p> : null}
            </div>
          ) : null}
        </section>
      </div>

      <footer className={styles.returnBar} aria-live="polite" aria-atomic="true">
        <div className={styles.returnEvent} key={latestEvent?.id || "empty"}><RadioTower aria-hidden="true" /><span><small>{copy.latest}</small><strong>{latestEvent?.title || copy.latestEmpty}</strong></span></div>
        <dl><div><dt>{copy.context}</dt><dd>{latestEvent?.detail || product + " · " + lot}</dd></div><div><dt>{copy.next}</dt><dd>{latestEvent ? copy.nextSteps[latestEvent.kind] : copy.latestEmpty}</dd></div></dl>
        <p>{copy.truth}</p>
      </footer>
    </div>
  );
}
