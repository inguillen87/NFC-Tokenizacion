"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DEMO_TENANT_SLUG } from "@product/config";
import type { AppLocale } from "@product/config";
import { WorldMapRealtime } from "@product/ui";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type Vertical = "wine" | "seeds" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket";
type SimulationMode = "valid" | "tamper" | "replay";
type DemoAction = "origin" | "tap" | "join" | "warranty" | "tokenize" | "report";
type DemoModalView = "mobile" | "nft" | "claim" | null;
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
  degraded?: boolean;
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
      wine: { label: "Botella", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN anti-replay", "Origen + tap global"] },
      seeds: { label: "Semillas", profile: "QR + NFC UID", product: "Sobre semilla certificada", visual: "seed-packet-demo", proof: ["Sobre antifalsificacion", "Lote y variedad", "Custodia agro", "Uso rural"] },
      creamJar: { label: "Frasco crema", profile: "NTAG 424 DNA", product: "Frasco crema premium", visual: "cream-jar-demo", proof: ["Tapa verificada", "Lote y vencimiento", "Garantia", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume edicion limitada", visual: "perfume-demo", proof: ["Caja + frasco", "Lote y serie", "Garantia", "Anti falsificacion"] },
      creamTube: { label: "Crema", profile: "NTAG213 + lote", product: "Crema dermocosmetica", visual: "cream-tube-demo", proof: ["Tubo sellado", "Lote visible", "Garantia", "Recompra"] },
      bracelet: { label: "Brazalete", profile: "NTAG215", product: "Brazalete VIP evento", visual: "event-bracelet-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueo de reingreso"] },
      ticket: { label: "Entrada", profile: "QR + NFC UID", product: "Entrada fiesta VIP", visual: "party-ticket-demo", proof: ["QR visible", "UID respaldo", "Acceso por zona", "Replay bloqueado"] },
    },
    controls: {
      narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Producto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar tap valido en Zurich", tamper: "Romper sello / descorchar", replay: "Simular replay duplicado", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origen del producto vs tap del cliente", mapSubtitle: "Linea animada, distancia y links de ubicacion para construir confianza.", realFeed: "Feed publico real conectado.", adminKey: "Modo lectura/demo: la escritura privada de scans corre en entorno seguro.", noGeo: "Todavia no hay eventos geolocalizados disponibles desde la API.", origin: "Origen", currentTap: "Tap actual", distance: "Distancia", openOrigin: "Abrir origen", openTap: "Abrir tap", joinClub: "Unirme al club", warranty: "Activar garantia", tokenize: "Tokenizar premium", syncing: "Conectando con DemoBodega...", synced: "DemoBodega sincronizado con backend.", unavailable: "DemoBodega no disponible.", sendingScan: "Enviando scan", registeredScan: "Scan registrado en DemoBodega.", failedScan: "No se pudo simular el tap.", configs: [
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
      wine: { label: "Garrafa", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta na garrafa", "Rolha / lacre aberto", "SUN anti-replay", "Origem + toque global"] },
      seeds: { label: "Sementes", profile: "QR + NFC UID", product: "Envelope de semente certificada", visual: "seed-packet-demo", proof: ["Envelope antifraude", "Lote e variedade", "Custodia agro", "Uso rural"] },
      creamJar: { label: "Pote creme", profile: "NTAG 424 DNA", product: "Pote de creme premium", visual: "cream-jar-demo", proof: ["Tampa verificada", "Lote e validade", "Garantia", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume edicao limitada", visual: "perfume-demo", proof: ["Caixa + frasco", "Lote e serie", "Garantia", "Antifalsificacao"] },
      creamTube: { label: "Creme", profile: "NTAG213 + lote", product: "Creme dermocosmetico", visual: "cream-tube-demo", proof: ["Tubo lacrado", "Lote visivel", "Garantia", "Recompra"] },
      bracelet: { label: "Pulseira", profile: "NTAG215", product: "Pulseira VIP evento", visual: "event-bracelet-demo", proof: ["Check-in rapido", "UID serializado", "Zonas VIP", "Bloqueio duplicado"] },
      ticket: { label: "Ingresso", profile: "QR + NFC UID", product: "Ingresso festa VIP", visual: "party-ticket-demo", proof: ["QR visivel", "UID respaldo", "Acesso por zona", "Replay bloqueado"] },
    },
    controls: { narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Produto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar toque valido em Zurique", tamper: "Abrir lacre / rolha", replay: "Simular replay duplicado", refresh: "Atualizar", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origem do produto vs toque do cliente", mapSubtitle: "Linha animada, distancia e links de localizacao para construir confianca.", realFeed: "Feed publico real conectado.", adminKey: "Modo leitura/demo: a escrita privada de scans roda em ambiente seguro.", noGeo: "Ainda nao ha eventos geolocalizados na API.", origin: "Origem", currentTap: "Toque atual", distance: "Distancia", openOrigin: "Abrir origem", openTap: "Abrir toque", joinClub: "Entrar no clube", warranty: "Ativar garantia", tokenize: "Tokenizar premium", syncing: "Conectando ao DemoBodega...", synced: "DemoBodega sincronizado com backend.", unavailable: "DemoBodega indisponivel.", sendingScan: "Enviando scan", registeredScan: "Scan registrado no DemoBodega.", failedScan: "Nao foi possivel simular o toque.", configs: [
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
      wine: { label: "Bottle", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Label on bottle", "Uncork / broken seal", "SUN anti-replay", "Origin + global tap"] },
      seeds: { label: "Seeds", profile: "QR + NFC UID", product: "Certified seed packet", visual: "seed-packet-demo", proof: ["Anti-counterfeit packet", "Lot and variety", "Agro custody", "Rural use"] },
      creamJar: { label: "Cream jar", profile: "NTAG 424 DNA", product: "Premium cream jar", visual: "cream-jar-demo", proof: ["Verified lid", "Batch and expiry", "Warranty", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Limited edition perfume", visual: "perfume-demo", proof: ["Box + bottle", "Lot and serial", "Warranty", "Anti-counterfeit"] },
      creamTube: { label: "Cream", profile: "NTAG213 + batch", product: "Dermocosmetic cream", visual: "cream-tube-demo", proof: ["Sealed tube", "Visible batch", "Warranty", "Repurchase"] },
      bracelet: { label: "Wristband", profile: "NTAG215", product: "VIP event wristband", visual: "event-bracelet-demo", proof: ["Fast check-in", "Serialized UID", "VIP zones", "Duplicate block"] },
      ticket: { label: "Ticket", profile: "QR + NFC UID", product: "VIP party ticket", visual: "party-ticket-demo", proof: ["Visible QR", "UID fallback", "Zone access", "Replay blocked"] },
    },
    controls: { narrative: "Audience narrative", cinematicStart: "Start cinematic", cinematicStop: "Pause cinematic", product: "Physical product", mobile: "Mobile result", feed: "Command feed", valid: "Register valid Zurich tap", tamper: "Break seal / uncork", replay: "Simulate duplicate replay", refresh: "Refresh", marketplace: "Portal + marketplace", mapTitle: "Live map: product origin vs customer tap", mapSubtitle: "Animated route, distance and location links to build trust.", realFeed: "Real public feed connected.", adminKey: "Read-only demo mode: private scan writes run in the secured environment.", noGeo: "No geolocated API events yet.", origin: "Origin", currentTap: "Current tap", distance: "Distance", openOrigin: "Open origin", openTap: "Open tap", joinClub: "Join club", warranty: "Activate warranty", tokenize: "Tokenize premium", syncing: "Connecting to DemoBodega...", synced: "DemoBodega synced with backend.", unavailable: "DemoBodega unavailable.", sendingScan: "Sending scan", registeredScan: "Scan registered in DemoBodega.", failedScan: "Could not simulate the tap.", configs: [
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
    allowed: ["Unirse al club", "Guardar passport", "Tokenizacion Amoy", "Voucher o recompra"],
    blocked: ["Transferir ownership sin login/claim"],
    chain: "Auto-tokenizacion activa: el tap valido crea request y puede cerrar con tx_hash/token_id en Polygon Amoy.",
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
  const [modalView, setModalView] = useState<DemoModalView>(null);

  useEffect(() => setFallbackLastSeen(new Date().toISOString()), []);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const next = await readDemoSummary();
        if (!alive) return;
        setSummary(next);
        setStatus(next.degraded || next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
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

  useEffect(() => {
    if (!modalView) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setModalView(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalView]);

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
      setStatus(next.degraded || next.source === "public-proof" ? `${txt.controls.realFeed} ${txt.controls.adminKey}` : txt.controls.synced);
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
      if (payload?.degraded) {
        setStatus(`${mode.toUpperCase()}: ${String(payload.reason || txt.controls.adminKey)}`);
        setActionMessage(mode === "replay" ? "Replay simulado: ownership, puntos y tokenizacion quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra lifecycle event y queda listo para postventa controlada." : "Tap valido: club, marketplace y analytics quedan listos para activar.");
        return;
      }
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
      setActionMessage(beat === 3 ? "Tokenizacion premium preparada: requiere compra/claim validado antes de transferir ownership." : beat === 1 ? "Tokenizacion automatica lista: un tap valido crea request y registra tx_hash/token_id en Polygon Amoy." : "Tokenizacion bloqueada por politica de seguridad para este estado.");
      return;
    }
    setActionMessage(beat === 2 ? "Club bloqueado por replay. Repeti el tap fisico para continuar." : "Club/marketplace listo: el consumidor puede asociarse y recibir beneficios del tenant.");
  }

  function startGuidedDemo() {
    setBeat(0);
    setRunning(true);
    setModalView(null);
    setActionMessage("Modo guiado activo: primero mira la etiqueta cerrada, despues el tap valido, replay bloqueado y apertura con claim/tokenizacion.");
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

      <DemoFinalTapDock
        status={status}
        simulating={simulating}
        onValid={() => void simulate("valid")}
        onTamper={() => void simulate("tamper")}
        onReplay={() => void simulate("replay")}
        onRefresh={() => void refreshSummary()}
      />

      <DemoDifferentiatorStrip beat={beat} onGuided={startGuidedDemo} />

      <DemoCinematicShowcase
        beat={beat}
        vertical={vertical}
        product={activeVertical.product}
        label={activeVertical.label}
        onGuided={startGuidedDemo}
      />

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.16fr_0.84fr]">
        <article className="demo-lab-panel min-w-0 rounded-3xl border border-white/10 bg-slate-950/60 p-5">
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

          <div className="mt-5 grid min-w-0 gap-4">
            <DemoFirstRunGuide
              beat={beat}
              simulating={simulating}
              onGuided={startGuidedDemo}
              onValid={() => void simulate("valid")}
              onOpen={() => void simulate("tamper")}
              onMobile={() => setModalView("mobile")}
            />
            <div className="demo-lab-product-card min-w-0 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.product}</p>
                  <h3 className="mt-1 text-xl font-black text-white">{activeVertical.product}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-violet-300/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold text-violet-100">{activeVertical.profile}</span>
                  <button suppressHydrationWarning type="button" onClick={() => setModalView("mobile")} className="demo-lab-modal-open-button">Ver resultado mobile</button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(Object.keys(txt.verticals) as Vertical[]).map((item) => (
                  <button suppressHydrationWarning key={item} type="button" onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.verticals[item].label}</button>
                ))}
              </div>
              <div className={`demo-lab-product-stage demo-lab-product-stage--${vertical} demo-lab-product-stage--beat-${beat} demo-lab-product-stage--${scenario.tone} mt-4`}>
                <StageRouteLayer txt={txt} routeKm={routeKm} destination={destination} scenario={scenario} locale={locale} />
                <div className={`${activeVertical.visual} demo-lab-live-visual demo-lab-product-illustration-wrap ${beat === 3 ? "tampered" : "scanning"}`}>
                  <ProductIllustration key={`${vertical}-${beat}`} vertical={vertical} product={activeVertical.product} label={activeVertical.label} beat={beat} />
                </div>
                <span className="demo-lab-cork" />
                <span className="demo-lab-product-label">nexID secure</span>
                <span className="demo-lab-seal-split" />
                <span className="demo-lab-tap-chip">SUN</span>
                <span className="demo-lab-tap-wave" />
              </div>
              <DemoStageExplainer beat={beat} scenario={scenario} routeKm={routeKm} locale={locale} />
              <DemoExperienceLayer beat={beat} product={activeVertical.product} scenario={scenario} destination={destination} routeKm={routeKm} locale={locale} onOpen={setModalView} />
              <div className="demo-lab-sync-steps mt-4">
                {activeVertical.proof.map((item, index) => <p key={item} className={`demo-lab-sync-step ${index <= beat ? "demo-lab-sync-step--active" : ""}`}><span>{index + 1}</span>{item}</p>)}
              </div>
              <DemoFlowRail scenario={scenario} beat={beat} onOpen={setModalView} />
            </div>
          </div>
        </article>

        <aside className="min-w-0 space-y-5">
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

      <DemoFlowModal
        view={modalView}
        txt={txt}
        beat={beat}
        vertical={vertical}
        status={activeBeat.status}
        product={activeVertical.product}
        destination={destination}
        routeKm={routeKm}
        scenario={scenario}
        actionMessage={actionMessage}
        locale={locale}
        onAction={handleDemoAction}
        onClose={() => setModalView(null)}
        onOpen={setModalView}
      />
    </main>
  );
}

function DemoFirstRunGuide({
  beat,
  simulating,
  onGuided,
  onValid,
  onOpen,
  onMobile,
}: {
  beat: Beat;
  simulating: boolean;
  onGuided: () => void;
  onValid: () => void;
  onOpen: () => void;
  onMobile: () => void;
}) {
  const guideSteps = [
    { beat: 0, kicker: "01", title: "Producto cerrado", body: "La etiqueta NFC esta intacta. Todavia no libera beneficios ni ownership." },
    { beat: 1, kicker: "02", title: "Tap valido", body: "El SUN dinamico valida el producto y une origen, ubicacion y consumidor." },
    { beat: 2, kicker: "03", title: "Replay bloqueado", body: "Una URL repetida o copiada no habilita club, marketplace ni NFT." },
    { beat: 3, kicker: "04", title: "Apertura + claim", body: "El sello abierto dispara postventa, certificado y reclamo de duenio." },
  ];

  return (
    <section className="demo-lab-first-run-guide" aria-label="Guia rapida para probar la demo">
      <div className="demo-lab-guide-copy">
        <p>Primera vez aca</p>
        <h3>Proba el flujo como lo haria un cliente en 30 segundos.</h3>
        <span>Arranca cerrado, hace un tap valido, mira como bloquea replay y termina con sello abierto, NFT y claim.</span>
      </div>
      <div className="demo-lab-guide-steps">
        {guideSteps.map((step) => (
          <div key={step.kicker} className={`demo-lab-guide-step ${beat === step.beat ? "demo-lab-guide-step--active" : ""}`}>
            <strong>{step.kicker}</strong>
            <span>{step.title}</span>
            <small>{step.body}</small>
          </div>
        ))}
      </div>
      <div className="demo-lab-guide-actions">
        <button suppressHydrationWarning type="button" onClick={onGuided}>Ver demo guiada</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid}>Tap valido</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onOpen}>Abrir sello</button>
        <button suppressHydrationWarning type="button" onClick={onMobile}>Ver mobile</button>
      </div>
    </section>
  );
}

function DemoStageExplainer({ beat, scenario, routeKm, locale }: { beat: Beat; scenario: DemoScenario; routeKm: number; locale: AppLocale }) {
  const distance = `${routeKm.toLocaleString(locale)} km`;
  const copyByBeat: Record<Beat, { title: string; body: string; backend: string; next: string }> = {
    0: {
      title: "Etiqueta NFC cerrada",
      body: "El producto nacio con UID y origen, pero todavia no hay prueba fresca del consumidor.",
      backend: "Backend: lote y UID listos, sin ownership ni token premium habilitado.",
      next: "Siguiente: simular tap valido.",
    },
    1: {
      title: "Tap fisico fresco",
      body: `El cliente valida autenticidad y ve la ruta al origen en ${distance}.`,
      backend: "Backend: evento valido, anti-replay OK, CTAs comerciales habilitados.",
      next: "Siguiente: abrir mobile, tokenizar o simular apertura.",
    },
    2: {
      title: "Replay bloqueado",
      body: "La demo muestra por que copiar una URL no alcanza para reclamar beneficios.",
      backend: "Backend: riesgo registrado, claim, club, marketplace sensible y token quedan bloqueados.",
      next: "Siguiente: repetir con un tap valido.",
    },
    3: {
      title: "Sello abierto",
      body: "La etiqueta se parte visualmente y el producto cambia a lifecycle event.",
      backend: "Backend: postventa, certificado, token request y claim requieren politica de compra/duenio.",
      next: "Siguiente: abrir NFT/certificado o claim duenio.",
    },
  };
  const item = copyByBeat[beat];

  return (
    <aside className={`demo-lab-stage-explainer demo-lab-stage-explainer--${scenario.tone}`} aria-live="polite">
      <div>
        <p>Que esta pasando</p>
        <h4>{item.title}</h4>
        <span>{item.body}</span>
      </div>
      <div>
        <strong>{item.backend}</strong>
        <small>{item.next}</small>
      </div>
    </aside>
  );
}

function getTrustSignals(beat: Beat) {
  return [
    { label: "Tap fisico", value: beat === 0 ? "pendiente" : beat === 2 ? "sospechoso" : "fresco", tone: beat === 0 ? "pending" : beat === 2 ? "blocked" : "ok" },
    { label: "SUN anti-replay", value: beat === 2 ? "bloqueado" : beat === 0 ? "standby" : "ok", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Tenant", value: "demobodega", tone: "ok" },
    { label: "Ownership", value: beat === 3 ? "claim ready" : beat === 2 ? "bloqueado" : "gated", tone: beat === 3 ? "ok" : beat === 2 ? "blocked" : "pending" },
    { label: "Polygon", value: beat === 2 ? "no mint" : beat === 0 ? "pre-chain" : "request ready", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Marketplace", value: beat === 2 ? "cerrado" : beat === 0 ? "publico" : "unlock", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
  ] as const;
}

function DemoDifferentiatorStrip({ beat, onGuided }: { beat: Beat; onGuided: () => void }) {
  const chain = ["Producto fisico", "Confianza", "Duenio", "Comunidad", "Recompra", "Marketplace", "Datos"];
  const activeIndex = beat === 0 ? 0 : beat === 1 ? 2 : beat === 2 ? 1 : 6;

  return (
    <section className="demo-lab-differentiator-strip mt-5">
      <div className="demo-lab-differentiator-copy">
        <p>Diferencial nexID</p>
        <h2>No vendemos solo anti-falsificacion. Convertimos cada producto en canal propio de revenue.</h2>
        <span>El flujo que tiene que entender cualquier bodega, marca o evento: validar confianza, reclamar duenio, activar comunidad, recompra, marketplace y datos.</span>
      </div>
      <div className="demo-lab-differentiator-chain" aria-label="Cadena de valor nexID">
        {chain.map((item, index) => (
          <span key={item} className={index <= activeIndex ? "active" : ""}>{item}</span>
        ))}
      </div>
      <button suppressHydrationWarning type="button" onClick={onGuided}>Pitch guiado 90s</button>
    </section>
  );
}

function DemoExperienceLayer({
  beat,
  product,
  scenario,
  destination,
  routeKm,
  locale,
  onOpen,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
  onOpen: (view: DemoModalView) => void;
}) {
  return (
    <section className="demo-lab-experience-layer" aria-label="Capa de experiencia y negocio">
      <DemoTrustScore beat={beat} />
      <DemoProofCard beat={beat} product={product} scenario={scenario} destination={destination} routeKm={routeKm} locale={locale} />
      <DemoPhoneMirror beat={beat} product={product} scenario={scenario} destination={destination} onOpen={onOpen} />
      <DemoUnlockLadder beat={beat} />
    </section>
  );
}

function DemoTrustScore({ beat }: { beat: Beat }) {
  const signals = getTrustSignals(beat);
  const passed = signals.filter((item) => item.tone === "ok").length;
  const score = Math.round((passed / signals.length) * 100);
  const label = beat === 2 ? "Riesgo detectado" : beat === 0 ? "Listo para validar" : beat === 3 ? "Lifecycle abierto" : "Confianza alta";

  return (
    <article className={`demo-lab-trust-score demo-lab-trust-score--beat-${beat}`}>
      <div className="demo-lab-trust-meter" style={{ "--trust-score": `${score}%` } as CSSProperties}>
        <strong>{score}</strong>
        <span>trust score</span>
      </div>
      <div>
        <p>Motor de confianza</p>
        <h4>{label}</h4>
        <div className="demo-lab-trust-signals">
          {signals.map((item) => (
            <span key={item.label} className={`demo-lab-trust-signal demo-lab-trust-signal--${item.tone}`}>
              <b>{item.label}</b>
              <em>{item.value}</em>
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function DemoProofCard({
  beat,
  product,
  scenario,
  destination,
  routeKm,
  locale,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
}) {
  const txStatus = beat === 2 ? "blocked" : beat === 0 ? "pre-chain" : "tx/request ready";
  const owner = beat === 3 ? "claim owner ready" : beat === 2 ? "claim blocked" : "login required";

  return (
    <article className={`demo-lab-proof-card demo-lab-proof-card--${scenario.tone}`}>
      <div className="demo-lab-proof-card-header">
        <span>{scenario.stateLabel}</span>
        <strong>Proof Card</strong>
      </div>
      <h4>{product}</h4>
      <div className="demo-lab-proof-grid">
        <InfoCell label="Origen" value={LOCATIONS.origin.city} />
        <InfoCell label="Tap" value={destination.city} />
        <InfoCell label="Ruta" value={`${routeKm.toLocaleString(locale)} km`} />
        <InfoCell label="Token" value={txStatus} />
        <InfoCell label="Owner" value={owner} />
        <InfoCell label="UID" value="04B7****E2B5" />
      </div>
    </article>
  );
}

function DemoPhoneMirror({
  beat,
  product,
  scenario,
  destination,
  onOpen,
}: {
  beat: Beat;
  product: string;
  scenario: DemoScenario;
  destination: DemoLocation;
  onOpen: (view: DemoModalView) => void;
}) {
  const cta = beat === 2 ? "Repetir tap fisico" : beat === 3 ? "Claim duenio" : beat === 0 ? "Acercar telefono" : "Unirme al club";

  return (
    <article className={`demo-lab-phone-mirror demo-lab-phone-mirror--${scenario.tone}`}>
      <div className="demo-lab-phone-shell">
        <div className="demo-lab-phone-topbar"><span />nexID mobile</div>
        <div className="demo-lab-phone-status">{scenario.stateLabel}</div>
        <h4>{product}</h4>
        <p>{scenario.headline}</p>
        <div className="demo-lab-phone-route">
          <span>{LOCATIONS.origin.city}</span>
          <i />
          <span>{destination.city}</span>
        </div>
        <button suppressHydrationWarning type="button" onClick={() => onOpen(beat === 3 ? "claim" : "mobile")}>{cta}</button>
      </div>
    </article>
  );
}

function DemoUnlockLadder({ beat }: { beat: Beat }) {
  const rows = [
    { label: "Info publica", body: "Origen, lote, historia y contenido de marca.", unlocked: true },
    { label: "Club + rewards", body: "Beneficios y recompra solo con tap valido.", unlocked: beat === 1 || beat === 3 },
    { label: "Warranty / claim", body: "Duenio, garantia y postventa con login.", unlocked: beat === 3 },
    { label: "NFT / certificado", body: "Request Polygon y token premium si la politica lo permite.", unlocked: beat === 1 || beat === 3 },
    { label: "Marketplace", body: "Reventa, comunidad y ofertas contextuales.", unlocked: beat === 1 || beat === 3 },
    { label: "Data feed", body: "Eventos, riesgo, zona, demanda y atribucion.", unlocked: beat !== 0 },
  ];

  return (
    <article className="demo-lab-unlock-ladder">
      <p>Unlock ladder comercial</p>
      <h4>Que se habilita despues del tap</h4>
      <div>
        {rows.map((row) => (
          <span key={row.label} className={row.unlocked && beat !== 2 ? "unlocked" : beat === 2 && row.label !== "Info publica" ? "blocked" : ""}>
            <b>{row.label}</b>
            <em>{beat === 2 && row.label !== "Info publica" ? "bloqueado por replay" : row.body}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

function ProductIllustration({ vertical, product, label, beat }: { vertical: Vertical; product: string; label: string; beat: Beat }) {
  const uid = `demo-product-${vertical}`;
  const statusLabel = beat === 2 ? "BLOCK" : beat === 3 ? "OPEN" : "NFC";
  const productLine = product.length > 24 ? `${product.slice(0, 22)}...` : product;
  const accent = beat === 2 ? "#fb7185" : beat === 3 ? "#a78bfa" : "#22d3ee";
  const sceneState = beat === 0 ? "origin" : beat === 1 ? "auth" : beat === 2 ? "blocked" : "open";
  const sealTitle = beat === 2 ? "REPLAY" : beat === 3 ? "ABIERTO" : "CERRADO";
  const sealBody = beat === 0 ? "UID SELLADO" : beat === 1 ? "SUN OK" : beat === 2 ? "NO CLAIM" : "CLAIM LISTO";
  const stateTitle = beat === 2 ? "Riesgo bloqueado" : beat === 3 ? "Etiqueta NFC abierta" : "Etiqueta NFC cerrada";
  const stateBody = beat === 0 ? "lista para primer tap" : beat === 1 ? "tap validado" : beat === 2 ? "replay detenido" : "beneficios habilitados";

  return (
    <div className={`demo-lab-product-scene demo-lab-product-scene--${sceneState}`} role="img" aria-label={`${label}: ${product}. ${stateTitle}.`}>
      <svg className="demo-lab-product-illustration" viewBox="0 0 360 420" aria-hidden="true" focusable="false">
      <defs>
        <filter id={`${uid}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" floodColor="#020617" floodOpacity="0.42" />
        </filter>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.86" />
          <stop offset="42%" stopColor="#67e8f9" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.78" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="44%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={`${uid}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#a78bfa" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${uid}-stage-glow`} cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="180" cy="366" rx="118" ry="24" fill="#020617" opacity="0.42" />
      <ellipse cx="180" cy="218" rx="156" ry="144" fill={`url(#${uid}-stage-glow)`} />

      {vertical === "wine" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M158 38h44l7 58c2 15 13 24 25 34 13 11 19 28 19 49v141c0 27-20 48-49 48h-48c-29 0-49-21-49-48V179c0-21 6-38 19-49 12-10 23-19 25-34l7-58Z" fill="#7f1d1d" />
          <path d="M158 38h44l5 48h-54l5-48Z" fill="#f59e0b" />
          <path d="M141 119c14-14 27-21 39-21s25 7 39 21c-10 12-68 12-78 0Z" fill="#14532d" opacity="0.86" />
          <rect x="130" y="212" width="100" height="78" rx="10" fill="#f8fafc" />
          <rect x="142" y="225" width="76" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.72" />
          <text x="180" y="261" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="2">MALBEC</text>
          <path d="M122 154c18-18 36-27 58-27 24 0 42 9 58 27v44H122v-44Z" fill="#450a0a" opacity="0.38" />
          <path d="M134 60c11-9 29-11 38-2 10 10 2 25-12 22-14-3-21-9-26-20Z" fill="#fde68a" opacity="0.52" />
        </g>
      ) : null}

      {vertical === "seeds" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill="#84cc16" />
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill="url(#demo-product-seeds-holo)" opacity="0.32" />
          <rect x="101" y="105" width="158" height="52" rx="12" fill="#f0fdf4" />
          <text x="180" y="138" textAnchor="middle" fill="#166534" fontSize="13" fontWeight="900" letterSpacing="2">SEMILLAS</text>
          <path d="M109 289h142" stroke="#166534" strokeWidth="2" strokeDasharray="5 7" opacity="0.42" />
          <text x="180" y="317" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="900" letterSpacing="1.5">LOTE A12</text>
          {[132, 163, 197, 225].map((cx, index) => (
            <path key={cx} d={`M${cx} ${235 + (index % 2) * 14}c18-18 35-8 30 11-20 7-32 1-30-11Z`} fill="#facc15" opacity="0.82" />
          ))}
          <path d="M99 91h162" stroke="#ecfccb" strokeWidth="7" strokeLinecap="round" opacity="0.5" />
        </g>
      ) : null}

      {vertical === "creamJar" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="107" y="115" width="146" height="48" rx="16" fill={`url(#${uid}-metal)`} />
          <path d="M89 164h182v111c0 47-34 78-91 78s-91-31-91-78V164Z" fill="#fce7f3" />
          <path d="M89 164h182v64H89v-64Z" fill="#fff7ed" opacity="0.86" />
          <rect x="112" y="196" width="136" height="66" rx="14" fill="#fff1f2" />
          <text x="180" y="235" textAnchor="middle" fill="#be185d" fontSize="14" fontWeight="900" letterSpacing="4">CREMA</text>
          <path d="M91 275c27 25 62 38 89 38s62-13 89-38v16c0 38-36 62-89 62s-89-24-89-62v-16Z" fill="#fbcfe8" opacity="0.85" />
          <circle cx="239" cy="204" r="14" fill={`url(#${uid}-holo)`} opacity="0.74" />
        </g>
      ) : null}

      {vertical === "perfume" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="153" y="49" width="54" height="45" rx="8" fill={`url(#${uid}-metal)`} />
          <rect x="140" y="29" width="80" height="28" rx="8" fill="#f8fafc" />
          <path d="M110 116c0-22 18-40 40-40h60c22 0 40 18 40 40v194c0 24-19 43-43 43h-54c-24 0-43-19-43-43V116Z" fill={`url(#${uid}-glass)`} />
          <path d="M126 139c0-20 17-37 37-37h34c21 0 38 17 38 37v160c0 15-12 27-27 27h-56c-15 0-26-12-26-27V139Z" fill="#312e81" opacity="0.32" />
          <rect x="131" y="193" width="98" height="76" rx="12" fill="transparent" stroke="#e0e7ff" strokeWidth="2" opacity="0.45" />
          <text x="180" y="238" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="900" letterSpacing="2">PARFUM</text>
          <path d="M122 126c20-22 80-26 110 4" stroke="#f8fafc" strokeWidth="8" strokeLinecap="round" opacity="0.16" />
        </g>
      ) : null}

      {vertical === "creamTube" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill="#67e8f9" />
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill="url(#demo-product-creamTube-holo)" opacity="0.34" />
          <rect x="143" y="176" width="74" height="94" rx="10" fill="#cffafe" opacity="0.82" />
          <text x="183" y="229" textAnchor="middle" fill="#155e75" fontSize="13" fontWeight="900" letterSpacing="3" transform="rotate(90 183 229)">CREMA</text>
          <rect x="130" y="333" width="100" height="45" rx="12" fill="#0f172a" />
          <rect x="137" y="343" width="86" height="9" rx="5" fill="#475569" />
          <path d="M144 66c20-17 52-17 72 0" stroke="#ecfeff" strokeWidth="8" strokeLinecap="round" opacity="0.34" />
        </g>
      ) : null}

      {vertical === "bracelet" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-8 180 210)">
          <path d="M51 198c46-40 212-60 258-10 20 22 4 58-28 62-66 9-151 26-220-4-27-12-31-30-10-48Z" fill="#14b8a6" />
          <path d="M69 197c68 18 155 4 230 0 13 17 0 42-24 46-60 10-148 24-211-5-24-11-22-29 5-41Z" fill={`url(#${uid}-holo)`} opacity="0.62" />
          <rect x="149" y="189" width="70" height="38" rx="9" fill="#0f172a" />
          <text x="184" y="214" textAnchor="middle" fill="#ecfeff" fontSize="16" fontWeight="900" letterSpacing="2">VIP</text>
          {[83, 111, 138].map((cx) => <circle key={cx} cx={cx} cy="218" r="6" fill="#0f172a" opacity="0.72" />)}
          <circle cx="276" cy="205" r="20" fill="#c4b5fd" opacity="0.82" />
          <circle cx="276" cy="205" r="11" fill="#f8fafc" opacity="0.4" />
        </g>
      ) : null}

      {vertical === "ticket" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-4 180 210)">
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill="#e11d48" />
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill={`url(#${uid}-holo)`} opacity="0.56" />
          <circle cx="35" cy="220" r="21" fill="#07111f" />
          <circle cx="325" cy="220" r="21" fill="#07111f" />
          <text x="82" y="183" fill="#fff7ed" fontSize="24" fontWeight="900" letterSpacing="3">FIESTA VIP</text>
          <path d="M73 252h130" stroke="#fecdd3" strokeWidth="3" strokeDasharray="7 8" opacity="0.42" />
          <rect x="240" y="222" width="58" height="58" rx="8" fill="#f8fafc" />
          {[252, 276].map((x) => [234, 258].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="13" height="13" fill="#0f172a" />))}
          <rect x="275" y="260" width="13" height="13" fill="#0f172a" />
        </g>
      ) : null}

      <g className="demo-lab-open-burst" transform="translate(180 196)">
        <circle cx="0" cy="0" r="44" fill="none" stroke={accent} strokeWidth="3" />
        <path d="M0-72v-28M51-51l20-20M72 0h30M51 51l20 20M0 72v28M-51 51l-20 20M-72 0h-30M-51-51l-20-20" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>

      <g className="demo-lab-nfc-seal" transform="translate(180 188) rotate(-7)">
        <g className="demo-lab-nfc-seal-half demo-lab-nfc-seal-half--left">
          <path d="M-104-32H0v64h-104c-12 0-22-10-22-22v-20c0-12 10-22 22-22Z" fill="#071827" stroke={accent} strokeWidth="2" />
          <path d="M-92-4c12-15 30-15 42 0M-84 8c8-9 18-9 26 0M-74 20c4-4 8-4 12 0" fill="none" stroke="#ecfeff" strokeWidth="4" strokeLinecap="round" opacity="0.82" />
          <text x="-38" y="-6" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">NFC</text>
          <text x="-38" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.6">FISICO</text>
        </g>
        <g className="demo-lab-nfc-seal-half demo-lab-nfc-seal-half--right">
          <path d="M0-32h104c12 0 22 10 22 22v20c0 12-10 22-22 22H0v-64Z" fill="#071827" stroke={accent} strokeWidth="2" />
          <text x="58" y="-5" textAnchor="middle" fill="#ecfeff" fontSize="14" fontWeight="900" letterSpacing="1.8">{sealTitle}</text>
          <text x="58" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.4">{sealBody}</text>
        </g>
        <rect className="demo-lab-nfc-seal-sweep" x="-125" y="-34" width="44" height="68" rx="12" fill="#ffffff" opacity="0.16" />
        <path className="demo-lab-nfc-seal-tear" d="M0-29v58" stroke="#ecfeff" strokeWidth="2" strokeDasharray="4 5" opacity="0.62" />
      </g>

      <g transform="translate(272 61)">
        <circle cx="0" cy="0" r="26" fill="#082f49" stroke={accent} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">{statusLabel}</text>
      </g>
      <text x="180" y="398" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">{productLine}</text>
    </svg>
      <span className="demo-lab-nfc-state-pill" aria-hidden="true">
        <strong>{stateTitle}</strong>
        <em>{stateBody}</em>
      </span>
    </div>
  );
}

function MobileOutcome({
  txt,
  beat,
  verticalLabel,
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
  verticalLabel: string;
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
      className={`demo-lab-mobile-card demo-lab-mobile-card--${scenario.tone} min-w-0 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">{txt.controls.mobile}</p>
          <h3 className="mt-2 text-2xl font-black text-white">{scenario.stateLabel}</h3>
          <p className="mt-1 text-sm text-slate-300">{product}</p>
        </div>
        <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-black uppercase text-emerald-100">{verticalLabel}</span>
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

function DemoFlowRail({ scenario, beat, onOpen }: { scenario: DemoScenario; beat: Beat; onOpen: (view: DemoModalView) => void }) {
  const riskCopy = beat === 2 ? "Bloqueado por replay" : "Listo para continuar";
  const items: Array<{ view: Exclude<DemoModalView, null>; eyebrow: string; title: string; body: string; tone: string }> = [
    { view: "mobile", eyebrow: scenario.stateLabel, title: "Resultado mobile", body: riskCopy, tone: scenario.tone },
    { view: "nft", eyebrow: "Polygon Amoy", title: "NFT / certificado", body: beat === 2 ? "No mintea si hay replay" : "Request + tx_hash + token_id", tone: "nft" },
    { view: "claim", eyebrow: "Portal usuario", title: "Claim duenio", body: "Login, tenant y ownership", tone: "claim" },
  ];

  return (
    <div className="demo-lab-flow-rail mt-4">
      {items.map((item) => (
        <button suppressHydrationWarning key={item.view} type="button" onClick={() => onOpen(item.view)} className={`demo-lab-flow-rail-card demo-lab-flow-rail-card--${item.tone}`}>
          <span>{item.eyebrow}</span>
          <strong>{item.title}</strong>
          <small>{item.body}</small>
        </button>
      ))}
    </div>
  );
}

function DemoFlowModal({
  view,
  txt,
  beat,
  vertical,
  status,
  product,
  destination,
  routeKm,
  scenario,
  actionMessage,
  locale,
  onAction,
  onClose,
  onOpen,
}: {
  view: DemoModalView;
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  status: string;
  product: string;
  destination: DemoLocation;
  routeKm: number;
  scenario: DemoScenario;
  actionMessage: string | null;
  locale: AppLocale;
  onAction: (action: DemoAction) => void;
  onClose: () => void;
  onOpen: (view: DemoModalView) => void;
}) {
  if (!view) return null;

  const title = view === "mobile" ? "Resultado mobile" : view === "nft" ? "NFT / certificado Polygon" : "Reclamar duenio";
  const subtitle = view === "mobile"
    ? "Lo que ve el consumidor despues del tap."
    : view === "nft"
      ? "Como se conecta el tap valido con tokenizacion y evidencia on-chain."
      : "Como el consumidor pasa de autenticar a asociar ownership en el portal.";

  return (
    <div className="demo-lab-modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <button suppressHydrationWarning type="button" className="demo-lab-modal-scrim" aria-label="Cerrar modal" onClick={onClose} />
      <section className="demo-lab-modal-panel">
        <div className="demo-lab-modal-header">
          <div>
            <p>Flujo integrado</p>
            <h2>{title}</h2>
            <span>{subtitle}</span>
          </div>
          <button suppressHydrationWarning type="button" onClick={onClose}>Cerrar</button>
        </div>
        <div className="demo-lab-modal-tabs">
          <button suppressHydrationWarning type="button" onClick={() => onOpen("mobile")} className={view === "mobile" ? "active" : ""}>Mobile</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("nft")} className={view === "nft" ? "active" : ""}>NFT</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("claim")} className={view === "claim" ? "active" : ""}>Claim</button>
        </div>
        {view === "mobile" ? (
          <MobileOutcome txt={txt} beat={beat} verticalLabel={txt.verticals[vertical].label} status={status} product={product} destination={destination} routeKm={routeKm} scenario={scenario} onAction={onAction} actionMessage={actionMessage} locale={locale} />
        ) : view === "nft" ? (
          <DemoNftModalContent beat={beat} scenario={scenario} />
        ) : (
          <DemoClaimModalContent beat={beat} scenario={scenario} />
        )}
      </section>
    </div>
  );
}

function DemoNftModalContent({ beat, scenario }: { beat: Beat; scenario: DemoScenario }) {
  const blocked = beat === 2;
  const steps = [
    { label: "01", title: "Tap valido", body: blocked ? "Replay detectado: no se firma en blockchain." : "SUN fresco confirma autenticidad y crea evento." },
    { label: "02", title: "UID hasheado", body: "El UID no se expone crudo; se usa hash con salt para el certificado." },
    { label: "03", title: "Request", body: blocked ? "La request queda bloqueada por politica." : "Se prepara request idempotente de tokenizacion." },
    { label: "04", title: "Polygon Amoy", body: blocked ? "Sin tx_hash/token_id hasta nuevo tap valido." : "El mint devuelve tx_hash y token_id para trazabilidad." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Tokenizacion bloqueada por seguridad" : "Auto-tokenizacion lista para tap valido"}</strong>
        <p>{scenario.chain}</p>
      </div>
      <div className="demo-lab-modal-step-grid">
        {steps.map((step) => (
          <article key={step.label}>
            <span>{step.label}</span>
            <strong>{step.title}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function DemoClaimModalContent({ beat, scenario }: { beat: Beat; scenario: DemoScenario }) {
  const blocked = beat === 2;
  const steps = [
    { label: "Login", body: "El consumidor entra al portal con sesion propia." },
    { label: "Tenant", body: "El claim valida que producto, tenant y evento coincidan." },
    { label: "Ownership", body: blocked ? "Replay bloquea ownership hasta nuevo tap fisico." : "El producto queda asociado al usuario." },
    { label: "Marketplace", body: blocked ? "Beneficios premium bloqueados." : "Se habilitan club, garantia, recompra y beneficios." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Claim bloqueado correctamente" : "Claim listo con politica de ownership"}</strong>
        <p>{scenario.body}</p>
      </div>
      <div className="demo-lab-modal-step-grid">
        {steps.map((step) => (
          <article key={step.label}>
            <span>{step.label}</span>
            <strong>{step.label}</strong>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </div>
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

function DemoFinalTapDock({
  status,
  simulating,
  onValid,
  onTamper,
  onReplay,
  onRefresh,
}: {
  status: string;
  simulating: boolean;
  onValid: () => void;
  onTamper: () => void;
  onReplay: () => void;
  onRefresh: () => void;
}) {
  const flow = [
    { step: "01", title: "Tap fisico fresco", body: "El chip genera SUN dinamico. No sirve URL copiada." },
    { step: "02", title: "Anti-replay + passport", body: "Si es valido, se habilitan CTAs y queda evento." },
    { step: "03", title: "NFT / certificado", body: "Se crea request y Polygon devuelve tx_hash + token_id." },
    { step: "04", title: "Reclamar duenio", body: "El usuario asocia producto con login, tenant y ownership." },
  ];

  return (
    <section className="demo-lab-final-dock mt-5 rounded-3xl border p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Checklist antes del tap final</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Probar el camino real: tap valido - NFT - claim duenio.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>
        </div>
        <div className="demo-lab-final-actions">
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid} className="demo-lab-final-button demo-lab-final-button--primary">
            Simular tap valido
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onReplay} className="demo-lab-final-button demo-lab-final-button--danger">
            Probar replay bloqueado
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onTamper} className="demo-lab-final-button demo-lab-final-button--warn">
            Sello abierto
          </button>
          <button suppressHydrationWarning type="button" onClick={onRefresh} className="demo-lab-final-button demo-lab-final-button--ghost">
            Refresh backend
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {flow.map((item) => (
          <div key={item.step} className="demo-lab-final-step">
            <span>{item.step}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
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
            <strong>{action.locked ? "Ver por que bloquea" : "Ejecutar accion"}</strong>
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
