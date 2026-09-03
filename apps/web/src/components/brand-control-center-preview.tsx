"use client";

import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  Check,
  ChevronRight,
  CircleDot,
  Eye,
  Layers3,
  Link2,
  MapPinned,
  MessageCircle,
  MousePointerClick,
  PackageCheck,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trophy,
  UserRoundCheck,
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { MapDensity, PremiumVectorMapLabels, PremiumVectorMapProps, VectorMapPoint } from "@product/ui/premium-vector-map";
import { DEMO_PRODUCT_PROFILES } from "../lib/demo-product-profiles";
import styles from "./brand-control-center-preview.module.css";

const PremiumVectorMap = dynamic<PremiumVectorMapProps>(
  () => import("@product/ui/premium-vector-map").then((module) => module.PremiumVectorMap),
  { ssr: false, loading: () => <span className={styles.mapLoading} aria-hidden="true" /> },
);

type PreviewLocale = "es-AR" | "en" | "pt-BR";
type ModeKey = "identity" | "content" | "services" | "signals";
type ContentKey = "story" | "origin" | "care";
type ServiceKey = "warranty" | "benefit" | "ownership" | "contact";
type EventKind = "identity" | "content" | "service";
type EventFilter = "all" | EventKind;
type ImpactKey = "identity" | `content.${ContentKey}` | `service.${ServiceKey}`;
type ImpactView = "impact" | "map";

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
  impact: ImpactKey;
  regionId: string;
  title: string;
  detail: string;
  time: string;
};

type ImpactItemCopy = {
  eyebrow: string;
  title: string;
  signal: string;
  value: string;
  action: string;
  tags: readonly string[];
};

type ImpactPanelCopy = {
  event: string;
  title: string;
  views: Record<ImpactView, string>;
  signal: string;
  value: string;
  action: string;
  mapTitle: string;
  mapSubtitle: string;
  mapPoints: string;
  mapHeat: string;
  mapTotal: string;
  mapTotalOne: string;
  mapSelected: string;
  mapUse: string;
  mapUseBody: string;
  mapTruth: string;
  mapRegionNames: Record<string, string>;
  mapPointEvidence: string;
  mapPointSeen: string;
  items: Record<ImpactKey, ImpactItemCopy>;
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
  latestEmpty: string;
  impact: ImpactPanelCopy;
  now: string;
  truth: string;
  sampleEvents: readonly DemoEvent[];
};

const MODE_ORDER: ModeKey[] = ["identity", "content", "services", "signals"];
const CONTENT_ORDER: ContentKey[] = ["story", "origin", "care"];
const SERVICE_ORDER: ServiceKey[] = ["warranty", "benefit", "ownership", "contact"];

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
  benefit: Trophy,
  ownership: UserRoundCheck,
  contact: MessageCircle,
} as const;

const IMPACT_ICONS = {
  identity: Link2,
  "content.story": BookOpenText,
  "content.origin": MapPinned,
  "content.care": PackageCheck,
  "service.warranty": ShieldCheck,
  "service.benefit": Trophy,
  "service.ownership": UserRoundCheck,
  "service.contact": MessageCircle,
} as const;

const DEMO_REGION_COORDINATES = [
  { id: "mendoza", lat: -32.8895, lng: -68.8458 },
  { id: "buenos-aires", lat: -34.6037, lng: -58.3816 },
  { id: "cordoba", lat: -31.4201, lng: -64.1888 },
  { id: "rosario", lat: -32.9442, lng: -60.6505 },
  { id: "santiago", lat: -33.4489, lng: -70.6693 },
] as const;

const MAP_LABELS: Record<PreviewLocale, Partial<PremiumVectorMapLabels>> = {
  "es-AR": {
    legendEvent: "Evento simulado",
    heatLegend: "Calor = cantidad de eventos simulados en esta vista",
    loadingGeographicMap: "Cargando mapa interactivo de demostración…",
    popupObservedEvents: "{count} eventos simulados",
    mapSummary: "{subtitle} Zonas de ejemplo: {points}. Eventos simulados en esta vista: {events}.",
    detailsEventCount: "{count} eventos simulados",
  },
  en: {
    defaultTitle: "Reported event map",
    defaultSubtitle: "Observed geographic points; this does not infer authentication or physical journeys.",
    routeFallbackLabel: "Reported relationship",
    consumerAccuracyUnknown: "Authorized approximate area; accuracy unavailable",
    consumerAccuracyKnown: "Authorized approximate area · around {meters} m accuracy",
    tileLoadError: "Map tiles could not be loaded.",
    tileLoadWarning: "Some tiles could not be loaded. The text summary keeps the available evidence.",
    mapInitError: "MapLibre could not start on this device.",
    localGridSource: "MapLibre GL · local grid with no external tiles",
    legendAriaLabel: "Map legend",
    legendEvent: "Simulated event",
    legendDeclaredOrigin: "Declared origin",
    legendSeparateRisk: "Separate risk signal",
    heatLegend: "Heat = simulated event count in this view",
    loadingLocalGrid: "Preparing local grid…",
    loadingApproximateLocation: "Loading approximate location…",
    loadingGeographicMap: "Loading interactive map…",
    mapUnavailableTitle: "Map unavailable",
    mapUnavailableSummary: "The text summary remains available; we do not invent geography.",
    emptyConsumerTitle: "Phone location not authorized",
    emptyConsumerBody: "We do not show a network or IP point. The map appears only after this device shares an approximate location.",
    emptyMapTitle: "No reported locations to display",
    emptyMapBody: "A valid coordinate will appear here when available. We do not generate artificial points.",
    consumerPointSummary: "One approximate point shared by this device.",
    consumerEmptySummary: "No device location authorized.",
    mapSummary: "{subtitle} Example regions: {points}. Simulated events in this view: {events}.",
    detailsSummary: "Map evidence and summary",
    popupObservedEvents: "{count} simulated events",
    popupReportedPoint: "Reported geographic point",
    detailsEventCount: "{count} simulated events",
    attributionToggle: "Toggle attribution",
    navigationZoomIn: "Zoom in",
    navigationZoomOut: "Zoom out",
    popupClose: "Close popup",
    cooperativeWindows: "Use Ctrl + scroll to zoom the map",
    cooperativeMac: "Use ⌘ + scroll to zoom the map",
    cooperativeMobile: "Use two fingers to move the map",
  },
  "pt-BR": {
    defaultTitle: "Mapa de eventos reportados",
    defaultSubtitle: "Pontos geográficos observados; não infere autenticação nem trajetos físicos.",
    routeFallbackLabel: "Relação reportada",
    consumerAccuracyUnknown: "Área aproximada autorizada; precisão não informada",
    consumerAccuracyKnown: "Área aproximada autorizada · margem próxima de {meters} m",
    tileLoadError: "Não foi possível carregar os blocos do mapa.",
    tileLoadWarning: "Alguns blocos não foram carregados. O resumo textual mantém as evidências disponíveis.",
    mapInitError: "Não foi possível iniciar o MapLibre neste dispositivo.",
    localGridSource: "MapLibre GL · grade local sem blocos externos",
    legendAriaLabel: "Legenda do mapa",
    legendEvent: "Evento simulado",
    legendDeclaredOrigin: "Origem declarada",
    legendSeparateRisk: "Sinal de risco separado",
    heatLegend: "Calor = quantidade de eventos simulados nesta visualização",
    loadingLocalGrid: "Preparando grade local…",
    loadingApproximateLocation: "Carregando localização aproximada…",
    loadingGeographicMap: "Carregando mapa interativo…",
    mapUnavailableTitle: "Mapa indisponível",
    mapUnavailableSummary: "O resumo textual continua disponível; não inventamos geografia.",
    emptyConsumerTitle: "Localização do telefone não autorizada",
    emptyConsumerBody: "Não mostramos um ponto por rede ou IP. O mapa aparece somente após compartilhar uma localização aproximada deste dispositivo.",
    emptyMapTitle: "Nenhuma localização reportada para mostrar",
    emptyMapBody: "Uma coordenada válida aparecerá aqui quando estiver disponível. Não geramos pontos artificiais.",
    consumerPointSummary: "Um ponto aproximado compartilhado por este dispositivo.",
    consumerEmptySummary: "Nenhuma localização do dispositivo autorizada.",
    mapSummary: "{subtitle} Regiões de exemplo: {points}. Eventos simulados nesta visualização: {events}.",
    detailsSummary: "Evidências e resumo do mapa",
    popupObservedEvents: "{count} eventos simulados",
    popupReportedPoint: "Ponto geográfico reportado",
    detailsEventCount: "{count} eventos simulados",
    attributionToggle: "Mostrar atribuição",
    navigationZoomIn: "Aproximar",
    navigationZoomOut: "Afastar",
    popupClose: "Fechar janela",
    cooperativeWindows: "Use Ctrl + rolagem para aproximar o mapa",
    cooperativeMac: "Use ⌘ + rolagem para aproximar o mapa",
    cooperativeMobile: "Use dois dedos para mover o mapa",
  },
};

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
      services: { label: "Servicios", helper: "Configurá acciones útiles", eyebrow: "03 · Después de la compra", title: "Definí qué puede hacer el cliente desde el producto.", body: "Garantía, fidelización, registro y contacto son acciones independientes. Probá cada una y mirá qué señal recibe el equipo." },
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
        warranty: { label: "Solicitar garantía", helper: "Iniciá el formulario; la marca confirma el alta y el seguimiento", event: "Intención de garantía registrada" },
        benefit: { label: "Puntos, desafíos y beneficios", helper: "Reglas, recompensas y experiencias definidas por la marca", event: "Experiencia de fidelización abierta" },
        ownership: { label: "Registrar mi producto", helper: "Iniciar la asociación a una cuenta con consentimiento", event: "Registro de producto iniciado" },
        contact: { label: "Hablar con la marca", helper: "Consulta vinculada al producto y lote", event: "Contacto solicitado" },
      },
    },
    signals: { filtersLabel: "Filtrar actividad ilustrativa", filters: { all: "Todo", identity: "Identidad", content: "Contenido", service: "Servicios" }, dashboardTitle: "Eventos que recibe tu equipo", reads: "Identidades vinculadas", opened: "Contenidos consultados", requested: "Servicios iniciados", feedTitle: "Eventos recientes · últimos 8", empty: "No hay eventos en este filtro." },
    latestEmpty: "Interactuá con la vista para generar un evento ilustrativo.",
    impact: {
      event: "Evento ilustrativo",
      title: "Qué pasó y qué puede hacer tu marca",
      views: { impact: "Impacto", map: "Geografía demo" },
      signal: "Señal observada",
      value: "Valor para tu marca",
      action: "Próxima acción posible",
      mapTitle: "Mapa de actividad simulada",
      mapSubtitle: "Cada punto reúne eventos generados sólo dentro de esta demo.",
      mapPoints: "Puntos",
      mapHeat: "Mapa de calor",
      mapTotal: "eventos simulados en esta vista",
      mapTotalOne: "evento simulado en esta vista",
      mapSelected: "Región de ejemplo",
      mapUse: "Qué ayuda a entender",
      mapUseBody: "En una integración real, esta vista puede agrupar eventos con ubicación reportada para comparar campañas, contenido y demanda de atención por zona.",
      mapTruth: "Las zonas son parte del escenario de demostración: no representan la ubicación del visitante. Un tap por sí solo no aporta GPS.",
      mapRegionNames: { mendoza: "Mendoza", "buenos-aires": "Buenos Aires", cordoba: "Córdoba", rosario: "Rosario", santiago: "Santiago" },
      mapPointEvidence: "Evento generado en esta simulación",
      mapPointSeen: "Sesión demo",
      items: {
        identity: { eyebrow: "Identidad operativa", title: "Un producto, un lote y una experiencia bajo la misma referencia.", signal: "La etiqueta demo quedó vinculada a {product} · Lote {lot}.", value: "Mantiene contenido, servicios y eventos asociados a una referencia concreta.", action: "Revisá los datos y publicá la experiencia sólo cuando estén aprobados.", tags: ["Identidad", "Lote", "Gobernanza"] },
        "content.story": { eyebrow: "Storytelling", title: "La historia abre una oportunidad de relación.", signal: "Se abrió Historia del producto de {product}.", value: "Tu equipo sabe que se consultó la cosecha, la elaboración y el relato de marca.", action: "Podés invitar a guardar el producto, sumarse al club o descubrir otra historia relacionada.", tags: ["Historia", "Club", "Fidelización"] },
        "content.origin": { eyebrow: "Origen declarado", title: "La procedencia deja de ser letra chica.", signal: "Se abrió Origen y lote de {product} · {lot}.", value: "Queda registrado que se consultó la procedencia y la referencia del lote, separado de otros contenidos.", action: "Verificá que origen y lote estén completos y mantenelos actualizados.", tags: ["Origen", "Lote", "Transparencia"] },
        "content.care": { eyebrow: "Acompañamiento", title: "La utilidad después de la compra también fideliza.", signal: "Se consultaron recomendaciones de uso y conservación de {product}.", value: "La marca registra una consulta de orientación sin inferir por qué se abrió ese contenido.", action: "Ofrecé una guía útil y, si corresponde, una experiencia o recomendación complementaria.", tags: ["Uso", "Contenido útil", "Recompra"] },
        "service.warranty": { eyebrow: "Postventa", title: "Una intención de garantía llega con producto y lote.", signal: "El cliente seleccionó Solicitar garantía para {product} · {lot}.", value: "El equipo recibe la intención con contexto; todavía no confirma que la garantía haya sido dada de alta.", action: "Solicitá los datos requeridos, confirmá el estado y recién entonces asigná seguimiento.", tags: ["Garantía", "Contexto", "Seguimiento"] },
        "service.benefit": { eyebrow: "Fidelización + gamificación", title: "El producto puede abrir puntos, desafíos y recompensas.", signal: "El cliente abrió la experiencia de fidelización desde {product}.", value: "La marca puede diseñar una relación recurrente alrededor del producto sin obligar a descargar una app.", action: "Mostrá reglas claras y validá la participación antes de otorgar puntos o beneficios.", tags: ["Puntos", "Desafíos", "Recompensas"] },
        "service.ownership": { eyebrow: "Registro del producto", title: "El cliente puede iniciar la asociación del producto a su cuenta.", signal: "Se inició el registro de {product} · {lot}.", value: "Crea una base para beneficios, historial y servicio personalizados; no prueba identidad ni propiedad legal.", action: "Pedí consentimiento y verificá la evidencia necesaria antes de confirmar la asociación.", tags: ["Mi producto", "Consentimiento", "Ciclo de vida"] },
        "service.contact": { eyebrow: "Atención contextual", title: "La consulta puede llegar sabiendo de qué producto se habla.", signal: "El cliente pidió hablar con la marca desde {product} · {lot}.", value: "Evita empezar la conversación sin contexto, aunque todavía no significa que la consulta fue respondida.", action: "Pedí el motivo y derivá el caso al equipo correspondiente.", tags: ["Atención", "Producto", "Derivación"] },
      },
    },
    now: "Ahora",
    truth: "Simulación sin datos reales ni escritura en producción. Los eventos aparecen sólo dentro de esta vista.",
    sampleEvents: [
      { id: 3, kind: "service", impact: "service.warranty", regionId: "buenos-aires", title: "Intención de garantía registrada", detail: "Reserva Andina · Lote RA-2407", time: "Hace 2 min" },
      { id: 2, kind: "content", impact: "content.story", regionId: "buenos-aires", title: "Historia consultada", detail: "Reserva Andina · Ficha de producto", time: "Hace 8 min" },
      { id: 1, kind: "identity", impact: "identity", regionId: "mendoza", title: "Identidad vinculada", detail: "Reserva Andina · Lote RA-2407", time: "Hace 14 min" },
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
      services: { label: "Services", helper: "Configure useful actions", eyebrow: "03 · After purchase", title: "Define what customers can do from the product.", body: "Warranty, loyalty, registration and contact are independent actions. Try each one and see the signal your team receives." },
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
        warranty: { label: "Start warranty request", helper: "Start the form; the brand confirms activation and follow-up", event: "Warranty intent recorded" },
        benefit: { label: "Points, challenges and benefits", helper: "Rules, rewards and experiences defined by the brand", event: "Loyalty experience opened" },
        ownership: { label: "Register my product", helper: "Start linking it to an account with consent", event: "Product registration started" },
        contact: { label: "Contact the brand", helper: "Question linked to product and batch", event: "Contact requested" },
      },
    },
    signals: { filtersLabel: "Filter illustrative activity", filters: { all: "All", identity: "Identity", content: "Content", service: "Services" }, dashboardTitle: "Events received by your team", reads: "Linked identities", opened: "Content views", requested: "Services started", feedTitle: "Recent events · latest 8", empty: "There are no events in this filter." },
    latestEmpty: "Interact with the preview to generate an illustrative event.",
    impact: {
      event: "Illustrative event",
      title: "What happened and what your brand can do",
      views: { impact: "Impact", map: "Demo geography" },
      signal: "Observed signal",
      value: "Value for your brand",
      action: "Possible next action",
      mapTitle: "Simulated activity map",
      mapSubtitle: "Each point groups events generated only within this demo.",
      mapPoints: "Points",
      mapHeat: "Heatmap",
      mapTotal: "simulated events in this view",
      mapTotalOne: "simulated event in this view",
      mapSelected: "Example region",
      mapUse: "What this helps explain",
      mapUseBody: "In a live integration, this view can aggregate events with reported location to compare campaigns, content and service demand by region.",
      mapTruth: "Regions are part of the demo scenario and do not represent the visitor's location. A tap does not provide GPS by itself.",
      mapRegionNames: { mendoza: "Mendoza", "buenos-aires": "Buenos Aires", cordoba: "Córdoba", rosario: "Rosario", santiago: "Santiago" },
      mapPointEvidence: "Event generated in this simulation",
      mapPointSeen: "Demo session",
      items: {
        identity: { eyebrow: "Operational identity", title: "One product, one batch and one experience under the same reference.", signal: "The demo label was linked to {product} · Batch {lot}.", value: "Keeps content, services and events tied to a specific reference.", action: "Review the fields and publish the experience only after approval.", tags: ["Identity", "Batch", "Governance"] },
        "content.story": { eyebrow: "Storytelling", title: "The story opens an opportunity for an ongoing relationship.", signal: "The Product story for {product} was opened.", value: "Your team knows that the harvest, making and brand narrative were viewed.", action: "Invite people to save the product, join the club or discover a related story.", tags: ["Story", "Club", "Loyalty"] },
        "content.origin": { eyebrow: "Declared origin", title: "Provenance no longer has to be fine print.", signal: "Origin and batch were opened for {product} · {lot}.", value: "The provenance and batch reference view is recorded separately from other content.", action: "Verify that origin and batch are complete and keep them current.", tags: ["Origin", "Batch", "Transparency"] },
        "content.care": { eyebrow: "Product guidance", title: "Useful post-purchase guidance can also build loyalty.", signal: "Usage and storage guidance was opened for {product}.", value: "The brand records a guidance view without inferring why that content was opened.", action: "Offer a useful guide and, when appropriate, a complementary experience or recommendation.", tags: ["Usage", "Useful content", "Repeat purchase"] },
        "service.warranty": { eyebrow: "After-sales", title: "Warranty intent arrives with product and batch context.", signal: "The customer selected Start warranty request for {product} · {lot}.", value: "The team receives intent with context; it does not yet confirm warranty activation.", action: "Request the required details, confirm status and only then assign follow-up.", tags: ["Warranty", "Context", "Follow-up"] },
        "service.benefit": { eyebrow: "Loyalty + gamification", title: "The product can unlock points, challenges and rewards.", signal: "The customer opened the loyalty experience from {product}.", value: "The brand can design recurring engagement around the product without requiring an app download.", action: "Show clear rules and verify participation before granting points or benefits.", tags: ["Points", "Challenges", "Rewards"] },
        "service.ownership": { eyebrow: "Product registration", title: "Customers can start linking a product to their account.", signal: "Registration started for {product} · {lot}.", value: "Creates a base for personalized benefits, history and service; it does not prove identity or legal ownership.", action: "Request consent and verify the required evidence before confirming the link.", tags: ["My product", "Consent", "Lifecycle"] },
        "service.contact": { eyebrow: "Contextual support", title: "The conversation can begin with the product already identified.", signal: "The customer asked to contact the brand from {product} · {lot}.", value: "Avoids starting without context, although it does not mean the request was answered.", action: "Ask for the reason and route the case to the appropriate team.", tags: ["Support", "Product", "Routing"] },
      },
    },
    now: "Now",
    truth: "Simulation with no real data or production writes. Events exist only inside this view.",
    sampleEvents: [
      { id: 3, kind: "service", impact: "service.warranty", regionId: "buenos-aires", title: "Warranty intent recorded", detail: "Reserva Andina · Batch RA-2407", time: "2 min ago" },
      { id: 2, kind: "content", impact: "content.story", regionId: "buenos-aires", title: "Story viewed", detail: "Reserva Andina · Product profile", time: "8 min ago" },
      { id: 1, kind: "identity", impact: "identity", regionId: "mendoza", title: "Identity linked", detail: "Reserva Andina · Batch RA-2407", time: "14 min ago" },
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
      services: { label: "Serviços", helper: "Configure ações úteis", eyebrow: "03 · Depois da compra", title: "Defina o que o cliente pode fazer a partir do produto.", body: "Garantia, fidelização, registro e contato são ações independentes. Teste cada uma e veja qual sinal sua equipe recebe." },
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
        warranty: { label: "Solicitar garantia", helper: "Inicie o formulário; a marca confirma a ativação e o acompanhamento", event: "Intenção de garantia registrada" },
        benefit: { label: "Pontos, desafios e benefícios", helper: "Regras, recompensas e experiências definidas pela marca", event: "Experiência de fidelização aberta" },
        ownership: { label: "Registrar meu produto", helper: "Iniciar a associação a uma conta com consentimento", event: "Registro do produto iniciado" },
        contact: { label: "Falar com a marca", helper: "Consulta vinculada ao produto e lote", event: "Contato solicitado" },
      },
    },
    signals: { filtersLabel: "Filtrar atividade ilustrativa", filters: { all: "Tudo", identity: "Identidade", content: "Conteúdo", service: "Serviços" }, dashboardTitle: "Eventos recebidos pela sua equipe", reads: "Identidades vinculadas", opened: "Conteúdos consultados", requested: "Serviços iniciados", feedTitle: "Eventos recentes · últimos 8", empty: "Não há eventos neste filtro." },
    latestEmpty: "Interaja com a prévia para gerar um evento ilustrativo.",
    impact: {
      event: "Evento ilustrativo",
      title: "O que aconteceu e o que sua marca pode fazer",
      views: { impact: "Impacto", map: "Geografia demo" },
      signal: "Sinal observado",
      value: "Valor para sua marca",
      action: "Próxima ação possível",
      mapTitle: "Mapa de atividade simulada",
      mapSubtitle: "Cada ponto reúne eventos gerados somente nesta demonstração.",
      mapPoints: "Pontos",
      mapHeat: "Mapa de calor",
      mapTotal: "eventos simulados nesta visualização",
      mapTotalOne: "evento simulado nesta visualização",
      mapSelected: "Região de exemplo",
      mapUse: "O que ajuda a entender",
      mapUseBody: "Em uma integração real, esta visualização pode agrupar eventos com localização informada para comparar campanhas, conteúdo e demanda de atendimento por região.",
      mapTruth: "As regiões fazem parte do cenário de demonstração e não representam a localização do visitante. Um tap, por si só, não fornece GPS.",
      mapRegionNames: { mendoza: "Mendoza", "buenos-aires": "Buenos Aires", cordoba: "Córdoba", rosario: "Rosário", santiago: "Santiago" },
      mapPointEvidence: "Evento gerado nesta simulação",
      mapPointSeen: "Sessão demo",
      items: {
        identity: { eyebrow: "Identidade operacional", title: "Um produto, um lote e uma experiência sob a mesma referência.", signal: "A etiqueta demo foi vinculada a {product} · Lote {lot}.", value: "Mantém conteúdo, serviços e eventos associados a uma referência concreta.", action: "Revise os dados e publique a experiência somente depois da aprovação.", tags: ["Identidade", "Lote", "Governança"] },
        "content.story": { eyebrow: "Storytelling", title: "A história abre uma oportunidade de relacionamento.", signal: "A História do produto de {product} foi aberta.", value: "Sua equipe sabe que a safra, a elaboração e a narrativa da marca foram consultadas.", action: "Convide o cliente a salvar o produto, entrar no clube ou descobrir outra história relacionada.", tags: ["História", "Clube", "Fidelização"] },
        "content.origin": { eyebrow: "Origem declarada", title: "A procedência deixa de ser letra pequena.", signal: "Origem e lote foram abertos para {product} · {lot}.", value: "A consulta de procedência e lote fica registrada separadamente dos outros conteúdos.", action: "Verifique se origem e lote estão completos e mantenha-os atualizados.", tags: ["Origem", "Lote", "Transparência"] },
        "content.care": { eyebrow: "Orientação", title: "A utilidade depois da compra também fideliza.", signal: "As recomendações de uso e conservação de {product} foram abertas.", value: "A marca registra uma consulta de orientação sem inferir por que esse conteúdo foi aberto.", action: "Ofereça um guia útil e, quando fizer sentido, uma experiência ou recomendação complementar.", tags: ["Uso", "Conteúdo útil", "Recompra"] },
        "service.warranty": { eyebrow: "Pós-venda", title: "A intenção de garantia chega com produto e lote.", signal: "O cliente selecionou Solicitar garantia para {product} · {lot}.", value: "A equipe recebe a intenção com contexto; isso ainda não confirma a ativação da garantia.", action: "Solicite os dados, confirme o status e só então encaminhe o acompanhamento.", tags: ["Garantia", "Contexto", "Acompanhamento"] },
        "service.benefit": { eyebrow: "Fidelização + gamificação", title: "O produto pode abrir pontos, desafios e recompensas.", signal: "O cliente abriu a experiência de fidelização a partir de {product}.", value: "A marca pode criar recorrência em torno do produto sem exigir o download de um app.", action: "Mostre regras claras e valide a participação antes de conceder pontos ou benefícios.", tags: ["Pontos", "Desafios", "Recompensas"] },
        "service.ownership": { eyebrow: "Registro do produto", title: "O cliente pode iniciar a associação do produto à sua conta.", signal: "O registro de {product} · {lot} foi iniciado.", value: "Cria uma base para benefícios, histórico e serviço personalizados; não comprova identidade nem propriedade legal.", action: "Solicite consentimento e verifique as evidências antes de confirmar a associação.", tags: ["Meu produto", "Consentimento", "Ciclo de vida"] },
        "service.contact": { eyebrow: "Atendimento contextual", title: "A conversa pode começar com o produto já identificado.", signal: "O cliente pediu para falar com a marca a partir de {product} · {lot}.", value: "Evita começar sem contexto, embora ainda não signifique que a solicitação foi respondida.", action: "Solicite o motivo e encaminhe o caso para a equipe responsável.", tags: ["Atendimento", "Produto", "Encaminhamento"] },
      },
    },
    now: "Agora",
    truth: "Simulação sem dados reais nem gravação em produção. Os eventos existem apenas nesta visualização.",
    sampleEvents: [
      { id: 3, kind: "service", impact: "service.warranty", regionId: "buenos-aires", title: "Intenção de garantia registrada", detail: "Reserva Andina · Lote RA-2407", time: "Há 2 min" },
      { id: 2, kind: "content", impact: "content.story", regionId: "buenos-aires", title: "História consultada", detail: "Reserva Andina · Ficha do produto", time: "Há 8 min" },
      { id: 1, kind: "identity", impact: "identity", regionId: "mendoza", title: "Identidade vinculada", detail: "Reserva Andina · Lote RA-2407", time: "Há 14 min" },
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

function interpolateImpact(text: string, identity: ProductIdentity) {
  return text.replaceAll("{product}", identity.product).replaceAll("{lot}", identity.lot);
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
  const [services, setServices] = useState<Record<ServiceKey, boolean>>({ warranty: true, benefit: true, ownership: true, contact: true });
  const [events, setEvents] = useState<DemoEvent[]>(() => [...copy.sampleEvents]);
  const [filter, setFilter] = useState<EventFilter>("all");
  const [focusedEventId, setFocusedEventId] = useState<number | null>(() => copy.sampleEvents.find((event) => event.impact === "identity")?.id ?? copy.sampleEvents[0]?.id ?? null);
  const [impactView, setImpactView] = useState<ImpactView>("impact");
  const [mapDensity, setMapDensity] = useState<MapDensity>("balanced");
  const [selectedMapPointId, setSelectedMapPointId] = useState<string>(() => copy.sampleEvents.find((event) => event.impact === "identity")?.regionId ?? copy.sampleEvents[0]?.regionId ?? "mendoza");
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
  const eventCounts = useMemo(() => countEvents(events), [events]);
  const activeEvent = useMemo(() => visibleEvents.find((event) => event.id === focusedEventId) ?? visibleEvents[0] ?? null, [focusedEventId, visibleEvents]);
  const activeImpactKey: ImpactKey = activeEvent?.impact ?? "identity";
  const impactItem = copy.impact.items[activeImpactKey];
  const ImpactIcon = IMPACT_ICONS[activeImpactKey];
  const simulatedMapPoints = useMemo<VectorMapPoint[]>(() => DEMO_REGION_COORDINATES.flatMap((region) => {
    const regionEvents = visibleEvents.filter((event) => event.regionId === region.id);
    if (!regionEvents.length) return [];
    return [{
      id: region.id,
      label: copy.impact.mapRegionNames[region.id] ?? region.id,
      sublabel: regionEvents[0]?.title,
      lat: region.lat,
      lng: region.lng,
      scans: regionEvents.length,
      tone: "tap" as const,
      evidence: copy.impact.mapPointEvidence,
      lastSeen: copy.impact.mapPointSeen,
    }];
  }), [copy.impact.mapPointEvidence, copy.impact.mapPointSeen, copy.impact.mapRegionNames, visibleEvents]);
  const simulatedEventTotal = simulatedMapPoints.reduce((total, point) => total + Number(point.scans ?? 0), 0);
  const simulatedEventLabel = simulatedEventTotal === 1 ? copy.impact.mapTotalOne : copy.impact.mapTotal;
  const selectedMapPoint = simulatedMapPoints.find((point) => point.id === selectedMapPointId) ?? simulatedMapPoints[0] ?? null;

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
    setFilter("all");
    const identityEvent = copy.sampleEvents.find((event) => event.impact === "identity");
    setFocusedEventId(identityEvent?.id ?? copy.sampleEvents[0]?.id ?? null);
    setImpactView("impact");
    setMapDensity("balanced");
    setSelectedMapPointId(identityEvent?.regionId ?? copy.sampleEvents[0]?.regionId ?? "mendoza");
  }, [copy.sampleEvents, resolvedLocale]);

  const recordEvent = (kind: EventKind, title: string, detail: string, impact: ImpactKey) => {
    const id = Date.now();
    const regionId = DEMO_REGION_COORDINATES[Math.floor(id / 1000) % DEMO_REGION_COORDINATES.length]?.id ?? "mendoza";
    setEvents((current) => [{ id, kind, impact, regionId, title, detail, time: copy.now }, ...current].slice(0, 8));
    setFocusedEventId(id);
    setSelectedMapPointId(regionId);
    setImpactView("impact");
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
    recordEvent("identity", copy.identity.event, nextIdentity.product + " · " + nextIdentity.lot, "identity");
  };

  const updateIdentity = (field: keyof ProductIdentity, value: string) => {
    setDraftIdentity((current) => ({ ...current, [field]: value }));
  };

  const selectMode = (key: ModeKey) => {
    setSelected(key);
    if (key !== "signals") setFilter("all");
    const matchingKind: EventKind | null = key === "identity" ? "identity" : key === "content" ? "content" : key === "services" ? "service" : null;
    const matchingEvent = matchingKind ? events.find((event) => event.kind === matchingKind) : null;
    if (matchingEvent) {
      setFocusedEventId(matchingEvent.id);
      setSelectedMapPointId(matchingEvent.regionId);
      setImpactView("impact");
    }
    setPulseKey((current) => current + 1);
  };

  const selectFilter = (nextFilter: EventFilter) => {
    setFilter(nextFilter);
    const matchingEvent = nextFilter === "all" ? events[0] : events.find((event) => event.kind === nextFilter);
    setFocusedEventId(matchingEvent?.id ?? null);
    if (matchingEvent) setSelectedMapPointId(matchingEvent.regionId);
    setImpactView("impact");
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
              <legend>{copy.services.legend}<span>{activeServices.length}/{SERVICE_ORDER.length} {copy.services.enabled}</span></legend>
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
              <div role="group" aria-label={copy.signals.filtersLabel}>{(Object.keys(copy.signals.filters) as EventFilter[]).map((key) => <button key={key} type="button" aria-pressed={filter === key} onClick={() => selectFilter(key)}>{copy.signals.filters[key]}</button>)}</div>
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
                    return <button key={key} type="button" onClick={() => recordEvent("content", item.event, (product || DEMO_PRODUCT.name) + " · " + item.label, `content.${key}`)}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.helper}</small></span><ChevronRight aria-hidden="true" /></button>;
                  })}
                  {selected === "services" && activeServices.map((key) => {
                    const Icon = SERVICE_ICONS[key];
                    const item = copy.services.items[key];
                    return <button key={key} type="button" onClick={() => recordEvent("service", item.event, (product || DEMO_PRODUCT.name) + " · " + (lot || DEMO_PRODUCT.lot), `service.${key}`)}><Icon aria-hidden="true" /><span><strong>{item.label}</strong><small>{item.helper}</small></span><ChevronRight aria-hidden="true" /></button>;
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
              <ol className={styles.eventFeed}>{visibleEvents.map((event) => (
                <li key={event.id} data-kind={event.kind} data-selected={activeEvent?.id === event.id ? "true" : "false"}>
                  <button
                    type="button"
                    aria-pressed={activeEvent?.id === event.id}
                    onClick={() => {
                      setFocusedEventId(event.id);
                      setSelectedMapPointId(event.regionId);
                      setImpactView("impact");
                      setPulseKey((current) => current + 1);
                    }}
                  >
                    <i aria-hidden="true" />
                    <span><strong>{event.title}</strong><small>{event.detail}</small></span>
                    <time>{event.time}</time>
                  </button>
                </li>
              ))}</ol>
              {visibleEvents.length === 0 ? <p className={styles.emptyFeed}>{copy.signals.empty}</p> : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className={styles.impactConsole} aria-label={copy.impact.title}>
        <header className={styles.impactHeader}>
          <div className={styles.impactEvent} aria-live="polite" aria-atomic="true">
            <span className={styles.impactEventIcon}><ImpactIcon aria-hidden="true" /></span>
            <span><small>{copy.impact.event}</small><strong>{activeEvent?.title ?? copy.latestEmpty}</strong><em>{activeEvent?.detail ?? product + " · " + lot}</em></span>
          </div>
          <div className={styles.impactViewSwitch} role="group" aria-label={copy.impact.title}>
            {(Object.keys(copy.impact.views) as ImpactView[]).map((view) => (
              <button key={view} type="button" aria-pressed={impactView === view} onClick={() => setImpactView(view)}>
                {view === "impact" ? <MousePointerClick aria-hidden="true" /> : <MapPinned aria-hidden="true" />}
                {copy.impact.views[view]}
              </button>
            ))}
          </div>
        </header>

        {impactView === "impact" ? (
          <div className={styles.impactNarrative} key={activeImpactKey}>
            <div className={styles.impactLead}>
              <span>{impactItem.eyebrow}</span>
              <h3>{impactItem.title}</h3>
              <div className={styles.impactTags}>{impactItem.tags.map((tag) => <small key={tag}>{tag}</small>)}</div>
            </div>

            <div className={styles.impactCards}>
              <article>
                <MousePointerClick aria-hidden="true" />
                <span><small>{copy.impact.signal}</small><strong>{interpolateImpact(impactItem.signal, linkedIdentity)}</strong></span>
              </article>
              <article>
                <Trophy aria-hidden="true" />
                <span><small>{copy.impact.value}</small><strong>{interpolateImpact(impactItem.value, linkedIdentity)}</strong></span>
              </article>
              <article>
                <ArrowRight aria-hidden="true" />
                <span><small>{copy.impact.action}</small><strong>{interpolateImpact(impactItem.action, linkedIdentity)}</strong></span>
              </article>
            </div>
          </div>
        ) : (
          <div className={styles.mapPanel}>
            <div className={styles.mapToolbar}>
              <div><span>{copy.impact.mapTitle}</span><p>{copy.impact.mapSubtitle}</p></div>
              <div role="group" aria-label={copy.impact.mapTitle}>
                <button type="button" aria-pressed={mapDensity === "balanced"} onClick={() => setMapDensity("balanced")}>{copy.impact.mapPoints}</button>
                <button type="button" aria-pressed={mapDensity === "heat"} onClick={() => setMapDensity("heat")}>{copy.impact.mapHeat}</button>
              </div>
            </div>
            <div className={styles.mapGrid}>
              <PremiumVectorMap
                points={simulatedMapPoints}
                selectedPointId={selectedMapPoint?.id}
                onPointSelect={(point) => setSelectedMapPointId(point.id)}
                title={copy.impact.mapTitle}
                subtitle={copy.impact.mapSubtitle}
                ariaLabel={`${copy.impact.mapTitle}. ${simulatedEventTotal} ${simulatedEventLabel}.`}
                labels={MAP_LABELS[resolvedLocale]}
                density={mapDensity}
                chrome="minimal"
                maxPoints={DEMO_REGION_COORDINATES.length}
                externalTiles
                heightClassName={styles.impactMapHeight}
                className={styles.impactMap}
              />
              <aside className={styles.mapSummary}>
                <div className={styles.mapTotal}><RadioTower aria-hidden="true" /><span><strong>{simulatedEventTotal}</strong><small>{simulatedEventLabel}</small></span></div>
                <div className={styles.mapSelected}><small>{copy.impact.mapSelected}</small><strong>{selectedMapPoint?.label ?? "—"}</strong><span>{selectedMapPoint?.scans ?? 0} · {selectedMapPoint?.sublabel ?? copy.latestEmpty}</span></div>
                <div className={styles.mapUse}><small>{copy.impact.mapUse}</small><p>{copy.impact.mapUseBody}</p></div>
                <div className={styles.mapRegionList}>
                  {simulatedMapPoints.map((point) => (
                    <button key={point.id} type="button" aria-pressed={selectedMapPoint?.id === point.id} onClick={() => setSelectedMapPointId(point.id)}>
                      <span>{point.label}</span><strong>{point.scans ?? 0}</strong>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        )}

        <p className={styles.impactTruth}><BadgeCheck aria-hidden="true" />{impactView === "map" ? copy.impact.mapTruth : copy.truth}</p>
      </section>
    </div>
  );
}
