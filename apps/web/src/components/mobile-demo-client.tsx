"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card } from "@product/ui";
import type { VectorMapEvidenceStep, VectorMapLedgerItem, VectorMapPoint, VectorMapRoute } from "@product/ui/premium-vector-map";

const Globe3dMap = dynamic(
  () => import("@product/ui/globe-3d-map").then((module) => module.Globe3dMap),
  {
    ssr: false,
    loading: () => <div className="flex h-[180px] w-[260px] items-center justify-center text-[11px] text-slate-400">Cargando mapa ilustrativo...</div>,
  },
);

type DemoMode = "consumer_tap" | "consumer_opened" | "consumer_tamper" | "consumer_duplicate";
type ConsumerState = "AUTH_PENDING" | "VALID" | "OPENED" | "TAMPER_RISK" | "CLAIMED" | "REPLAY_SUSPECT" | "DELIVERED_CLOSED" | "DELIVERED_OPENED" | "OFFLINE_PENDING";

type EventItem = { type: string; note: string; at: string };
type LeadIntent = "request_demo" | "talk_sales" | "become_reseller" | "request_quote" | "tokenization_optional";
type GeoState = { lat: number; lng: number; accuracy?: number | null; capturedAt: string };

export type MobileDemoBidSource = "query" | "demo-pack" | "missing";

export type SeedItem = {
  id?: string | number;
  itemId?: string;
  item_id?: string;
  uidHex?: string;
  uid_hex?: string;
  bid?: string;
  batchId?: string;
  batch_id?: string;
  vertical?: string;
  productName?: string;
  name?: string;
  display_name?: string;
  sku?: string;
  serial?: string;
  rollId?: string;
  roll_id?: string;
  vintage?: string | number;
  region?: string;
  notes?: string;
  varietal?: string;
  grapeVarietal?: string;
  grape_varietal?: string;
  alcohol?: string;
  alcoholPct?: string | number;
  barrelAging?: string;
  barrelMonths?: string | number;
  barrel_months?: string | number;
  serviceTemperature?: string;
  service_temperature?: string;
  harvestYear?: string | number;
  harvest_year?: string | number;
  soilHumidity?: string | number;
  soil_humidity?: string | number;
  vineyardHumidity?: string | number;
  vineyard_humidity?: string | number;
  temperatureStorage?: string;
  temperature_storage?: string;
};

type VerticalTemplate = {
  key: "wine" | "agro" | "perfume" | "pharma";
  title: string;
  subtitle: string;
  fields: Array<{ label: string; value: (item: SeedItem) => string }>;
};

type MobileCopyLocale = "es-AR" | "en" | "pt-BR";

type AgroPresentation = {
  title: string;
  subtitle: string;
  fieldLabels: readonly [string, string, string, string, string, string];
  productViewLabel: string;
  productFallback: string;
  productMeta: string;
  packetLabel: string;
  itemContext: string;
  returnLabel: string;
  evidenceBoundary: string;
  trustIndexLabel: string;
  trustIndexAria: string;
  trustIndexNote: string;
  investorTitle: string;
  investorBody: string;
};

const MODE_STATE: Record<DemoMode, ConsumerState> = {
  consumer_tap: "VALID",
  consumer_opened: "OPENED",
  consumer_tamper: "TAMPER_RISK",
  consumer_duplicate: "REPLAY_SUSPECT",
};

const BID_RE = /^[A-Za-z0-9._:-]{3,120}$/;
const MOBILE_DEMO_STORAGE_PREFIX = "nexid:mobile:";
const MOBILE_DEMO_STORAGE_VERSION = "v2";
const STORED_EVENT_NOTE = "Evento de simulación restaurado sin datos personales.";

const ILLUSTRATIVE_ORIGINS: Record<VerticalTemplate["key"], { name: string; lat: number; lng: number }> = {
  wine: { name: "Origen demo · Mendoza", lat: -33.0086, lng: -68.7794 },
  agro: { name: "Origen demo · Córdoba", lat: -31.4201, lng: -64.1888 },
  perfume: { name: "Origen demo · São Paulo", lat: -23.5505, lng: -46.6333 },
  pharma: { name: "Origen demo · Bogotá", lat: 4.711, lng: -74.0721 },
};

const STATE_COPY: Record<ConsumerState, { label: string; tone: "green" | "amber" | "cyan" | "red"; message: string }> = {
  AUTH_PENDING: { label: "DEMO LOADING", tone: "cyan", message: "Preparando el escenario visual. La validación criptográfica SUN/SDM sólo ocurre en el flujo físico `/sun`." },
  VALID: { label: "VALID", tone: "green", message: "Lectura aceptada por la demo; en produccion depende de validacion backend, SUN/SDM y estado del lote." },
  OPENED: { label: "TT OPEN REPORTED", tone: "cyan", message: "TT reporta abierto; no certifica apertura, sello ni contenido físico." },
  TAMPER_RISK: { label: "TT RISK REPORTED", tone: "amber", message: "La demo recibió una señal TT o de contexto para revisión; no prueba manipulación física." },
  CLAIMED: { label: "CLAIMED", tone: "green", message: "Ownership activado para lifecycle, soporte y postventa." },
  REPLAY_SUSPECT: { label: "REPLAY SUSPECT", tone: "red", message: "Mensaje repetido o reutilizado según contador y política; no determina el objeto físico." },
  DELIVERED_CLOSED: { label: "TT CLOSED", tone: "green", message: "La demo registra entrega y TT reporta cerrado; no prueba el contenido ni la custodia física." },
  DELIVERED_OPENED: { label: "TT OPEN REPORTED", tone: "red", message: "La demo registra entrega y TT reporta abierto. Revisar antes de actuar; no prueba el sello físico." },
  OFFLINE_PENDING: { label: "OFFLINE PENDING", tone: "amber", message: "Validación pendiente. El backend decidirá sobre el mensaje criptográfico al recuperar conexión." },
};

const AGRO_PRESENTATION: Record<MobileCopyLocale, AgroPresentation> = {
  "es-AR": {
    title: "Pasaporte digital del lote",
    subtitle: "Datos declarados del lote y evidencia digital acotada para esta consulta.",
    fieldLabels: ["Campaña", "Humedad de suelo", "Humedad de campo", "Almacenamiento", "Región declarada", "Indicaciones declaradas"],
    productViewLabel: "Vista del lote · Demo",
    productFallback: "Lote de semillas · Demo",
    productMeta: "Ficha de lote simulada · Sin datos de cliente",
    packetLabel: "LOTE",
    itemContext: "Escenario agro simulado · Sin datos de cliente",
    returnLabel: "Volver al Demo Lab de semillas",
    evidenceBoundary: "Evidencia acotada: esta pantalla muestra un identificador, datos declarados y señales digitales del escenario. No certifica autenticidad física, variedad, calidad, contenido, origen ni custodia.",
    trustIndexLabel: "Índice ilustrativo de la demo",
    trustIndexAria: "Índice ilustrativo del escenario de semillas",
    trustIndexNote: "Indicador calculado en el navegador para esta simulación; no es un score productivo ni prueba el producto físico.",
    investorTitle: "Resumen del escenario agro",
    investorBody: "La demo conecta identidad digital declarada, señales del tag y acciones de soporte. No certifica las semillas, el contenido ni el envase físico.",
  },
  en: {
    title: "Seed-lot digital passport",
    subtitle: "Declared lot data and bounded digital evidence for this query.",
    fieldLabels: ["Season", "Soil moisture", "Field moisture", "Storage", "Declared region", "Declared guidance"],
    productViewLabel: "Lot view · Demo",
    productFallback: "Seed lot · Demo",
    productMeta: "Simulated lot record · No customer data",
    packetLabel: "LOT",
    itemContext: "Simulated agriculture scenario · No customer data",
    returnLabel: "Back to the seeds Demo Lab",
    evidenceBoundary: "Bounded evidence: this screen shows an identifier, declared data and digital signals from the scenario. It does not certify physical authenticity, variety, quality, contents, origin or custody.",
    trustIndexLabel: "Illustrative demo index",
    trustIndexAria: "Illustrative seed-scenario index",
    trustIndexNote: "Browser-calculated indicator for this simulation; it is not a production score and does not prove the physical product.",
    investorTitle: "Agriculture scenario summary",
    investorBody: "The demo connects declared digital identity, tag signals and support actions. It does not certify the seeds, contents or physical package.",
  },
  "pt-BR": {
    title: "Passaporte digital do lote",
    subtitle: "Dados declarados do lote e evidência digital limitada para esta consulta.",
    fieldLabels: ["Safra", "Umidade do solo", "Umidade do campo", "Armazenamento", "Região declarada", "Orientações declaradas"],
    productViewLabel: "Vista do lote · Demo",
    productFallback: "Lote de sementes · Demo",
    productMeta: "Ficha de lote simulada · Sem dados de cliente",
    packetLabel: "LOTE",
    itemContext: "Cenário agrícola simulado · Sem dados de cliente",
    returnLabel: "Voltar ao Demo Lab de sementes",
    evidenceBoundary: "Evidência limitada: esta tela mostra um identificador, dados declarados e sinais digitais do cenário. Não certifica autenticidade física, variedade, qualidade, conteúdo, origem ou custódia.",
    trustIndexLabel: "Índice ilustrativo da demo",
    trustIndexAria: "Índice ilustrativo do cenário de sementes",
    trustIndexNote: "Indicador calculado no navegador para esta simulação; não é um score produtivo nem comprova o produto físico.",
    investorTitle: "Resumo do cenário agrícola",
    investorBody: "A demo conecta identidade digital declarada, sinais da tag e ações de suporte. Não certifica as sementes, o conteúdo nem a embalagem física.",
  },
};

const AGRO_STATE_COPY: Record<MobileCopyLocale, Record<ConsumerState, { label: string; message: string }>> = {
  "es-AR": {
    AUTH_PENDING: { label: "PREPARANDO DEMO", message: "Preparando el escenario simulado. Todavía no hay evidencia digital validada." },
    VALID: { label: "LECTURA DEMO ACEPTADA", message: "El identificador y la política del escenario pasaron los controles de la demo. Esto no autentica las semillas, el contenido ni el envase físico." },
    OPENED: { label: "APERTURA REPORTADA", message: "El tag reporta apertura en la simulación; no prueba el estado, el cierre ni el contenido del envase físico." },
    TAMPER_RISK: { label: "SEÑAL PARA REVISIÓN", message: "La demo recibió una señal digital para revisión. No demuestra manipulación ni daño físico." },
    CLAIMED: { label: "DERECHO DIGITAL SIMULADO", message: "La demo registró un estado digital de lifecycle; no transfiere propiedad ni derechos sobre el producto físico." },
    REPLAY_SUSPECT: { label: "POSIBLE REPLAY DEMO", message: "La política del escenario marcó una posible reutilización del mensaje. No determina la identidad ni la condición del producto físico." },
    DELIVERED_CLOSED: { label: "CIERRE REPORTADO", message: "La demo registra entrega y un cierre reportado por el tag; no prueba contenido, calidad ni custodia física." },
    DELIVERED_OPENED: { label: "APERTURA REPORTADA", message: "La demo registra entrega y apertura reportada. Requiere revisión; no prueba el estado físico del envase." },
    OFFLINE_PENDING: { label: "VALIDACIÓN PENDIENTE", message: "Sin conexión no se valida el mensaje digital. Los datos públicos siguen siendo declarados y no autentican el producto físico." },
  },
  en: {
    AUTH_PENDING: { label: "PREPARING DEMO", message: "Preparing the simulated scenario. No digital evidence has been validated yet." },
    VALID: { label: "DEMO READING ACCEPTED", message: "The scenario identifier and policy passed the demo checks. This does not authenticate the seeds, contents or physical package." },
    OPENED: { label: "OPEN STATE REPORTED", message: "The tag reports an open state in the simulation; it does not prove the state, seal or contents of the physical package." },
    TAMPER_RISK: { label: "SIGNAL FOR REVIEW", message: "The demo received a digital signal for review. It does not demonstrate physical tampering or damage." },
    CLAIMED: { label: "SIMULATED DIGITAL RIGHT", message: "The demo recorded a digital lifecycle state; it does not transfer ownership of or rights to the physical product." },
    REPLAY_SUSPECT: { label: "POSSIBLE DEMO REPLAY", message: "The scenario policy flagged possible message reuse. It does not determine the identity or condition of the physical product." },
    DELIVERED_CLOSED: { label: "CLOSED STATE REPORTED", message: "The demo records delivery and a tag-reported closed state; it does not prove contents, quality or physical custody." },
    DELIVERED_OPENED: { label: "OPEN STATE REPORTED", message: "The demo records delivery and a reported open state. Review is required; it does not prove the package's physical condition." },
    OFFLINE_PENDING: { label: "VALIDATION PENDING", message: "The digital message is not validated while offline. Public data remains declared and does not authenticate the physical product." },
  },
  "pt-BR": {
    AUTH_PENDING: { label: "PREPARANDO DEMO", message: "Preparando o cenário simulado. Ainda não há evidência digital validada." },
    VALID: { label: "LEITURA DEMO ACEITA", message: "O identificador e a política do cenário passaram pelos controles da demo. Isso não autentica as sementes, o conteúdo nem a embalagem física." },
    OPENED: { label: "ABERTURA REPORTADA", message: "A tag reporta abertura na simulação; isso não comprova o estado, o lacre nem o conteúdo da embalagem física." },
    TAMPER_RISK: { label: "SINAL PARA REVISÃO", message: "A demo recebeu um sinal digital para revisão. Isso não demonstra violação nem dano físico." },
    CLAIMED: { label: "DIREITO DIGITAL SIMULADO", message: "A demo registrou um estado digital de ciclo de vida; isso não transfere propriedade nem direitos sobre o produto físico." },
    REPLAY_SUSPECT: { label: "POSSÍVEL REPLAY DEMO", message: "A política do cenário marcou uma possível reutilização da mensagem. Isso não determina a identidade nem a condição do produto físico." },
    DELIVERED_CLOSED: { label: "FECHAMENTO REPORTADO", message: "A demo registra entrega e fechamento reportado pela tag; isso não comprova conteúdo, qualidade nem custódia física." },
    DELIVERED_OPENED: { label: "ABERTURA REPORTADA", message: "A demo registra entrega e abertura reportada. É preciso revisar; isso não comprova o estado físico da embalagem." },
    OFFLINE_PENDING: { label: "VALIDAÇÃO PENDENTE", message: "Sem conexão, a mensagem digital não é validada. Os dados públicos continuam declarados e não autenticam o produto físico." },
  },
};

function normalizeMobileCopyLocale(locale: string): MobileCopyLocale {
  const normalized = locale.trim().toLowerCase();
  if (normalized.startsWith("pt")) return "pt-BR";
  if (normalized.startsWith("en")) return "en";
  return "es-AR";
}

const MOBILE_UI_COPY: Record<MobileCopyLocale, {
  consumerApp: string;
  missingBidBadge: string;
  missingBidMessage: string;
  demoPackBadge: string;
  demoPackMessage: string;
  unverifiedBidBadge: string;
  unverifiedBidMessage: string;
  nfcEmulation: string;
  nfcProgressAria: string;
  nfcProgressBody: string;
  illustrativeMetrics: string;
  geoCapture: string;
}> = {
  "es-AR": {
    consumerApp: "Experiencia del comprador",
    missingBidBadge: "BID no disponible",
    missingBidMessage: "BID no disponible · No hay historial de procedencia para este fixture; las acciones protegidas requieren un tap físico.",
    demoPackBadge: "Pack de demostracion",
    demoPackMessage: "Modo demo · El BID proviene del dataset de demostracion y no prueba una lectura física.",
    unverifiedBidBadge: "BID sin verificar",
    unverifiedBidMessage: "BID informado · Este preview no ejecutó una validación SUN.",
    nfcEmulation: "Simulacion de lectura NFC",
    nfcProgressAria: "Progreso de la simulacion NFC",
    nfcProgressBody: "Animacion del escenario; no representa una validacion SUN ejecutada",
    illustrativeMetrics: "Metricas ilustrativas del escenario",
    geoCapture: "Ubicacion opcional de la demo",
  },
  "pt-BR": {
    consumerApp: "Experiencia do comprador",
    missingBidBadge: "BID indisponivel",
    missingBidMessage: "BID indisponivel · Nao ha historico de procedencia para este fixture; acoes protegidas exigem um tap fisico.",
    demoPackBadge: "Pack de demonstracao",
    demoPackMessage: "Modo demo · O BID vem do dataset de demonstracao e nao prova uma leitura fisica.",
    unverifiedBidBadge: "BID nao verificado",
    unverifiedBidMessage: "BID informado · Este preview nao executou validacao SUN.",
    nfcEmulation: "Simulacao de leitura NFC",
    nfcProgressAria: "Progresso da simulacao NFC",
    nfcProgressBody: "Animacao do cenario; nao representa uma validacao SUN executada",
    illustrativeMetrics: "Metricas ilustrativas do cenario",
    geoCapture: "Localizacao opcional da demo",
  },
  en: {
    consumerApp: "Buyer experience",
    missingBidBadge: "BID unavailable",
    missingBidMessage: "BID unavailable · This fixture has no provenance history; protected actions require a physical tap.",
    demoPackBadge: "Demo pack",
    demoPackMessage: "Demo mode · The BID comes from the demo dataset and does not prove a physical read.",
    unverifiedBidBadge: "Unverified BID",
    unverifiedBidMessage: "BID provided · This preview did not run SUN validation.",
    nfcEmulation: "NFC read simulation",
    nfcProgressAria: "NFC simulation progress",
    nfcProgressBody: "Scenario animation; it does not represent an executed SUN validation",
    illustrativeMetrics: "Illustrative scenario metrics",
    geoCapture: "Optional demo location",
  },
};

function nowIso() {
  return new Date().toISOString();
}

function seedItemUid(item: SeedItem) {
  return String(item.uidHex || item.uid_hex || "").trim().toUpperCase();
}

function seedItemSku(item: SeedItem) {
  return String(item.sku || item.serial || item.rollId || item.roll_id || "").trim();
}

function optionalMetric(value: unknown, suffix = "") {
  const text = String(value ?? "").trim();
  if (!text) return "N/D";
  return suffix && !text.endsWith(suffix) ? `${text}${suffix}` : text;
}

function optionalText(...values: unknown[]) {
  const text = values.map((value) => String(value ?? "").trim()).find(Boolean);
  return text || "N/D";
}

function seedItemName(item: SeedItem, fallback = "Reserva Demo 2024") {
  return String(item.productName || item.display_name || item.name || fallback);
}

function storeKey(tenant: string, itemId: string, pack: string) {
  return `${MOBILE_DEMO_STORAGE_PREFIX}${MOBILE_DEMO_STORAGE_VERSION}:${tenant}:${itemId}:${pack}`;
}

function parseStoredEvents(raw: string): EventItem[] {
  try {
    const parsed = JSON.parse(raw) as Array<{ type?: unknown; at?: unknown }>;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      const type = String(item?.type || "").trim();
      const at = String(item?.at || "").trim();
      if (!/^[A-Z0-9_:-]{1,64}$/.test(type) || !Number.isFinite(Date.parse(at))) return [];
      return [{ type, at: new Date(at).toISOString(), note: STORED_EVENT_NOTE }];
    }).slice(0, 12);
  } catch {
    return [];
  }
}

function serializeStoredEvents(events: EventItem[]) {
  return JSON.stringify(events.slice(0, 12).map(({ type, at }) => ({
    type: type.replace(/[^A-Z0-9_:-]/gi, "").slice(0, 64),
    at,
  })));
}

function purgeLegacyMobileDemoStorage(storage: Storage) {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(MOBILE_DEMO_STORAGE_PREFIX)
      && !key.startsWith(`${MOBILE_DEMO_STORAGE_PREFIX}${MOBILE_DEMO_STORAGE_VERSION}:`)) {
      storage.removeItem(key);
    }
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function approximateCoordinate(value: number) {
  return Math.round(value * 1_000) / 1_000;
}

function detectVertical(pack: string, item: SeedItem): VerticalTemplate["key"] {
  const probe = `${String(item.vertical || "")} ${pack}`.toLowerCase();
  if (probe.includes("agro") || probe.includes("seed")) return "agro";
  if (probe.includes("pharma")) return "pharma";
  if (probe.includes("cosmetic") || probe.includes("luxury") || probe.includes("perfume")) return "perfume";
  return "wine";
}

const VERTICAL_TEMPLATES: Record<VerticalTemplate["key"], VerticalTemplate> = {
  wine: {
    key: "wine",
    title: "Wine passport",
    subtitle: "Evidencia NFC/SUN + storytelling declarado + posventa premium.",
    fields: [
      { label: "Varietal", value: (item) => optionalText(item.varietal, item.grapeVarietal, item.grape_varietal) },
      { label: "Vintage", value: (item) => optionalText(item.vintage) },
      { label: "Alcohol", value: (item) => optionalMetric(item.alcohol ?? item.alcoholPct, item.alcohol ? "" : "%") },
      { label: "Barrel", value: (item) => optionalMetric(item.barrelAging ?? item.barrelMonths ?? item.barrel_months, item.barrelAging ? "" : " months") },
      { label: "Region", value: (item) => optionalText(item.region) },
      { label: "Service", value: (item) => optionalMetric(item.serviceTemperature ?? item.service_temperature) },
    ],
  },
  agro: {
    key: "agro",
    title: "Seed passport",
    subtitle: "Control de origen de semillas + guía agronómica por lote.",
    fields: [
      { label: "Harvest", value: (item) => optionalText(item.harvestYear, item.harvest_year, item.vintage) },
      { label: "Soil humidity", value: (item) => optionalMetric(item.soilHumidity ?? item.soil_humidity, "%") },
      { label: "Field humidity", value: (item) => optionalMetric(item.vineyardHumidity ?? item.vineyard_humidity, "%") },
      { label: "Storage", value: (item) => optionalMetric(item.temperatureStorage ?? item.temperature_storage) },
      { label: "Region", value: (item) => optionalText(item.region) },
      { label: "Notes", value: (item) => optionalText(item.notes) },
    ],
  },
  perfume: {
    key: "perfume",
    title: "Perfume passport",
    subtitle: "Evidencia del mensaje y anti-replay + narrativa de marca y coleccionables.",
    fields: [
      { label: "Fragrance family", value: (item) => optionalText(item.notes) },
      { label: "Launch", value: (item) => optionalText(item.vintage) },
      { label: "Region", value: (item) => optionalText(item.region) },
      { label: "Storage", value: (item) => optionalMetric(item.temperatureStorage ?? item.temperature_storage) },
      { label: "SKU", value: (item) => seedItemSku(item) || "N/D" },
      { label: "Notes", value: (item) => optionalText(item.notes) },
    ],
  },
  pharma: {
    key: "pharma",
    title: "Pharma passport",
    subtitle: "Integridad de empaque + trazabilidad regulatoria por unidad.",
    fields: [
      { label: "Batch year", value: (item) => optionalText(item.harvestYear, item.harvest_year, item.vintage) },
      { label: "Cold chain", value: (item) => optionalMetric(item.temperatureStorage ?? item.temperature_storage) },
      { label: "Region", value: (item) => optionalText(item.region) },
      { label: "SKU", value: (item) => seedItemSku(item) || "N/D" },
      { label: "Serial UID", value: (item) => seedItemUid(item) || "N/D" },
      { label: "Notes", value: (item) => optionalText(item.notes) },
    ],
  },
};

export function MobileDemoClient({
  tenant,
  itemId,
  pack,
  mode,
  locale,
  seedItem,
  bid,
  bidSource = "missing",
}: {
  tenant: string;
  itemId: string;
  pack: string;
  mode: DemoMode;
  locale: string;
  seedItem?: SeedItem;
  bid?: string;
  bidSource?: MobileDemoBidSource;
}) {
  const [consumerState, setConsumerState] = useState<ConsumerState>("AUTH_PENDING");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadIntent, setLeadIntent] = useState<LeadIntent>("request_demo");
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCompany, setLeadCompany] = useState("");
  const [leadCountry, setLeadCountry] = useState("");
  const [leadRole, setLeadRole] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadSaved, setLeadSaved] = useState(false);
  const [leadPending, setLeadPending] = useState(false);
  const [ctaStatus, setCtaStatus] = useState("");
  const [ctaPending, setCtaPending] = useState(false);
  const [scanProgress, setScanProgress] = useState(5);
  const [geoState, setGeoState] = useState<GeoState | null>(null);
  const [geoError, setGeoError] = useState("");
  const [geoRequestId, setGeoRequestId] = useState(0);

  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const demoSessionId = useMemo(() => `${tenant}:${itemId}:${pack}`, [itemId, pack, tenant]);

  const rawBid = (bid || "").trim();
  const effectiveBid = BID_RE.test(rawBid) ? rawBid : "";
  const geoRequested = geoRequestId > 0;
  const activeItem = seedItem || {};
  const activeUid = seedItemUid(activeItem);
  const activeSku = seedItemSku(activeItem);
  const activeVertical = detectVertical(pack, activeItem);
  const mobileCopyLocale = normalizeMobileCopyLocale(locale);
  const agroCopy = AGRO_PRESENTATION[mobileCopyLocale];
  const mobileUi = MOBILE_UI_COPY[mobileCopyLocale];
  const current = activeVertical === "agro"
    ? { ...STATE_COPY[consumerState], ...AGRO_STATE_COPY[mobileCopyLocale][consumerState] }
    : STATE_COPY[consumerState];
  const template = VERTICAL_TEMPLATES[activeVertical];
  const visibleTemplate = activeVertical === "agro"
    ? {
        ...template,
        title: agroCopy.title,
        subtitle: agroCopy.subtitle,
        fields: template.fields.map((field, index) => ({
          ...field,
          label: agroCopy.fieldLabels[index] || field.label,
        })),
      }
    : template;
  const rawProductName = seedItemName(activeItem, activeVertical === "agro" ? agroCopy.productFallback : undefined);
  const visibleProductName = activeVertical === "agro" && /^Agro Demo Item \d+$/i.test(rawProductName)
    ? `${agroCopy.productFallback}${activeSku ? ` · ${activeSku}` : ""}`
    : rawProductName;
  const illustrativeOrigin = ILLUSTRATIVE_ORIGINS[activeVertical];
  const stateTimeline: ConsumerState[] = ["AUTH_PENDING", "VALID", "DELIVERED_CLOSED", "DELIVERED_OPENED", "OFFLINE_PENDING", "OPENED", "TAMPER_RISK", "CLAIMED", "REPLAY_SUSPECT"];
  const firstScan = events.length ? events[events.length - 1] : null;
  const lastScan = events.length ? events[0] : null;
  const trustIndex = useMemo(() => {
    if (consumerState === "VALID") return 96;
    if (consumerState === "CLAIMED") return 92;
    if (consumerState === "OPENED") return 78;
    if (consumerState === "TAMPER_RISK") return 52;
    if (consumerState === "REPLAY_SUSPECT") return 34;
    return 64;
  }, [consumerState]);
  const investorSignals = useMemo(() => ([
    { label: "Scan-to-CTA demo", value: `${Math.max(18, Math.min(67, 22 + events.length * 4))}%`, tone: "text-cyan-100" },
    { label: "Fraud scenario", value: consumerState === "REPLAY_SUSPECT" ? "Replay simulated" : "No demo alert", tone: consumerState === "REPLAY_SUSPECT" ? "text-amber-200" : "text-emerald-200" },
    { label: "Lead server state", value: leadSaved ? "Accepted" : "Not submitted", tone: leadSaved ? "text-emerald-200" : "text-slate-300" },
  ]), [consumerState, events.length, leadSaved]);
  const distanceFromOrigin = useMemo(() => {
    if (!geoState) return null;
    return haversineKm(illustrativeOrigin.lat, illustrativeOrigin.lng, geoState.lat, geoState.lng);
  }, [activeVertical, geoState, illustrativeOrigin.lat, illustrativeOrigin.lng]);
  const mobileMapPoints = useMemo<VectorMapPoint[]>(() => [
    {
      id: "origin",
      label: "Origen ilustrativo",
      sublabel: illustrativeOrigin.name,
      lat: illustrativeOrigin.lat,
      lng: illustrativeOrigin.lng,
      scans: 1,
      risk: 0,
      tone: "origin",
    },
    geoState
      ? {
          id: "visitor-location",
          label: "GPS opcional",
          sublabel: `${geoState.lat.toFixed(3)}, ${geoState.lng.toFixed(3)}`,
          lat: geoState.lat,
          lng: geoState.lng,
          scans: 1,
          risk: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? 1 : 0,
          tone: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "risk" : "tap",
        }
      : {
          id: "pending-location",
          label: "GPS no compartido",
          sublabel: "Preview sin ubicación",
          lat: illustrativeOrigin.lat + 7,
          lng: illustrativeOrigin.lng + 16,
          scans: 0,
          risk: 0,
          tone: "hub",
        },
  ], [activeVertical, consumerState, geoState, illustrativeOrigin.lat, illustrativeOrigin.lng, illustrativeOrigin.name]);
  const mobileMapRoutes = useMemo<VectorMapRoute[]>(() => geoState ? [{
    id: "origin-to-tap",
    fromLat: illustrativeOrigin.lat,
    fromLng: illustrativeOrigin.lng,
    toLat: geoState.lat,
    toLng: geoState.lng,
    distanceLabel: distanceFromOrigin ? `${distanceFromOrigin.toFixed(1)} km` : undefined,
    evidence: "Ruta ilustrativa entre el origen declarado del escenario y el GPS opcional del visitante.",
    tone: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "warn" : "info",
  }] : [], [activeVertical, consumerState, distanceFromOrigin, geoState, illustrativeOrigin.lat, illustrativeOrigin.lng]);
  const mobileMapEvidenceSteps = useMemo<VectorMapEvidenceStep[]>(() => [
    {
      id: "origin",
      label: "Origen demo",
      value: illustrativeOrigin.name,
      detail: "Dato ilustrativo del escenario; no constituye evidencia de origen.",
      tone: "origin",
    },
    {
      id: "visitor-location",
      label: "GPS del visitante",
      value: geoState ? `${geoState.lat.toFixed(3)}, ${geoState.lng.toFixed(3)}` : "No compartido",
      detail: "Dato opcional de esta sesión de preview; no demuestra lectura, custodia ni ubicación del producto.",
      tone: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "risk" : "tap",
    },
    {
      id: "token",
      label: "Token / NFT",
      value: leadIntent === "tokenization_optional" || events.some((item) => item.type.includes("TOKENIZATION")) ? "solicitado" : "opcional",
      detail: "Polygon o IOTA se ejecutan sólo tras una política backend autorizada; este preview no firma ni publica on-chain.",
      tone: "token",
    },
    {
      id: "loyalty",
      label: "Beneficios",
      value: leadSaved ? "interés registrado" : "preview",
      detail: "Garantía, ownership y marketplace requieren un tap físico fresco.",
      tone: "marketplace",
    },
  ], [activeVertical, consumerState, events, geoState, illustrativeOrigin.name, leadIntent, leadSaved]);
  const mobileMapLedgerItems = useMemo<VectorMapLedgerItem[]>(() => [
    { id: "distance", label: "Distancia demo", value: distanceFromOrigin ? `${distanceFromOrigin.toFixed(1)} km` : "N/A", tone: "origin" },
    { id: "events", label: "Eventos demo", value: String(events.length), tone: "tap" },
    { id: "risk", label: "Escenario", value: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "alerta simulada" : "sin alerta demo", tone: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "risk" : "loyalty" },
  ], [consumerState, distanceFromOrigin, events.length]);
  const demoBid = bidSource === "demo-pack" || effectiveBid.toUpperCase().startsWith("DEMO-");
  const bidPresentation = !effectiveBid
    ? {
        badge: mobileUi.missingBidBadge,
        message: mobileUi.missingBidMessage,
        className: "border-amber-300/30 bg-amber-500/10 text-amber-100",
      }
    : demoBid
      ? {
          badge: mobileUi.demoPackBadge,
          message: mobileUi.demoPackMessage,
          className: "border-violet-300/30 bg-violet-500/10 text-violet-100",
        }
      : {
          badge: mobileUi.unverifiedBidBadge,
          message: mobileUi.unverifiedBidMessage,
          className: "border-amber-300/30 bg-amber-500/10 text-amber-100",
        };
  const identityMissing = !effectiveBid || !activeUid;
  const missingIdentityFields = [!effectiveBid ? "BID" : "", !activeUid ? "UID" : ""].filter(Boolean).join(" y ");
  const provenanceDisabled = identityMissing || ctaPending;
  const protectedMutationReason = "Preview solamente: escaneá el NFC físico para obtener un handoff SUN fresco y habilitar ownership, garantía o tokenización.";
  const provenanceBlockedReason = identityMissing
    ? `Provenance no disponible: falta ${missingIdentityFields} para identificar el producto.`
    : "Consulta en curso. Esperá la respuesta del servidor.";
  const provenanceDisabledClass = provenanceDisabled ? "cursor-not-allowed opacity-50" : "";
  const activeDialog = showTokenModal ? "token" : showLeadModal ? "lead" : null;

  function closeDialogs() {
    setShowTokenModal(false);
    setShowLeadModal(false);
  }

  useEffect(() => {
    const mapped = MODE_STATE[mode] || "VALID";
    setConsumerState("AUTH_PENDING");
    setScanProgress(12);
    const tick = window.setInterval(() => {
      setScanProgress((value) => (value >= 92 ? value : value + 14));
    }, 120);
    const done = window.setTimeout(() => {
      setConsumerState(mapped);
      setScanProgress(100);
    }, 850);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(done);
    };
  }, [mode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      purgeLegacyMobileDemoStorage(window.localStorage);
      const raw = window.localStorage.getItem(storeKey(tenant, itemId, pack));
      if (raw) setEvents(parseStoredEvents(raw));
    } catch {
      // Storage can be disabled, full or unavailable in private browsing.
    }
  }, [tenant, itemId, pack]);

  useEffect(() => {
    if (geoRequestId <= 0) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGeoError("Geolocation unavailable on this device.");
      return;
    }
    setGeoError("Solicitando permiso de ubicacion...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoError("");
        setGeoState({
          lat: approximateCoordinate(position.coords.latitude),
          lng: approximateCoordinate(position.coords.longitude),
          accuracy: Math.max(150, Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : 150),
          capturedAt: nowIso(),
        });
      },
      (error) => {
        setGeoError(error.message || "geolocation unavailable");
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, [geoRequestId]);

  useEffect(() => {
    if (!activeDialog) return;

    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mainRef.current?.setAttribute("inert", "");
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      const autofocusTarget = dialog?.querySelector<HTMLElement>("[data-autofocus]");
      (autofocusTarget || dialog)?.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowTokenModal(false);
        setShowLeadModal(false);
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      mainRef.current?.removeAttribute("inert");
      const restoreTarget = restoreFocusRef.current;
      if (restoreTarget?.isConnected) restoreTarget.focus();
    };
  }, [activeDialog]);

  function requestGeoTrace() {
    setGeoError("");
    setGeoRequestId((value) => value + 1);
  }


  function pushEvent(type: string, note: string) {
    setEvents((currentEvents) => {
      const next = [{ type, note, at: nowIso() }, ...currentEvents].slice(0, 12);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(storeKey(tenant, itemId, pack), serializeStoredEvents(next));
        } catch {
          // The preview remains usable when local storage is unavailable.
        }
      }
      return next;
    });
  }

  async function fetchProvenance() {
    if (!effectiveBid) throw new Error("Batch ID missing (add ?bid=... in public demo URL)");
    if (!activeUid) throw new Error("UID missing for provenance");
    const url = new URL(`/api/public-cta/provenance`, window.location.origin);
    url.searchParams.set("bid", effectiveBid);
    url.searchParams.set("uid", activeUid);
    const response = await fetch(url.toString(), { method: "GET" });
    const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
    if (!response.ok || data?.ok === false) {
      throw new Error(String(data?.reason || `Provenance failed (${response.status})`));
    }
    return data;
  }

  async function viewProvenance() {
    if (provenanceDisabled) {
      setCtaStatus(provenanceBlockedReason);
      return;
    }
    setCtaPending(true);
    try {
      const data = await fetchProvenance();
      const total = Array.isArray((data as { actions?: unknown[] }).actions)
        ? (data as { actions: unknown[] }).actions.length
        : 0;
      setCtaStatus(`Provenance consultada: ${total} acciones registradas.`);
      pushEvent("PROVENANCE_VIEWED", `Provenance consultada: ${total} acciones registradas.`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "provenance unavailable";
      setCtaStatus(`Provenance no confirmada: ${reason}. Se muestran únicamente eventos locales de simulación.`);
      pushEvent("PROVENANCE_VIEWED_LOCAL", `Fallback local: ${reason}`);
    } finally {
      setTimelineOpen((value) => !value);
      setCtaPending(false);
    }
  }

  function requestTokenization() {
    setShowLeadModal(false);
    setShowTokenModal(true);
    setLeadSaved(false);
    setCtaStatus("");
    setLeadIntent("tokenization_optional");
    pushEvent("TOKENIZATION_INTEREST_OPENED", "Formulario comercial abierto; no se solicitó ninguna operación on-chain.");
  }

  function openLeadFlow(intent: LeadIntent) {
    setShowTokenModal(false);
    setLeadIntent(intent);
    setLeadSaved(false);
    setCtaStatus("");
    setShowLeadModal(true);
  }

  async function saveLeadInterest() {
    if (!leadEmail.trim() || leadPending) return;
    const payload = {
      name: leadName || "Demo visitor",
      email: leadEmail.trim(),
      company: leadCompany || "Unknown",
      country: leadCountry || "Unknown",
      role: leadRole || "Buyer",
      source: "public_mobile_demo",
      interest: leadIntent,
      message: `${leadMessage || "Lead captured from mobile preview CTA"} [tenant=${tenant}] [session=${demoSessionId}] [pack=${pack}] [interest=${leadIntent}]`,
      notes: `tenant=${tenant} | item=${itemId} | session=${demoSessionId} | bid=${effectiveBid || "missing"} | mode=${demoBid ? "demo" : effectiveBid ? "unverified" : "missing-bid"} | geo_consent=${geoState ? "shared_for_preview_not_attached" : "not_shared"}`,
      vertical: pack,
      created_at: new Date().toISOString(),
    };
    setLeadPending(true);
    setLeadSaved(false);
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null) as { ok?: boolean; reason?: string } | null;
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.reason || `Lead request failed (${response.status})`);
      }

      setLeadSaved(true);
      pushEvent("LEAD_CAPTURED", `${leadIntent} · server accepted`);
      if (leadIntent === "tokenization_optional") {
        setCtaStatus("Interés comercial guardado. La tokenización real continúa bloqueada hasta un tap NFC físico con handoff SUN fresco.");
      } else {
        setCtaStatus("Lead confirmado por el servidor.");
      }
      setLeadName("");
      setLeadEmail("");
      setLeadCompany("");
      setLeadCountry("");
      setLeadRole("");
      setLeadMessage("");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Lead request unavailable";
      setCtaStatus(`Lead no confirmado: ${reason}`);
      pushEvent("LEAD_CAPTURE_FAILED", reason);
    } finally {
      setLeadPending(false);
    }
  }


  return (
    <>
    <main ref={mainRef} className="mobile-demo-root mx-auto max-w-5xl space-y-4 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.10),transparent_38%)] p-2 sm:p-4">
      {activeVertical === "agro" ? (
        <a
          href="/demo-lab?vertical=seeds"
          className="mx-auto flex min-h-11 w-full max-w-[430px] items-center rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/50 hover:bg-cyan-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200"
        >
          <span aria-hidden="true">←</span>
          <span className="ml-2">{agroCopy.returnLabel}</span>
        </a>
      ) : null}
      <div className="mobile-demo-device mx-auto w-full max-w-[430px] rounded-[2rem] border border-cyan-300/20 bg-slate-950 p-1.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)] sm:rounded-[2.3rem] sm:p-2.5">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="mobile-demo-screen space-y-4 rounded-[1.55rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-2.5 sm:rounded-[1.8rem] sm:p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-3 sm:p-4">
            <p className="mb-3 rounded-lg border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100">
              SIMULACIÓN · NO ES UN TAP NFC FÍSICO
            </p>
            <p className={`mb-3 rounded-lg border px-2 py-1 text-[11px] ${bidPresentation.className}`}>
              {bidPresentation.message}
            </p>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{mobileUi.consumerApp} · {locale}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{current.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{current.message}</p>
              </div>
              <Badge tone={current.tone}>{current.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">
              {activeVertical === "agro" ? agroCopy.itemContext : `Tenant: ${tenant} · Item: ${itemId} · Pack: ${pack}`}
            </p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${bidPresentation.className}`}>{bidPresentation.badge}</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{mobileUi.nfcEmulation}</p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={mobileUi.nfcProgressAria}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={scanProgress}
              >
                <div aria-hidden="true" className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-300">{mobileUi.nfcProgressBody} ({scanProgress}%).</p>
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{mobileUi.illustrativeMetrics}</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {investorSignals.map((signal) => (
                <div key={signal.label} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{signal.label}</p>
                  <p className={`mt-1 text-xs font-semibold ${signal.tone}`}>{signal.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{mobileUi.geoCapture}</p>
              {geoState ? (
                <p className="mt-1 text-[11px] text-cyan-100">
                  GPS aproximado {geoState.lat.toFixed(3)}, {geoState.lng.toFixed(3)} · precisión declarada ≥{Math.round(geoState.accuracy || 150)}m
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-slate-300">
                  {geoError || (geoRequested ? "Esperando permiso de ubicacion del dispositivo..." : "Ubicacion no compartida; la demo puede continuar sin GPS.")}
                </p>
              )}
              <button suppressHydrationWarning type="button" className="mt-2 rounded-lg border border-cyan-300/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100" onClick={requestGeoTrace}>
                {geoState ? "Actualizar ubicacion demo" : "Compartir ubicacion para esta demo"}
              </button>
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">{visibleTemplate.title}</h2>
            <p className="mt-1 text-[11px] text-cyan-200">{visibleTemplate.subtitle}</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/10 to-cyan-500/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-violet-100">
                {activeVertical === "agro" ? agroCopy.productViewLabel : "Premium product view"}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{visibleProductName}</p>
                  <p className="text-[11px] text-slate-200">
                    {activeVertical === "agro" ? agroCopy.productMeta : "Ventana ideal de consumo · 2026-2030"}
                  </p>
                </div>
                {activeVertical === "agro" ? (
                  <div aria-hidden="true" className="grid h-16 w-12 content-between rounded-lg border border-emerald-200/30 bg-emerald-400/10 p-1.5 shadow-[inset_0_0_22px_rgba(52,211,153,.24)]">
                    <span className="text-center text-[8px] font-black tracking-[0.12em] text-emerald-100">{agroCopy.packetLabel}</span>
                    <span className="text-center text-base leading-none text-amber-100">•••</span>
                  </div>
                ) : (
                  <div className="h-16 w-8 rounded-full border border-white/20 bg-white/10 shadow-[inset_0_0_22px_rgba(34,211,238,.35)]" />
                )}
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {visibleTemplate.fields.map((field) => (
                <p key={field.label}>{field.label}: <span className="text-white">{field.value(activeItem)}</span></p>
              ))}
            </div>
            <p className="mt-2 text-slate-400">SKU {activeSku || "-"} · UID {activeUid || "-"}</p>
            {activeVertical === "agro" ? (
              <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-100">
                {agroCopy.evidenceBoundary}
              </p>
            ) : null}
            <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">
                  {activeVertical === "agro" ? agroCopy.trustIndexLabel : "Trust index simulado"}
                </p>
                <p className="text-sm font-semibold text-white">{trustIndex}/100</p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900/70"
                role="progressbar"
                aria-label={activeVertical === "agro" ? agroCopy.trustIndexAria : "Índice de confianza simulado"}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={trustIndex}
              >
                <div aria-hidden="true" className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-300 transition-all" style={{ width: `${trustIndex}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-cyan-100/90">
                {activeVertical === "agro" ? agroCopy.trustIndexNote : "Indicador ilustrativo calculado en el navegador; no es un score de riesgo productivo."}
              </p>
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Lifecycle states</h2>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {stateTimeline.map((state) => (
                <div key={state} className={`rounded-lg border px-2 py-1 ${consumerState === state ? "border-cyan-300/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-900 text-slate-400"}`}>
                  {state}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Trazabilidad corta</p>
              <p className="mt-1 text-slate-300">Primer scan: <span className="text-white">{firstScan ? new Date(firstScan.at).toLocaleString() : "-"}</span></p>
              <p className="text-slate-300">Último scan: <span className="text-white">{lastScan ? new Date(lastScan.at).toLocaleString() : "-"}</span></p>
              <p className="text-slate-300">Último evento: <span className="text-white">{lastScan?.type || "-"}</span></p>
            </div>
            <div className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-100">Ruta ilustrativa</p>
                <p className="text-[11px] text-emerald-100">{distanceFromOrigin ? `${distanceFromOrigin.toFixed(1)} km` : "N/A"}</p>
              </div>
              <p className="mt-1 text-[11px] text-slate-200">{illustrativeOrigin.name} → {geoState ? "GPS opcional del visitante" : "Ubicación no compartida"}</p>
              <div className="mt-2 overflow-hidden rounded-lg border border-white/10 flex justify-center">
                <Globe3dMap
                  points={mobileMapPoints.map((p) => ({
                    city: p.label,
                    country: p.sublabel,
                    lat: p.lat,
                    lng: p.lng,
                    scans: p.scans,
                    risk: p.risk,
                    vertical: activeVertical
                  }))}
                  routes={mobileMapRoutes.map((r) => ({
                    fromLat: r.fromLat,
                    fromLng: r.fromLng,
                    toLat: r.toLat,
                    toLng: r.toLng,
                    tone: r.tone === "warn" ? "warn" as const : "info" as const
                  }))}
                  width={260}
                  height={180}
                  className="border-0 bg-transparent shadow-none"
                />
              </div>
              <div className="mt-2 rounded-lg border border-cyan-300/15 bg-slate-950/75 p-2">
                <div className="grid grid-cols-2 gap-2">
                  {mobileMapEvidenceSteps.map((step) => (
                    <div key={step.id} className={`rounded-lg border p-2 ${step.tone === "risk" ? "border-rose-300/25 bg-rose-500/10" : step.tone === "token" ? "border-violet-300/25 bg-violet-500/10" : step.tone === "origin" ? "border-emerald-300/25 bg-emerald-500/10" : "border-cyan-300/25 bg-cyan-500/10"}`}>
                      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{step.label}</p>
                      <p className="mt-0.5 truncate text-[11px] font-semibold text-white">{step.value}</p>
                      <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-300">{step.detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {mobileMapLedgerItems.map((item) => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-slate-900/80 p-2">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                      <p className="truncate text-[11px] font-semibold text-cyan-100">{item.value}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-300">
                  {consumerState === "REPLAY_SUSPECT"
                    ? "Escenario de replay: las acciones sensibles siguen reservadas al flujo físico."
                    : "Mapa de demostración: el origen es declarado y el GPS no se persiste ni se adjunta al lead."}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Acciones protegidas y provenance</h2>
            <p className="mt-2 rounded-lg border border-amber-300/25 bg-amber-500/10 p-2 text-[11px] text-amber-100">{protectedMutationReason}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button suppressHydrationWarning type="button" disabled title={protectedMutationReason} className="cursor-not-allowed rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2.5 text-left text-cyan-100 opacity-50">Activar ownership · requiere tap físico</button>
              <button suppressHydrationWarning type="button" disabled title={protectedMutationReason} className="cursor-not-allowed rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2.5 text-left text-violet-100 opacity-50">Registrar garantía · requiere tap físico</button>
              <button suppressHydrationWarning type="button" disabled={provenanceDisabled} className={`rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2.5 text-left text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,.10)] ${provenanceDisabledClass}`} onClick={() => void viewProvenance()}>Ver provenance</button>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-white/20 bg-white/5 px-3 py-2.5 text-left text-white" onClick={requestTokenization}>Consultar tokenización opcional</button>
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900 p-2">
              <p className="text-[11px] text-slate-400">Batch: {effectiveBid || "(missing)"} · UID: {activeUid || "-"}</p>
              <p className="mt-1 text-[11px] text-slate-400">La provenance es una lectura histórica. Esta pantalla nunca crea capacidades frescas ni ejecuta mutaciones protegidas.</p>
              {ctaPending ? <p className="mt-1 text-xs text-cyan-200">Consultando provenance...</p> : null}
              {ctaStatus ? <p className="mt-1 text-xs text-cyan-100" role="status" aria-live="polite">{ctaStatus}</p> : null}
            </div>
          </Card>

          <Card className="p-4 text-xs text-slate-300">
            <h2 className="text-sm font-semibold text-white">Commercial CTA</h2>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <button suppressHydrationWarning type="button" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2.5 text-left text-cyan-100" onClick={() => openLeadFlow("request_demo")}>🚀 Request Demo</button>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2.5 text-left text-violet-100" onClick={() => openLeadFlow("talk_sales")}>💼 Talk to Sales</button>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-2.5 text-left text-amber-100" onClick={() => openLeadFlow("become_reseller")}>🤝 Become Reseller</button>
              <button suppressHydrationWarning type="button" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2.5 text-left text-emerald-100" onClick={() => openLeadFlow("request_quote")}>📈 Request Quote</button>
            </div>
          </Card>

          {timelineOpen ? (
            <Card className="p-4 text-xs text-slate-300">
              <h3 className="text-sm font-semibold text-white">Provenance timeline</h3>
              <div className="mt-2 space-y-2">
                {events.length ? events.map((event, index) => (
                  <div key={`${event.type}-${index}`} className="rounded-lg border border-white/10 bg-slate-900 p-2">
                    <p className="font-semibold text-white">{event.type}</p>
                    <p>{event.note}</p>
                    <p className="text-slate-400">{event.at}</p>
                  </div>
                )) : <p className="text-slate-400">Sin eventos todavía.</p>}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[430px] rounded-2xl border border-violet-300/20 bg-[linear-gradient(110deg,rgba(124,58,237,.16),rgba(14,165,233,.12))] p-3 text-xs text-slate-100">
        <p className="font-semibold">{activeVertical === "agro" ? agroCopy.investorTitle : "Investor spotlight"}</p>
        <p className="mt-1 text-slate-200">
          {activeVertical === "agro"
            ? agroCopy.investorBody
            : "Esta demo móvil combina anti-fraude, trazabilidad y conversión comercial en una sola experiencia premium."}
        </p>
      </div>
    </main>

      {activeDialog ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-6">
          <div className="absolute inset-0 bg-slate-950/80" aria-hidden="true" onClick={closeDialogs} />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={activeDialog === "token" ? "mobile-token-dialog-title" : "mobile-lead-dialog-title"}
            aria-describedby={activeDialog === "token" ? "mobile-token-dialog-description" : "mobile-lead-dialog-description"}
            aria-busy={leadPending}
            tabIndex={-1}
            className="relative z-10 max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] overflow-y-auto outline-none"
          >
            {activeDialog === "token" ? (
              <Card className="border border-cyan-300/25 bg-slate-950 p-4 text-xs text-slate-300 shadow-2xl">
                <h2 id="mobile-token-dialog-title" className="text-sm font-semibold text-white">Consulta comercial de tokenización</h2>
                <p id="mobile-token-dialog-description" className="mt-1">Este formulario sólo registra interés comercial. Una operación on-chain exige un tap NFC físico y autorización backend independiente.</p>
                <form onSubmit={(event) => { event.preventDefault(); void saveLeadInterest(); }}>
                  <label htmlFor="mobile-token-email" className="sr-only">Email de contacto</label>
                  <input id="mobile-token-email" data-autofocus type="email" autoComplete="email" required suppressHydrationWarning className="mt-3 w-full rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Email de contacto" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button suppressHydrationWarning type="submit" disabled={leadPending || !leadEmail.trim()} className="rounded border border-cyan-300/40 bg-cyan-500/10 px-3 py-2 text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">{leadPending ? "Guardando..." : "Guardar interés"}</button>
                    <button suppressHydrationWarning type="button" className="rounded border border-white/20 px-3 py-2 text-white" onClick={closeDialogs}>Cerrar</button>
                  </div>
                </form>
                {leadSaved ? <p className="mt-2 text-emerald-300" role="status">Lead capturado para seguimiento comercial.</p> : null}
                {ctaStatus ? <p className="mt-2 text-cyan-100" role="status" aria-live="polite">{ctaStatus}</p> : null}
              </Card>
            ) : (
              <Card className="border border-violet-300/25 bg-slate-950 p-4 text-xs text-slate-300 shadow-2xl">
                <h2 id="mobile-lead-dialog-title" className="text-sm font-semibold text-white">Lead capture · {leadIntent}</h2>
                <p id="mobile-lead-dialog-description" className="mt-1">La oportunidad se confirma cuando el servidor acepta el formulario.</p>
                <form onSubmit={(event) => { event.preventDefault(); void saveLeadInterest(); }}>
                  <div className="mt-3 grid gap-2">
                    <label htmlFor="mobile-lead-name" className="sr-only">Nombre</label>
                    <input id="mobile-lead-name" data-autofocus autoComplete="name" suppressHydrationWarning className="rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Nombre" value={leadName} onChange={(event) => setLeadName(event.target.value)} />
                    <label htmlFor="mobile-lead-email" className="sr-only">Email</label>
                    <input id="mobile-lead-email" type="email" autoComplete="email" required suppressHydrationWarning className="rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Email" value={leadEmail} onChange={(event) => setLeadEmail(event.target.value)} />
                    <label htmlFor="mobile-lead-company" className="sr-only">Compañía</label>
                    <input id="mobile-lead-company" autoComplete="organization" suppressHydrationWarning className="rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Compañía" value={leadCompany} onChange={(event) => setLeadCompany(event.target.value)} />
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <label htmlFor="mobile-lead-country" className="sr-only">País</label>
                        <input id="mobile-lead-country" autoComplete="country-name" suppressHydrationWarning className="w-full rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="País" value={leadCountry} onChange={(event) => setLeadCountry(event.target.value)} />
                      </div>
                      <div>
                        <label htmlFor="mobile-lead-role" className="sr-only">Rol</label>
                        <input id="mobile-lead-role" autoComplete="organization-title" suppressHydrationWarning className="w-full rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Rol" value={leadRole} onChange={(event) => setLeadRole(event.target.value)} />
                      </div>
                    </div>
                    <label htmlFor="mobile-lead-message" className="sr-only">Mensaje</label>
                    <textarea id="mobile-lead-message" suppressHydrationWarning className="min-h-20 rounded border border-white/10 bg-slate-900 px-2 py-2 text-white" placeholder="Mensaje" value={leadMessage} onChange={(event) => setLeadMessage(event.target.value)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button suppressHydrationWarning type="submit" disabled={leadPending || !leadEmail.trim()} className="rounded border border-violet-300/40 bg-violet-500/10 px-3 py-2 text-violet-100 disabled:cursor-not-allowed disabled:opacity-50">{leadPending ? "Guardando..." : "Guardar lead"}</button>
                    <button suppressHydrationWarning type="button" className="rounded border border-white/20 px-3 py-2 text-white" onClick={closeDialogs}>Cerrar</button>
                  </div>
                </form>
                {leadSaved ? <p className="mt-2 text-emerald-300" role="status">Lead guardado.</p> : null}
                {ctaStatus ? <p className="mt-2 text-cyan-100" role="status" aria-live="polite">{ctaStatus}</p> : null}
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
