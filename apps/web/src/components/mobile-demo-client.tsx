"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Card } from "@product/ui";
import type { VectorMapEvidenceStep, VectorMapLedgerItem, VectorMapPoint, VectorMapRoute } from "@product/ui/premium-vector-map";
import { DEMO_PRODUCT_PROFILES } from "../lib/demo-product-profiles";

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
const PACKAGING_DEMO_PROFILE = DEMO_PRODUCT_PROFILES.perfume;

const ILLUSTRATIVE_ORIGINS: Record<VerticalTemplate["key"], { name: string; lat: number; lng: number }> = {
  wine: { name: "Origen demo · Mendoza", lat: -33.0086, lng: -68.7794 },
  agro: { name: "Origen demo · Córdoba", lat: -31.4201, lng: -64.1888 },
  perfume: {
    name: `Origen demo · ${PACKAGING_DEMO_PROFILE.origin.city}`,
    lat: PACKAGING_DEMO_PROFILE.origin.lat,
    lng: PACKAGING_DEMO_PROFILE.origin.lng,
  },
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

function seedItemName(item: SeedItem) {
  return String(item.productName || item.display_name || item.name || "Reserva Demo 2024");
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
    title: "Packaging passport",
    subtitle: "Materiales, lote y servicios del Estuche Aurora, con evidencia del mensaje y control anti-replay.",
    fields: [
      { label: "Categoría", value: () => PACKAGING_DEMO_PROFILE.category },
      { label: "Lote", value: () => PACKAGING_DEMO_PROFILE.lot },
      { label: "Región declarada", value: () => PACKAGING_DEMO_PROFILE.region },
      { label: "Conservación", value: (item) => optionalMetric(item.temperatureStorage ?? item.temperature_storage) },
      { label: "SKU", value: (item) => seedItemSku(item) || "N/D" },
      { label: "Ficha", value: () => "Materiales y circularidad · demo" },
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

  const current = STATE_COPY[consumerState];
  const rawBid = (bid || "").trim();
  const effectiveBid = BID_RE.test(rawBid) ? rawBid : "";
  const geoRequested = geoRequestId > 0;
  const activeItem = seedItem || {};
  const activeUid = seedItemUid(activeItem);
  const activeSku = seedItemSku(activeItem);
  const activeVertical = detectVertical(pack, activeItem);
  const template = VERTICAL_TEMPLATES[activeVertical];
  const displayedProductName = activeVertical === "perfume"
    ? PACKAGING_DEMO_PROFILE.name
    : seedItemName(activeItem);
  const displayedProductDetail = activeVertical === "perfume"
    ? `Lote ${PACKAGING_DEMO_PROFILE.lot} · pasaporte de packaging`
    : "Ventana ideal de consumo · 2026-2030";
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
    ...(geoState
      ? [{
          id: "visitor-location",
          label: "GPS opcional",
          sublabel: `${geoState.lat.toFixed(3)}, ${geoState.lng.toFixed(3)}`,
          lat: geoState.lat,
          lng: geoState.lng,
          scans: 1,
          risk: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? 1 : 0,
          tone: consumerState === "REPLAY_SUSPECT" || consumerState === "TAMPER_RISK" ? "risk" : "tap",
        } satisfies VectorMapPoint]
      : []),
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
        badge: "MISSING BID",
        message: "MISSING BID · La provenance histórica no está disponible; las acciones protegidas requieren un tap físico.",
        className: "border-amber-300/30 bg-amber-500/10 text-amber-100",
      }
    : demoBid
      ? {
          badge: "DEMO PACK",
          message: "DEMO MODE · BID provisto por el dataset de demostración; no prueba una lectura física.",
          className: "border-violet-300/30 bg-violet-500/10 text-violet-100",
        }
      : {
          badge: "BID UNVERIFIED",
          message: "BID PROVIDED · Identificador de preview sin validación SUN en esta pantalla.",
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
    <main ref={mainRef} className="mx-auto max-w-5xl space-y-4 bg-[radial-gradient(circle_at_top,rgba(14,165,233,.10),transparent_38%)] p-4">
      <div className="mx-auto w-full max-w-[430px] rounded-[2.3rem] border border-cyan-300/20 bg-slate-950 p-2.5 shadow-[0_24px_90px_rgba(2,6,23,0.65)]">
        <div className="mx-auto mb-2 h-1.5 w-20 rounded-full bg-slate-700" />
        <div className="space-y-4 rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,211,238,.10),transparent_30%),#020617] p-4">
          <Card className="border border-white/10 bg-slate-950/95 p-4">
            <p className="mb-3 rounded-lg border border-rose-300/35 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-100">
              SIMULACIÓN · NO ES UN TAP NFC FÍSICO
            </p>
            <p className={`mb-3 rounded-lg border px-2 py-1 text-[11px] ${bidPresentation.className}`}>
              {bidPresentation.message}
            </p>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Consumer App · {locale}</p>
                <h1 className="mt-1 text-xl font-semibold text-white">{current.label}</h1>
                <p className="mt-2 text-sm text-slate-300">{current.message}</p>
              </div>
              <Badge tone={current.tone}>{current.label}</Badge>
            </div>
            <p className="mt-3 text-xs text-cyan-200">Tenant: {tenant} · Item: {itemId} · Pack: {pack}</p>
            <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] ${bidPresentation.className}`}>{bidPresentation.badge}</p>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">NFC scan emulation</p>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label="Progreso de validacion NFC"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={scanProgress}
              >
                <div aria-hidden="true" className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${scanProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-300">Animación del escenario; no representa una validación SUN ejecutada ({scanProgress}%).</p>
            </div>
            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Métricas ilustrativas del escenario</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {investorSignals.map((signal) => (
                <div key={signal.label} className="rounded-lg border border-white/10 bg-slate-900/70 p-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{signal.label}</p>
                  <p className={`mt-1 text-xs font-semibold ${signal.tone}`}>{signal.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-900/70 p-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Geo trace capture</p>
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
            <h2 className="text-sm font-semibold text-white">{template.title}</h2>
            <p className="mt-1 text-[11px] text-cyan-200">{template.subtitle}</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-fuchsia-500/20 via-violet-500/10 to-cyan-500/20 p-3">
              <p className="text-[10px] uppercase tracking-[0.16em] text-violet-100">
                {activeVertical === "perfume" ? "Vista del packaging conectado" : "Premium product view"}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold text-white">{displayedProductName}</p>
                  <p className="text-[11px] text-slate-200">{displayedProductDetail}</p>
                </div>
                <div className="h-16 w-8 rounded-full border border-white/20 bg-white/10 shadow-[inset_0_0_22px_rgba(34,211,238,.35)]" />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {template.fields.map((field) => (
                <p key={field.label}>{field.label}: <span className="text-white">{field.value(activeItem)}</span></p>
              ))}
            </div>
            <p className="mt-2 text-slate-400">SKU {activeSku || "-"} · UID {activeUid || "-"}</p>
            <div className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-100">Trust index simulado</p>
                <p className="text-sm font-semibold text-white">{trustIndex}/100</p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-900/70"
                role="progressbar"
                aria-label="Índice de confianza simulado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={trustIndex}
              >
                <div aria-hidden="true" className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-violet-400 to-emerald-300 transition-all" style={{ width: `${trustIndex}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-cyan-100/90">Indicador ilustrativo calculado en el navegador; no es un score de riesgo productivo.</p>
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
            <div
              className="mobile-demo-map-card mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-3"
              data-mobile-demo-map-truth={geoState ? "illustrative-session-gps" : "illustrative-no-gps"}
            >
              <div className="mobile-demo-map-card__head flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-emerald-100">Mapa ilustrativo del preview</p>
                  <span className="mt-1 block text-[10px] text-slate-400">Sin telemetría productiva</span>
                </div>
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
                    ? "Alerta de replay simulada: no aporta evidencia de movimiento, custodia ni ubicación física del producto."
                    : "Vista demo: el origen es ilustrativo y el GPS opcional permanece en esta sesión; no genera un mapa de calor productivo ni se adjunta al lead."}
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
        <p className="font-semibold">Investor spotlight</p>
        <p className="mt-1 text-slate-200">Esta demo móvil combina anti-fraude, trazabilidad y conversión comercial en una sola experiencia premium.</p>
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
