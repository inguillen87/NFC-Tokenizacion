"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_TENANT_SLUG } from "@product/config";
import type { AppLocale } from "@product/config";
import { WorldMapRealtime } from "@product/ui";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type Vertical = "wine" | "events" | "cosmetics" | "agro" | "pharma";
type SimulationMode = "valid" | "tamper" | "replay";
type DemoAction = "origin" | "tap" | "join" | "warranty" | "tokenize" | "report";
type DemoScenarioTone = "origin" | "ok" | "risk" | "open";
type DemoScenario = {
  tone: DemoScenarioTone;
  headline: string;
  body: string;
  stateLabel: string;
  allowed: string[];
  blocked: string[];
  chain: string;
  primaryAction: DemoAction;
  primaryLabel: string;
};

type DemoEvent = {
  id?: string;
  result?: string;
  uidMasked?: string;
  created_at?: string;
  city?: string;
  country_code?: string;
  lat?: number | null;
  lng?: number | null;
  product_name?: string;
  sku?: string;
  vertical?: string;
};

type DemoSummary = {
  ok?: boolean;
  exists?: boolean;
  source?: string;
  tagCount?: number;
  crm?: { leads?: number; tickets?: number; orders?: number };
  events?: DemoEvent[];
};

const LOCATIONS = {
  origin: { city: "Valle de Uco", country: "Argentina", countryCode: "AR", lat: -33.6131, lng: -69.2075, label: "Origen del producto" },
  mendoza: { city: "Mendoza", country: "Argentina", countryCode: "AR", lat: -32.8895, lng: -68.8458, label: "Bodega / QA" },
  zurich: { city: "Zurich", country: "Switzerland", countryCode: "CH", lat: 47.3769, lng: 8.5417, label: "Tap del cliente" },
};

type DemoLocation = (typeof LOCATIONS)[keyof typeof LOCATIONS];

const STABLE_DEMO_TIME = "2026-05-01T00:00:00.000Z";

const copy: Record<AppLocale, {
  heroEyebrow: string;
  heroTitle: string;
  heroBody: string;
  nav: { landing: string; login: string; sun: string; portal: string };
  kpis: { tags: string; events: string; portal: string; route: string; noFeed: string; leads: string };
  valueCards: Array<{ metric: string; title: string; body: string }>;
  roles: Record<Role, { label: string; headline: string; focus: string }>;
  beats: Record<Beat, { title: string; body: string; event: string; mode: SimulationMode; location: keyof typeof LOCATIONS; status: string; cta: string }>;
  verticals: Record<Vertical, { label: string; profile: string; product: string; visual: string; proof: string[] }>;
  controls: { narrative: string; cinematicStart: string; cinematicStop: string; product: string; mobile: string; feed: string; valid: string; tamper: string; replay: string; refresh: string; marketplace: string; mapTitle: string; mapSubtitle: string; realFeed: string; adminKey: string; noGeo: string; origin: string; currentTap: string; distance: string; openOrigin: string; openTap: string; joinClub: string; warranty: string; tokenize: string; syncing: string; synced: string; unavailable: string; sendingScan: string; registeredScan: string; failedScan: string; configs: Array<{ title: string; body: string }> };
}> = {
  "es-AR": {
    heroEyebrow: "Demo Lab enterprise",
    heroTitle: "Mira como un producto fisico se vuelve verificable, vendible y medible.",
    heroBody: "Una demo para vender la historia completa: origen, tap del cliente, seguridad, portal, marketplace y datos de negocio.",
    nav: { landing: "Landing", login: "Ingresar", sun: "SUN mobile", portal: "Portal usuario" },
    kpis: { tags: "Tags fisicos", events: "Eventos", portal: "Portal", route: "Ruta origen-tap", noFeed: "Sin feed reciente", leads: "Leads / asociaciones" },
    valueCards: [
      { metric: "CRM + club", title: "Fidelizacion post-tap", body: "Puntos, garantias, recompra y promos del tenant quedan conectados al passport del consumidor." },
      { metric: "Marketplace", title: "Red luxury por marca y zona", body: "Cada marca conserva su tienda, pero convive en una red nexID para descubrir productos premium cercanos." },
      { metric: "Reseller ready", title: "White-label operable", body: "Imprentas, integradores y agencias pueden cargar lotes, operar tenants y ver leads sin tocar criptografia." },
      { metric: "Datos vivos", title: "Ventas con analitica", body: "Scans, rutas, riesgo, clicks y solicitudes llegan al CRM y al dashboard en tiempo real." },
    ],
    roles: {
      ceo: { label: "CEO / inversor", headline: "Del tap al revenue: proteccion de marca, datos y fidelizacion.", focus: "Usalo para mostrar margen, canal reseller y valor recurrente sin entrar en jerga tecnica." },
      operator: { label: "Operaciones", headline: "Control real de lotes, UIDs, mapas y alertas.", focus: "Aterriza importacion, activacion, lecturas reales y excepciones de riesgo." },
      buyer: { label: "Comprador", headline: "Confianza instantanea antes de comprar o consumir.", focus: "La persona entiende origen, estado del sello, beneficios y proximo paso." },
    },
    beats: {
      0: { title: "1. Nace el producto", body: "La marca activa lote, UID y origen.", event: "Lote real conectado a DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "Ver origen" },
      1: { title: "2. Tap del cliente", body: "El consumidor verifica y ve distancia.", event: "Tap valido en Zurich con ruta al origen.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Unirme al club" },
      2: { title: "3. Riesgo bloqueado", body: "Replay o duplicado entra al feed.", event: "Replay signal para antifraude.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "Ver alerta" },
      3: { title: "4. Apertura + venta", body: "El sello cambia estado y abre beneficios.", event: "Sello abierto + CTA de ownership/tokenizacion.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Activar ownership" },
    },
    verticals: {
      wine: { label: "Vino", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN anti-replay", "Origen + tap global"] },
      events: { label: "Eventos", profile: "NTAG215", product: "Pulsera VIP", visual: "wristband-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueo de reingreso"] },
      cosmetics: { label: "Cosmetica", profile: "NTAG 424 DNA", product: "Serum premium", visual: "cosmetic-demo", proof: ["Tapa verificada", "Lote y vencimiento", "Garantia", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Bolsa semilla", visual: "agro-demo", proof: ["Lote trazable", "Ficha tecnica", "Custodia logistica", "Uso rural"] },
      pharma: { label: "Pharma", profile: "GS1 Digital Link + NTAG 424 DNA", product: "Estuche pharma serializado", visual: "pharma-demo", proof: ["GS1/QR fallback", "Serial y lote", "Cadena de custodia", "Farmacovigilancia"] },
    },
    controls: {
      narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Producto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar tap valido en Zurich", tamper: "Romper sello / descorchar", replay: "Simular replay duplicado", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origen del producto vs tap del cliente", mapSubtitle: "Linea animada, distancia y links de ubicacion para construir confianza.", realFeed: "Feed publico real conectado.", adminKey: "Para escribir scans del tenant falta ADMIN_API_KEY en web.", noGeo: "Todavia no hay eventos geolocalizados disponibles desde la API.", origin: "Origen", currentTap: "Tap actual", distance: "Distancia", openOrigin: "Abrir origen", openTap: "Abrir tap", joinClub: "Unirme al club", warranty: "Activar garantia", tokenize: "Tokenizar premium", syncing: "Conectando con DemoBodega...", synced: "DemoBodega sincronizado con backend.", unavailable: "DemoBodega no disponible.", sendingScan: "Enviando scan", registeredScan: "Scan registrado en DemoBodega.", failedScan: "No se pudo simular el tap.", configs: [
        { title: "QR / GS1 Digital Link", body: "Entrada economica para contenido, lote, recall y trazabilidad GS1. Ideal como fallback visible; cualquiera puede copiarlo, por eso no habilita ownership premium por si solo." },
        { title: "NTAG213 / NTAG215", body: "UID fisico serializado para tickets, pulseras, garantias simples y activaciones masivas. Sube la friccion contra screenshot y permite reglas server-side por lote." },
        { title: "NTAG 424 DNA", body: "Cada tap genera SUN dinamico con CMAC para detectar replay, links reutilizados y copias. Es la capa recomendada para productos de valor medio/alto." },
        { title: "NTAG 424 DNA TT + tokenizacion", body: "Suma estado fisico del sello: cerrado, abierto o manipulado. Permite passport, garantia, marketplace y token Polygon solo cuando la politica de compra/claim lo habilita." },
      ] },
  },
  "pt-BR": {
    heroEyebrow: "Demo Lab enterprise",
    heroTitle: "Veja como um produto fisico vira confianca, dados e receita.",
    heroBody: "Uma demo para vender a historia completa: origem, toque do cliente, seguranca, portal, marketplace e dados de negocio.",
    nav: { landing: "Landing", login: "Entrar", sun: "SUN mobile", portal: "Portal usuario" },
    kpis: { tags: "Tags fisicas", events: "Eventos", portal: "Portal", route: "Rota origem-toque", noFeed: "Sem feed recente", leads: "Leads / associacoes" },
    valueCards: [
      { metric: "CRM + clube", title: "Fidelizacao pos-toque", body: "Pontos, garantias, recompra e promos do tenant ficam conectados ao passport do consumidor." },
      { metric: "Marketplace", title: "Rede luxury por marca e regiao", body: "Cada marca mantem sua loja, mas convive em uma rede nexID para descobrir produtos premium proximos." },
      { metric: "Reseller ready", title: "White-label operavel", body: "Graficas, integradores e agencias carregam lotes, operam tenants e veem leads sem tocar criptografia." },
      { metric: "Dados vivos", title: "Vendas com analitica", body: "Scans, rotas, risco, cliques e solicitacoes chegam ao CRM e ao dashboard em tempo real." },
    ],
    roles: {
      ceo: { label: "CEO / investidor", headline: "Do toque ao revenue: marca protegida, dados e fidelizacao.", focus: "Use para mostrar margem, canal revendedor e receita recorrente sem jargao tecnico." },
      operator: { label: "Operacoes", headline: "Controle de lotes, UIDs, mapas e alertas.", focus: "Mostra importacao, ativacao, leituras reais e excecoes de risco." },
      buyer: { label: "Comprador", headline: "Confianca instantanea antes de comprar ou consumir.", focus: "A pessoa entende origem, estado do lacre, beneficios e proximo passo." },
    },
    beats: {
      0: { title: "1. Produto nasce", body: "A marca ativa lote, UID e origem.", event: "Lote real conectado ao DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "Ver origem" },
      1: { title: "2. Toque do cliente", body: "O consumidor verifica e ve distancia.", event: "Toque valido em Zurique com rota de origem.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Entrar no clube" },
      2: { title: "3. Risco bloqueado", body: "Replay ou duplicata entra no feed.", event: "Replay signal para antifraude.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "Ver alerta" },
      3: { title: "4. Abertura + venda", body: "O lacre muda estado e abre beneficios.", event: "Lacre aberto + ownership/tokenizacao.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Ativar ownership" },
    },
    verticals: {
      wine: { label: "Vinho", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta na garrafa", "Rolha / lacre aberto", "SUN anti-replay", "Origem + toque global"] },
      events: { label: "Eventos", profile: "NTAG215", product: "Pulseira VIP", visual: "wristband-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueio duplicado"] },
      cosmetics: { label: "Cosmeticos", profile: "NTAG 424 DNA", product: "Serum premium", visual: "cosmetic-demo", proof: ["Tampa verificada", "Lote e validade", "Garantia", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Saco de semente", visual: "agro-demo", proof: ["Lote rastreavel", "Ficha tecnica", "Custodia logistica", "Uso rural"] },
      pharma: { label: "Pharma", profile: "GS1 Digital Link + NTAG 424 DNA", product: "Cartucho pharma serializado", visual: "pharma-demo", proof: ["GS1/QR fallback", "Serial e lote", "Cadeia de custodia", "Farmacovigilancia"] },
    },
    controls: { narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Produto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar toque valido em Zurique", tamper: "Abrir lacre / rolha", replay: "Simular replay duplicado", refresh: "Atualizar", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origem do produto vs toque do cliente", mapSubtitle: "Linha animada, distancia e links de localizacao para construir confianca.", realFeed: "Feed publico real conectado.", adminKey: "Para gravar scans do tenant falta ADMIN_API_KEY no web.", noGeo: "Ainda nao ha eventos geolocalizados na API.", origin: "Origem", currentTap: "Toque atual", distance: "Distancia", openOrigin: "Abrir origem", openTap: "Abrir toque", joinClub: "Entrar no clube", warranty: "Ativar garantia", tokenize: "Tokenizar premium", syncing: "Conectando ao DemoBodega...", synced: "DemoBodega sincronizado com backend.", unavailable: "DemoBodega indisponivel.", sendingScan: "Enviando scan", registeredScan: "Scan registrado no DemoBodega.", failedScan: "Nao foi possivel simular o toque.", configs: [
      { title: "QR / GS1 Digital Link", body: "Entrada economica para conteudo, lote, recall e rastreabilidade GS1. Otimo fallback visivel; pode ser copiado, entao nao libera ownership premium sozinho." },
      { title: "NTAG213 / NTAG215", body: "UID fisico serializado para tickets, pulseiras, garantias simples e ativacoes massivas. Permite regras server-side por lote." },
      { title: "NTAG 424 DNA", body: "Cada toque gera SUN dinamico com CMAC para detectar replay, links reutilizados e copias. Recomendado para valor medio/alto." },
      { title: "NTAG 424 DNA TT + tokenizacao", body: "Soma estado fisico do lacre: fechado, aberto ou manipulado. Habilita passport, garantia, marketplace e token Polygon conforme politica comercial." },
    ] },
  },
  en: {
    heroEyebrow: "Enterprise Demo Lab",
    heroTitle: "See a physical product become trust, data, and revenue.",
    heroBody: "A sales-ready demo for origin, customer tap, security, portal, marketplace and business analytics.",
    nav: { landing: "Landing", login: "Login", sun: "SUN mobile", portal: "User portal" },
    kpis: { tags: "Physical tags", events: "Events", portal: "Portal", route: "Origin-tap route", noFeed: "No recent feed", leads: "Leads / associations" },
    valueCards: [
      { metric: "CRM + club", title: "Post-tap loyalty", body: "Points, warranty, repurchase and tenant promos stay attached to the consumer passport." },
      { metric: "Marketplace", title: "Luxury network by brand and region", body: "Each brand keeps its own store while joining a nexID network for nearby premium discovery." },
      { metric: "Reseller ready", title: "Operational white-label", body: "Printers, integrators and agencies can load batches, operate tenants and see leads without touching cryptography." },
      { metric: "Live data", title: "Sales with analytics", body: "Scans, routes, risk, clicks and requests land in CRM and dashboards in real time." },
    ],
    roles: {
      ceo: { label: "CEO / investor", headline: "From tap to revenue: protected brand, data and loyalty.", focus: "Show margin, reseller channel and recurring value without technical friction." },
      operator: { label: "Operations", headline: "Real control for batches, UIDs, maps and alerts.", focus: "Ground the rollout: import, activation, live scans and risk exceptions." },
      buyer: { label: "Buyer", headline: "Instant confidence before buying or consuming.", focus: "People understand origin, seal status, benefits and the next action." },
    },
    beats: {
      0: { title: "1. Product origin", body: "Brand activates batch, UID and origin.", event: "Real batch connected to DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGIN_READY", cta: "View origin" },
      1: { title: "2. Customer tap", body: "Consumer verifies and sees distance.", event: "Valid Zurich tap with origin route.", mode: "valid", location: "zurich", status: "AUTH_OK", cta: "Join club" },
      2: { title: "3. Risk blocked", body: "Replay or duplicate enters the feed.", event: "Replay signal for anti-fraud.", mode: "replay", location: "zurich", status: "REPLAY_BLOCKED", cta: "View alert" },
      3: { title: "4. Open + monetize", body: "Seal state changes and benefits open.", event: "Opened seal + ownership/tokenization CTA.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Activate ownership" },
    },
    verticals: {
      wine: { label: "Wine", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Label on bottle", "Uncork / broken seal", "SUN anti-replay", "Origin + global tap"] },
      events: { label: "Events", profile: "NTAG215", product: "VIP wristband", visual: "wristband-demo", proof: ["Fast check-in", "Serialized UID", "VIP zones", "Duplicate block"] },
      cosmetics: { label: "Cosmetics", profile: "NTAG 424 DNA", product: "Premium serum", visual: "cosmetic-demo", proof: ["Verified cap", "Batch and expiry", "Warranty", "Anti grey-market"] },
      agro: { label: "Agro", profile: "QR + NFC UID", product: "Seed bag", visual: "agro-demo", proof: ["Traceable lot", "Technical sheet", "Logistics custody", "Rural use"] },
      pharma: { label: "Pharma", profile: "GS1 Digital Link + NTAG 424 DNA", product: "Serialized pharma carton", visual: "pharma-demo", proof: ["GS1/QR fallback", "Serial and lot", "Custody chain", "Pharmacovigilance"] },
    },
    controls: { narrative: "Audience narrative", cinematicStart: "Start cinematic", cinematicStop: "Pause cinematic", product: "Physical product", mobile: "Mobile result", feed: "Command feed", valid: "Register valid Zurich tap", tamper: "Break seal / uncork", replay: "Simulate duplicate replay", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Live map: product origin vs customer tap", mapSubtitle: "Animated route, distance and location links to build trust.", realFeed: "Real public feed connected.", adminKey: "ADMIN_API_KEY is required in web to write tenant scans.", noGeo: "No geolocated API events yet.", origin: "Origin", currentTap: "Current tap", distance: "Distance", openOrigin: "Open origin", openTap: "Open tap", joinClub: "Join club", warranty: "Activate warranty", tokenize: "Tokenize premium", syncing: "Connecting to DemoBodega...", synced: "DemoBodega synced with backend.", unavailable: "DemoBodega unavailable.", sendingScan: "Sending scan", registeredScan: "Scan registered in DemoBodega.", failedScan: "Could not simulate the tap.", configs: [
      { title: "QR / GS1 Digital Link", body: "Low-cost entry for content, batch, recall and GS1 traceability. It is a strong visible fallback, but it can be copied, so it should not unlock premium ownership by itself." },
      { title: "NTAG213 / NTAG215", body: "Serialized physical UID for tickets, wristbands, simple warranty and mass activations. Adds server-side rules by batch." },
      { title: "NTAG 424 DNA", body: "Every tap creates dynamic SUN + CMAC proof to detect replay, reused links and simple copies. Recommended for mid/high-value products." },
      { title: "NTAG 424 DNA TT + tokenization", body: "Adds physical seal state: closed, opened or tampered. Enables passport, warranty, marketplace and Polygon token only when claim policy allows it." },
    ] },
  },
};

type DemoCopy = (typeof copy)["es-AR"];

function toFiniteNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function mapsLink(location: { lat: number; lng: number }) {
  return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
}

function getScenarioState(txt: DemoCopy, beat: Beat, routeKm: number, locale: AppLocale): DemoScenario {
  const distance = `${routeKm.toLocaleString(locale)} km`;
  if (beat === 0) {
    return {
      tone: "origin",
      headline: "Producto activado en origen",
      body: "La marca programa lote, UID, origen y politica comercial antes de entregar el producto al canal.",
      stateLabel: "ORIGEN ACTIVO",
      allowed: ["Auditar lote", "Abrir ubicacion", "Preparar QR/NFC"],
      blocked: ["Ownership", "Token premium", "Garantia postventa"],
      chain: "Sin mint: producto todavia no fue comprado ni reclamado.",
      primaryAction: "origin",
      primaryLabel: txt.controls.openOrigin,
    };
  }
  if (beat === 2) {
    return {
      tone: "risk",
      headline: "Replay o duplicado bloqueado",
      body: "El sistema conserva trazabilidad, pero bloquea club, puntos, marketplace y tokenizacion hasta un nuevo tap fisico valido.",
      stateLabel: "RIESGO BLOQUEADO",
      allowed: ["Ver provenance", "Reportar incidente"],
      blocked: ["Ownership", "Garantia", "Tokenizacion", "Marketplace"],
      chain: "No se firma en blockchain cuando hay replay o URL reutilizada.",
      primaryAction: "report",
      primaryLabel: "Reportar replay",
    };
  }
  if (beat === 3) {
    return {
      tone: "open",
      headline: "Sello abierto como lifecycle event",
      body: "El producto sigue siendo autentico. Cambia su estado fisico y habilita postventa o token premium solo con compra/claim validado.",
      stateLabel: "SELLO ABIERTO",
      allowed: ["Garantia postventa", "Provenance", "Token premium con prueba de compra"],
      blocked: ["Reventa como cerrado", "Claim anonimo sin prueba"],
      chain: "Mint Polygon disponible cuando la politica de ownership confirma comprador.",
      primaryAction: "tokenize",
      primaryLabel: txt.controls.tokenize,
    };
  }
  return {
    tone: "ok",
    headline: "Tap valido con ruta de confianza",
    body: `Origen y tap quedan unidos en ${distance}. El consumidor ve autenticidad y el tenant recibe datos accionables.`,
    stateLabel: "AUTH OK",
    allowed: ["Unirse al club", "Guardar passport", "Voucher o recompra"],
    blocked: ["Mint premium sin compra/claim"],
    chain: "Blockchain queda preparado, pero el mint exige ownership o compra confirmada.",
    primaryAction: "join",
    primaryLabel: txt.controls.joinClub,
  };
}

async function readDemoSummary(): Promise<DemoSummary> {
  const response = await fetch("/api/demo/summary", { cache: "no-store" });
  const data = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
  if (!response.ok || data?.ok === false) throw new Error(String(data?.reason || "No se pudo leer DemoBodega."));
  return data as DemoSummary;
}

export function DemoLabClient({ locale }: { locale: AppLocale }) {
  const txt = copy[locale] || copy["es-AR"];
  const [role, setRole] = useState<Role>("ceo");
  const [vertical, setVertical] = useState<Vertical>("wine");
  const [beat, setBeat] = useState<Beat>(1);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<DemoSummary | null>(null);
  const [status, setStatus] = useState(txt.controls.syncing);
  const [simulating, setSimulating] = useState(false);
  const [fallbackLastSeen, setFallbackLastSeen] = useState(STABLE_DEMO_TIME);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => setFallbackLastSeen(new Date().toISOString()), []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await readDemoSummary();
        if (!alive) return;
        setSummary(next);
        setStatus(next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
      } catch (error) {
        if (!alive) return;
        setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
      }
    }
    void load();
    const id = window.setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [txt.controls.adminKey, txt.controls.realFeed]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setBeat((current) => (current >= 3 ? 0 : ((current + 1) as Beat))), 5000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    setActionMessage(null);
  }, [beat, vertical]);

  const activeBeat = txt.beats[beat];
  const activeRole = txt.roles[role];
  const activeVertical = txt.verticals[vertical];
  const destination = LOCATIONS[activeBeat.location];
  const routeKm = haversineKm(LOCATIONS.origin, destination);
  const scenario = getScenarioState(txt, beat, routeKm, locale);
  const liveEvents = Array.isArray(summary?.events) ? summary.events : [];
  const latestEvent = liveEvents[0];
  const livePoints = liveEvents.flatMap((event) => {
    const lat = toFiniteNumber(event.lat);
    const lng = toFiniteNumber(event.lng);
    if (lat === null || lng === null) return [];
    return [{
      city: event.city || "Unknown",
      country: event.country_code || "UNK",
      lat,
      lng,
      scans: 1,
      risk: /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "") ? 1 : 0,
      status: event.result || "UNKNOWN",
      lastSeen: event.created_at || fallbackLastSeen,
      vertical,
    }];
  });

  const mapPoints = useMemo(() => {
    const originPoint = { city: LOCATIONS.origin.city, country: LOCATIONS.origin.country, lat: LOCATIONS.origin.lat, lng: LOCATIONS.origin.lng, scans: 1, risk: 0, status: "PRODUCT_ORIGIN", lastSeen: fallbackLastSeen, vertical };
    if (livePoints.length) return [originPoint, ...livePoints.slice(0, 18)];
    return [originPoint, { city: destination.city, country: destination.country, lat: destination.lat, lng: destination.lng, scans: 1, risk: activeBeat.mode === "replay" ? 1 : 0, status: activeBeat.status, lastSeen: fallbackLastSeen, vertical }];
  }, [activeBeat.mode, activeBeat.status, destination, fallbackLastSeen, livePoints, vertical]);

  async function refreshSummary() {
    try {
      const next = await readDemoSummary();
      setSummary(next);
      setStatus(next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.unavailable);
    }
  }

  async function simulate(mode: SimulationMode) {
    const nextBeat: Beat = mode === "replay" ? 2 : mode === "tamper" ? 3 : 1;
    const nextBeatCopy = txt.beats[nextBeat];
    const nextDestination = LOCATIONS[nextBeatCopy.location];
    setSimulating(true);
    setBeat(nextBeat);
    setStatus(`${txt.controls.sendingScan} ${mode} - ${nextDestination.city}...`);
    try {
      const response = await fetch("/api/demo/simulate-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, city: nextDestination.city, countryCode: nextDestination.countryCode, lat: nextDestination.lat, lng: nextDestination.lng, deviceLabel: `Demo Lab - ${nextDestination.label}` }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || payload?.ok === false) throw new Error(String(payload?.reason || payload?.payload?.reason || "scan failed"));
      setStatus(`${mode.toUpperCase()}: ${txt.controls.registeredScan}`);
      setActionMessage(mode === "replay" ? "Replay simulado: ownership, puntos y tokenizacion quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra lifecycle event y queda listo para postventa controlada." : "Tap valido: club, marketplace y analytics quedan listos para activar.");
      await refreshSummary();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : txt.controls.failedScan);
    } finally {
      setSimulating(false);
    }
  }

  function handleDemoAction(action: DemoAction) {
    if (action === "origin") {
      window.open(mapsLink(LOCATIONS.origin), "_blank", "noopener,noreferrer");
      setActionMessage("Origen abierto en Maps. Esta es la prueba de procedencia visible para el comprador.");
      return;
    }
    if (action === "tap") {
      window.open(mapsLink(destination), "_blank", "noopener,noreferrer");
      setActionMessage(`Tap actual abierto en Maps: ${destination.city}.`);
      return;
    }
    if (action === "report") {
      setActionMessage("Incidente creado para CRM: replay, tamper o inconsistencia queda listo para revision operativa.");
      return;
    }
    if (action === "warranty") {
      setActionMessage(beat === 2 ? "Garantia bloqueada: se necesita un nuevo tap fisico valido." : "Garantia preparada: queda asociada al passport del consumidor y al tenant.");
      return;
    }
    if (action === "tokenize") {
      setActionMessage(beat === 3 ? "Tokenizacion premium preparada: requiere compra/claim validado antes de mintear en Polygon." : beat === 1 ? "Tap valido detectado: primero se confirma ownership o compra, despues se habilita el mint." : "Tokenizacion bloqueada por politica de seguridad para este estado.");
      return;
    }
    setActionMessage(beat === 2 ? "Club bloqueado por replay. Repeti el tap fisico para continuar." : "Club/marketplace listo: el consumidor puede asociarse y recibir beneficios del tenant.");
  }

  return (
    <main className="demo-lab-shell container-shell py-8 text-slate-100">
      <section className="demo-lab-hero rounded-3xl border border-cyan-300/20 p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">{txt.heroEyebrow}</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">{txt.heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">{txt.heroBody}</p>
          </div>
          <div className="grid min-w-[18rem] gap-2 text-xs sm:grid-cols-2">
            <a href="/" className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-center font-semibold text-slate-100">{txt.nav.landing}</a>
            <a href="/login" className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-center font-semibold text-emerald-100">{txt.nav.login}</a>
            <a href="/sun" className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-center font-semibold text-cyan-100">{txt.nav.sun}</a>
            <a href="/me" className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-2 text-center font-semibold text-violet-100">{txt.nav.portal}</a>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-4">
          {[
            { label: txt.kpis.tags, value: summary?.tagCount === undefined ? "--" : String(summary.tagCount), detail: "DemoBodega / supplier" },
            { label: txt.kpis.events, value: String(liveEvents.length), detail: latestEvent ? `${latestEvent.city || "Unknown"} / ${latestEvent.result || "UNKNOWN"}` : txt.kpis.noFeed },
            { label: txt.kpis.portal, value: String(summary?.crm?.leads ?? 0), detail: txt.kpis.leads },
            { label: txt.kpis.route, value: `${routeKm.toLocaleString(locale)} km`, detail: `${LOCATIONS.origin.city} -> ${destination.city}` },
          ].map((kpi) => (
            <div key={kpi.label} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/55 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{kpi.label}</p>
              <p className="mt-2 text-2xl font-black text-white">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.detail}</p>
            </div>
          ))}
        </div>

        <div className="demo-lab-value-grid mt-4 grid gap-3 md:grid-cols-4">
          {txt.valueCards.map((item) => (
            <article key={item.title} className="demo-lab-value-card rounded-2xl border border-cyan-300/15 bg-slate-950/45 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-300">{item.metric}</p>
              <h3 className="mt-2 text-sm font-black text-white">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-300">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
        <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.narrative}</p>
              <h2 className="mt-2 text-2xl font-black text-white">{activeRole.headline}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{activeRole.focus}</p>
            </div>
            <button suppressHydrationWarning type="button" onClick={() => setRunning((current) => !current)} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-100">{running ? txt.controls.cinematicStop : txt.controls.cinematicStart}</button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(Object.keys(txt.roles) as Role[]).map((item) => (
              <button suppressHydrationWarning key={item} type="button" onClick={() => setRole(item)} className={`rounded-full border px-3 py-2 text-xs font-bold ${role === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.roles[item].label}</button>
            ))}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {([0, 1, 2, 3] as Beat[]).map((item) => (
              <button suppressHydrationWarning key={item} type="button" onClick={() => setBeat(item)} className={`demo-lab-beat-card rounded-2xl border p-3 text-left ${beat === item ? "demo-lab-beat-card--active border-emerald-300/45 bg-emerald-500/10" : "border-white/10 bg-slate-900/60"}`}>
                <p className="text-xs font-black text-white">{txt.beats[item].title}</p>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">{txt.beats[item].body}</p>
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.product}</p>
                  <h3 className="mt-1 text-xl font-black text-white">{activeVertical.product}</h3>
                </div>
                <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-100">{activeVertical.profile}</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(txt.verticals) as Vertical[]).map((item) => (
                  <button suppressHydrationWarning key={item} type="button" onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.verticals[item].label}</button>
                ))}
              </div>
              <div className={`demo-lab-product-stage demo-lab-product-stage--${vertical} demo-lab-product-stage--beat-${beat} demo-lab-product-stage--${scenario.tone} mt-4`}>
                <StageRouteLayer txt={txt} routeKm={routeKm} destination={destination} scenario={scenario} locale={locale} />
                <div className={`${activeVertical.visual} demo-lab-live-visual ${beat === 3 ? "tampered" : "scanning"}`} />
                <span className="demo-lab-cork" />
                <span className="demo-lab-product-label">nexID secure</span>
                <span className="demo-lab-seal-split" />
                <span className="demo-lab-tap-chip">SUN</span>
                <span className="demo-lab-tap-wave" />
              </div>
              <div className="demo-lab-sync-steps mt-4">
                {activeVertical.proof.map((item, index) => <p key={item} className={`demo-lab-sync-step ${index <= beat ? "demo-lab-sync-step--active" : ""}`}><span>{index + 1}</span>{item}</p>)}
              </div>
            </div>

            <MobileOutcome txt={txt} beat={beat} vertical={vertical} status={activeBeat.status} product={activeVertical.product} destination={destination} routeKm={routeKm} scenario={scenario} onAction={handleDemoAction} actionMessage={actionMessage} locale={locale} />
          </div>
        </article>

        <aside className="space-y-5">
          <DemoActionMatrix txt={txt} beat={beat} routeKm={routeKm} status={activeBeat.status} destination={destination} scenario={scenario} onAction={handleDemoAction} actionMessage={actionMessage} locale={locale} />

          <article className="demo-lab-panel rounded-3xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.feed}</p>
            <h2 className="mt-2 text-2xl font-black text-white">{activeBeat.event}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>
            <div className="mt-4 grid gap-2">
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("valid")} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-left text-xs font-bold text-emerald-100 disabled:opacity-60">{txt.controls.valid}</button>
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("tamper")} className="rounded-xl border border-amber-300/30 bg-amber-500/10 px-3 py-3 text-left text-xs font-bold text-amber-100 disabled:opacity-60">{txt.controls.tamper}</button>
              <button suppressHydrationWarning type="button" disabled={simulating} onClick={() => void simulate("replay")} className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-3 text-left text-xs font-bold text-rose-100 disabled:opacity-60">{txt.controls.replay}</button>
            </div>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-300">DemoBodega</p>
                <button suppressHydrationWarning type="button" onClick={() => void refreshSummary()} className="rounded-lg border border-white/15 px-2 py-1 text-[11px] text-slate-200">{txt.controls.refresh}</button>
              </div>
              <div className="mt-3 space-y-2">
                {liveEvents.slice(0, 5).length === 0 ? <p className="rounded-xl border border-dashed border-white/15 p-3 text-xs text-slate-400">{txt.controls.noGeo}</p> : liveEvents.slice(0, 5).map((event) => (
                  <div key={event.id || `${event.created_at}-${event.uidMasked}`} className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-xs">
                    <p className="font-bold text-white">{event.city || "Unknown"}, {event.country_code || "UNK"} / {event.result || "UNKNOWN"}</p>
                    <p className="mt-1 text-slate-400">{event.product_name || activeVertical.product} / {event.uidMasked || "UID-NA"}</p>
                    <p className="mt-1 text-slate-500">{event.created_at || "sin timestamp"}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </aside>
      </section>

      <details className="demo-lab-tech-map mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-3 md:p-5">
        <summary className="cursor-pointer text-sm font-black text-cyan-100">
          Mapa enterprise completo / heatmap operativo
          <span className="ml-2 text-xs font-semibold text-slate-400">{LOCATIONS.origin.city} -&gt; {destination.city} · {routeKm.toLocaleString(locale)} km</span>
        </summary>
        <div className="mt-4">
          <WorldMapRealtime
            title={txt.controls.mapTitle}
            subtitle={`${LOCATIONS.origin.city} -> ${destination.city}. ${txt.controls.distance}: ${routeKm.toLocaleString(locale)} km.`}
            points={mapPoints}
            routes={[{ fromLat: LOCATIONS.origin.lat, fromLng: LOCATIONS.origin.lng, toLat: destination.lat, toLng: destination.lng, tone: activeBeat.mode === "replay" ? "warn" : "info" }]}
            metadataRows={(point) => [{ label: "Google Maps", value: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` }, { label: "Abrir", value: mapsLink(point) }]}
            initialExpanded
          />
        </div>
      </details>

      <section className="mt-5 grid gap-4 lg:grid-cols-4">
        {txt.controls.configs.map((item) => (
          <article key={item.title} className="demo-lab-panel rounded-2xl border border-white/10 bg-slate-950/60 p-5">
            <p className="text-sm font-black text-white">{item.title}</p>
            <p className="mt-2 text-xs leading-6 text-slate-300">{item.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function MobileOutcome({
  txt,
  beat,
  vertical,
  status,
  product,
  destination,
  routeKm,
  scenario,
  onAction,
  actionMessage,
  locale,
}: {
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  status: string;
  product: string;
  destination: DemoLocation;
  routeKm: number;
  scenario: DemoScenario;
  onAction: (action: DemoAction) => void;
  actionMessage: string | null;
  locale: AppLocale;
}) {
  const passport = beat === 0 ? "pre-chain" : beat === 2 ? "blocked" : beat === 3 ? "opened" : "ready";
  const marketplace = beat === 2 ? "bloqueado" : beat === 0 ? "pendiente" : "ready";

  return (
    <article
      aria-label={`${txt.controls.mobile} ${status}`}
      className={`demo-lab-mobile-card demo-lab-mobile-card--${scenario.tone} rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.mobile}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{scenario.stateLabel}</h3>
          <p className="mt-1 text-sm text-slate-300">{product}</p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black text-emerald-100">{vertical.toUpperCase()}</span>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <p className="text-sm font-black text-white">{scenario.headline}</p>
        <p className="mt-2 text-xs leading-5 text-slate-300">{scenario.body}</p>
        <p className="mt-3 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-3 py-2 text-[11px] font-bold text-cyan-100">{scenario.chain}</p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label={txt.controls.origin} value={LOCATIONS.origin.city} />
        <InfoCell label={txt.controls.currentTap} value={destination.city} />
        <InfoCell label={txt.controls.distance} value={`${routeKm.toLocaleString(locale)} km`} />
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
        <div className="demo-lab-mobile-progress">
          <span style={{ width: `${Math.max(24, (beat + 1) * 25)}%` }} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button suppressHydrationWarning type="button" onClick={() => onAction("origin")} className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-3 text-center text-xs font-bold text-cyan-100">{txt.controls.openOrigin}</button>
          <button suppressHydrationWarning type="button" onClick={() => onAction("tap")} className="rounded-xl border border-violet-300/30 bg-violet-500/10 px-3 py-3 text-center text-xs font-bold text-violet-100">{txt.controls.openTap}</button>
          <button suppressHydrationWarning type="button" onClick={() => onAction(scenario.primaryAction)} className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{scenario.primaryLabel}</button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InfoCell label="Passport" value={passport} />
        <InfoCell label="Warranty" value={beat === 2 ? "bloqueada" : txt.controls.warranty} />
        <InfoCell label="Marketplace" value={marketplace} />
      </div>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function StageRouteLayer({
  txt,
  routeKm,
  destination,
  scenario,
  locale,
}: {
  txt: DemoCopy;
  routeKm: number;
  destination: DemoLocation;
  scenario: DemoScenario;
  locale: AppLocale;
}) {
  const routeStroke = scenario.tone === "risk" ? "#fb7185" : scenario.tone === "open" ? "#fbbf24" : "#22d3ee";

  return (
    <div className={`demo-lab-stage-route-layer demo-lab-stage-route-layer--${scenario.tone}`} aria-hidden="true">
      <svg viewBox="0 0 700 420" preserveAspectRatio="none">
        <path className="demo-lab-map-land demo-lab-map-land--origin" d="M72 318 C145 250 170 160 248 120 C325 82 410 116 421 198 C435 300 320 358 224 348 C160 342 112 335 72 318Z" />
        <path className="demo-lab-map-land demo-lab-map-land--tap" d="M444 84 C532 42 657 86 670 194 C682 292 580 352 498 312 C412 270 388 134 444 84Z" />
        <path className="demo-lab-map-grid" d="M70 118 H630 M70 214 H630 M70 310 H630 M155 72 V358 M348 72 V358 M540 72 V358" />
        <path className="demo-lab-route-ghost" d="M190 274 C280 138 425 96 566 132" />
        <path className="demo-lab-route-line" d="M190 274 C280 138 425 96 566 132" style={{ stroke: routeStroke }} />
        <circle className="demo-lab-route-heat demo-lab-route-heat--origin" cx="190" cy="274" r="54" />
        <circle className="demo-lab-route-heat demo-lab-route-heat--tap" cx="566" cy="132" r="64" />
        <circle className="demo-lab-route-dot demo-lab-route-dot--origin" cx="190" cy="274" r="10" />
        <circle className="demo-lab-route-dot demo-lab-route-dot--tap" cx="566" cy="132" r="10" />
        <circle className="demo-lab-route-ping" cx={scenario.tone === "risk" ? "356" : "566"} cy={scenario.tone === "risk" ? "150" : "132"} r="14" />
      </svg>
      <span className="demo-lab-route-chip demo-lab-route-chip--origin"><small>{txt.controls.origin}</small>{LOCATIONS.origin.city}</span>
      <span className="demo-lab-route-chip demo-lab-route-chip--tap"><small>{txt.controls.currentTap}</small>{destination.city}</span>
      <span className="demo-lab-route-distance">{routeKm.toLocaleString(locale)} km</span>
      <span className="demo-lab-route-state">{scenario.stateLabel}</span>
    </div>
  );
}

function DemoActionMatrix({
  txt,
  beat,
  routeKm,
  status,
  destination,
  scenario,
  onAction,
  actionMessage,
  locale,
}: {
  txt: DemoCopy;
  beat: Beat;
  routeKm: number;
  status: string;
  destination: DemoLocation;
  scenario: DemoScenario;
  onAction: (action: DemoAction) => void;
  actionMessage: string | null;
  locale: AppLocale;
}) {
  const actions: Array<{ id: DemoAction; label: string; body: string; locked: boolean }> = [
    { id: "join", label: txt.controls.joinClub, body: "Asocia al consumidor con club, beneficios y marketplace del tenant.", locked: beat === 0 || beat === 2 },
    { id: "warranty", label: txt.controls.warranty, body: "Registra garantia, postventa o fecha de apertura con politica del tenant.", locked: beat === 0 || beat === 2 },
    { id: "tokenize", label: txt.controls.tokenize, body: "Prepara request Polygon con UID hasheado y prueba de ownership.", locked: beat === 0 || beat === 2 },
    { id: "report", label: "Reportar riesgo", body: "Crea alerta operativa cuando aparece replay, duplicado o tamper sospechoso.", locked: beat !== 2 },
  ];

  return (
    <article className={`demo-lab-panel demo-lab-action-matrix demo-lab-action-matrix--${scenario.tone} rounded-3xl border border-white/10 bg-slate-950/60 p-5`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Estado comercial</p>
      <h2 className="mt-2 text-2xl font-black text-white">{scenario.headline}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{scenario.body}</p>

      <div className="demo-lab-policy-grid mt-4">
        <div className="demo-lab-policy-card">
          <p>Permitido ahora</p>
          {scenario.allowed.map((item) => <span key={item}>{item}</span>)}
        </div>
        <div className="demo-lab-policy-card demo-lab-policy-card--blocked">
          <p>Protegido / bloqueado</p>
          {scenario.blocked.map((item) => <span key={item}>{item}</span>)}
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {actions.map((action) => (
          <button suppressHydrationWarning key={action.id} type="button" onClick={() => onAction(action.id)} className={`demo-lab-action-tile ${action.locked ? "demo-lab-action-tile--locked" : ""}`}>
            <span>{action.label}</span>
            <small>{action.body}</small>
            <strong>{action.locked ? "Explicar politica" : "Accionar demo"}</strong>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <InfoCell label={txt.controls.distance} value={`${routeKm.toLocaleString(locale)} km`} />
        <InfoCell label="Status" value={status} />
        <InfoCell label="Tenant" value={DEMO_TENANT_SLUG} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Ruta activa: {LOCATIONS.origin.city} -&gt; {destination.city}. Los botones cambian de politica segun estado fisico, replay y compra/claim.
      </p>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}
