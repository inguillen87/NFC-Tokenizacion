"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { DEMO_TENANT_SLUG } from "@product/config";
import type { AppLocale } from "@product/config";
import { WorldMapRealtime } from "@product/ui";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, ChevronRight, Fingerprint, MapPin, PackageCheck, ShieldCheck, UserRound } from "lucide-react";
import { InstitutionalVideoPanel } from "../../components/institutional-video-panel";

type Role = "ceo" | "operator" | "buyer";
type Beat = 0 | 1 | 2 | 3;
type Vertical = "wine" | "seeds" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket" | "sneaker";
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

type ThreeProductVertical = "wine" | "seeds" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket";
type DemoRealProductVariant = "studio" | "cinematic" | "stage";

const HeroThreeStage = dynamic(() => import("../../components/hero-three-stage").then((mod) => mod.HeroThreeStage), { ssr: false });

const DEMO_VERTICAL_ORDER: Vertical[] = ["wine", "seeds", "creamJar", "perfume", "bracelet", "sneaker"];

const demoLabRealAssets: Record<Vertical, { imageUrl: string; credit: string }> = {
  wine: { imageUrl: "/demo/wine-secure/real-malbec-bottle-pexels.jpg", credit: "Pexels / Imperio Ame" },
  seeds: { imageUrl: "/demo/agro-secure/real-seed-packet-pexels.jpg", credit: "Pexels / RDNE Stock project" },
  creamJar: { imageUrl: "/demo/cosmetics-secure/real-premium-skincare-set-pexels.jpg", credit: "Pexels / mskin pro" },
  perfume: { imageUrl: "/demo/cosmetics-secure/real-luxury-perfume-pexels.jpg", credit: "Pexels / Suhashan Jar" },
  creamTube: { imageUrl: "/demo/cosmetics-secure/real-cosmetic-bottles-pexels.jpg", credit: "Pexels / Daria Liudnaya" },
  bracelet: { imageUrl: "/demo/events-basic/real-event-wristband-pexels.jpg", credit: "Pexels / freestocks.org" },
  ticket: { imageUrl: "/demo/events-basic/real-event-wristband-pexels.jpg", credit: "Pexels / freestocks.org" },
  sneaker: { imageUrl: "/demo/luxury-basic/real-sneakers-pexels.jpg", credit: "Pexels / Hurrah suhail" },
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
  zurich: { city: "Zurich", country: "Suiza", countryCode: "CH", lat: 47.3769, lng: 8.5417, label: "Toque del cliente" },
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
    heroEyebrow: "Laboratorio comercial nexID",
    heroTitle: "Mira como un producto fisico se vuelve verificable, vendible y medible.",
    heroBody: "Una prueba para vender la historia completa: origen, toque del cliente, seguridad, portal, tienda y datos de negocio.",
    nav: { landing: "Inicio", login: "Ingresar", sun: "SUN celular", portal: "Portal usuario" },
    kpis: { tags: "Etiquetas fisicas", events: "Eventos", portal: "Portal", route: "Ruta origen-toque", noFeed: "Sin eventos recientes", leads: "Contactos / asociaciones" },
    valueCards: [
      { metric: "CRM + club", title: "Fidelizacion despues del toque", body: "Puntos, garantias, recompra y promociones de la marca quedan conectados al pasaporte del consumidor." },
      { metric: "Tienda", title: "Red de alta gama por marca y zona", body: "Cada marca conserva su tienda, pero convive en una red nexID para descubrir productos de valor cercanos." },
      { metric: "Canal listo", title: "Operable para terceros", body: "Imprentas, integradores y agencias pueden cargar lotes, operar cuentas de marca y ver contactos sin tocar criptografia." },
      { metric: "Datos vivos", title: "Ventas con analitica", body: "Lecturas, rutas, riesgo, clics y solicitudes llegan al CRM y al panel en tiempo real." },
    ],
    roles: {
      ceo: { label: "CEO / inversor", headline: "Del toque al ingreso: proteccion de marca, datos y fidelizacion.", focus: "Usalo para mostrar margen, canal de revendedores y valor recurrente sin entrar en jerga tecnica." },
      operator: { label: "Operaciones", headline: "Control real de lotes, UIDs, mapas y alertas.", focus: "Aterriza importacion, activacion, lecturas reales y excepciones de riesgo." },
      buyer: { label: "Comprador", headline: "Confianza instantanea antes de comprar o consumir.", focus: "La persona entiende origen, estado del sello, beneficios y proximo paso." },
    },
    beats: {
      0: { title: "1. Nace el producto", body: "La marca activa lote, UID y origen.", event: "Lote real conectado a DemoBodega.", mode: "valid", location: "mendoza", status: "ORIGEN_LISTO", cta: "Ver origen" },
      1: { title: "2. Toque del cliente", body: "El consumidor verifica y ve distancia.", event: "Toque valido en Zurich con ruta al origen.", mode: "valid", location: "zurich", status: "AUTENTICADO", cta: "Unirme al club" },
      2: { title: "3. Riesgo bloqueado", body: "Copia o lectura duplicada entra al registro.", event: "Senial de copia para antifraude.", mode: "replay", location: "zurich", status: "COPIA_BLOQUEADA", cta: "Ver alerta" },
      3: { title: "4. Apertura + venta", body: "El sello cambia estado y abre beneficios.", event: "Sello abierto + llamado a reclamar dueño/tokenizar.", mode: "tamper", location: "zurich", status: "ABIERTO", cta: "Reclamar dueño" },
    },
    verticals: {
      wine: { label: "Botella", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta adherida a botella", "Descorche / sello roto", "SUN anti copia", "Origen + toque global"] },
      seeds: { label: "Semillas", profile: "QR + NFC UID", product: "Sobre semilla certificada", visual: "seed-packet-demo", proof: ["Sobre antifalsificacion", "Lote y variedad", "Custodia agro", "Uso rural"] },
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Set skincare premium", visual: "cream-jar-demo", proof: ["Sello tapa-envase", "Apertura cambia estado", "Garantia premium", "Anti mercado gris"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume premium", visual: "perfume-demo", proof: ["Sello en tapa y cuello", "Lote y serie", "Garantia", "Anti falsificacion"] },
      creamTube: { label: "Crema", profile: "NTAG213 + lote", product: "Crema dermocosmetica", visual: "cream-tube-demo", proof: ["Sello sobre tapa flip", "Lote visible", "Garantia", "Recompra"] },
      bracelet: { label: "Brazalete", profile: "NTAG215", product: "Brazalete VIP evento", visual: "event-bracelet-demo", proof: ["Celular toca pulsera", "UID serializado", "Zonas VIP", "Bloqueo de reingreso"] },
      ticket: { label: "Entrada", profile: "QR + NFC UID", product: "Entrada fiesta VIP", visual: "party-ticket-demo", proof: ["QR visible", "UID respaldo", "Acceso por zona", "Copia bloqueada"] },
      sneaker: { label: "Zapatilla", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Toque en lengueta", "UID + SUN", "Rareza visible", "Dueno/token"] },
    },
    controls: {
      narrative: "Narrativa por audiencia", cinematicStart: "Iniciar recorrido", cinematicStop: "Pausar recorrido", product: "Producto fisico", mobile: "Resultado en celular", feed: "Registro de eventos", valid: "Registrar toque valido en Zurich", tamper: "Romper sello / descorchar", replay: "Simular copia duplicada", refresh: "Actualizar", marketplace: "Portal + tienda", mapTitle: "Mapa vivo: origen del producto vs toque del cliente", mapSubtitle: "Linea animada, distancia y enlaces de ubicacion para construir confianza.", realFeed: "Registro publico real conectado.", adminKey: "Modo lectura/prueba: la escritura privada de lecturas corre en entorno seguro.", noGeo: "Todavia no hay eventos geolocalizados disponibles desde la API.", origin: "Origen", currentTap: "Toque actual", distance: "Distancia", openOrigin: "Abrir origen", openTap: "Abrir toque", joinClub: "Unirme al club", warranty: "Activar garantia", tokenize: "Crear NFT", syncing: "Conectando con DemoBodega...", synced: "DemoBodega sincronizado con servidor.", unavailable: "DemoBodega no disponible.", sendingScan: "Enviando lectura", registeredScan: "Lectura registrada en DemoBodega.", failedScan: "No se pudo simular el toque.", configs: [
        { title: "QR / GS1 Digital Link", body: "Entrada economica para contenido, lote, retiro de producto y trazabilidad GS1. Ideal como respaldo visible; cualquiera puede copiarlo, por eso no habilita reclamo de dueño por si solo." },
        { title: "NTAG213 / NTAG215", body: "UID fisico serializado para entradas, pulseras, garantias simples y activaciones masivas. Sube la friccion contra capturas de pantalla y permite reglas por lote desde el servidor." },
        { title: "NTAG 424 DNA", body: "Cada toque genera SUN dinamico con CMAC para detectar copias, enlaces reutilizados y lecturas sospechosas. Es la capa recomendada para productos de valor medio/alto." },
        { title: "NTAG 424 DNA TT + tokenizacion", body: "Suma estado fisico del sello: cerrado, abierto o manipulado. Permite pasaporte, garantia, tienda y token Polygon solo cuando la politica de compra/reclamo lo habilita." },
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
      3: { title: "4. Abertura + venda", body: "O lacre muda estado e abre beneficios.", event: "Lacre aberto + dono/tokenizacao.", mode: "tamper", location: "zurich", status: "OPENED", cta: "Reivindicar dono" },
    },
    verticals: {
      wine: { label: "Garrafa", profile: "NTAG 424 DNA TT", product: "Gran Reserva Malbec", visual: "hero-bottle", proof: ["Etiqueta na garrafa", "Rolha / lacre aberto", "SUN anti-replay", "Origem + toque global"] },
      seeds: { label: "Sementes", profile: "QR + NFC UID", product: "Envelope de semente certificada", visual: "seed-packet-demo", proof: ["Envelope antifraude", "Lote e variedade", "Custodia agro", "Uso rural"] },
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Set skincare premium", visual: "cream-jar-demo", proof: ["Lacre tampa-envase", "Abertura muda estado", "Garantia premium", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Perfume premium", visual: "perfume-demo", proof: ["Lacre entre tampa e gargalo", "Lote e serie", "Garantia", "Antifalsificacao"] },
      creamTube: { label: "Creme", profile: "NTAG213 + lote", product: "Creme dermocosmetico", visual: "cream-tube-demo", proof: ["Lacre sobre tampa flip", "Lote visivel", "Garantia", "Recompra"] },
      bracelet: { label: "Pulseira", profile: "NTAG215", product: "Pulseira VIP evento", visual: "event-bracelet-demo", proof: ["Celular toca pulseira", "UID serializado", "Zonas VIP", "Bloqueio duplicado"] },
      ticket: { label: "Ingresso", profile: "QR + NFC UID", product: "Ingresso festa VIP", visual: "party-ticket-demo", proof: ["QR visivel", "UID respaldo", "Acesso por zona", "Replay bloqueado"] },
      sneaker: { label: "Tenis", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Toque na lingueta", "UID + SUN", "Raridade visivel", "Dono/token"] },
    },
    controls: { narrative: "Narrativa por audiencia", cinematicStart: "Iniciar cinematic", cinematicStop: "Pausar cinematic", product: "Produto fisico", mobile: "Resultado mobile", feed: "Command feed", valid: "Registrar toque valido em Zurique", tamper: "Abrir lacre / rolha", replay: "Simular replay duplicado", refresh: "Atualizar", marketplace: "Portal + marketplace", mapTitle: "Mapa vivo: origem do produto vs toque do cliente", mapSubtitle: "Linha animada, distancia e links de localizacao para construir confianca.", realFeed: "Feed publico real conectado.", adminKey: "Modo leitura/demo: a escrita privada de scans roda em ambiente seguro.", noGeo: "Ainda nao ha eventos geolocalizados na API.", origin: "Origem", currentTap: "Toque atual", distance: "Distancia", openOrigin: "Abrir origem", openTap: "Abrir toque", joinClub: "Entrar no clube", warranty: "Ativar garantia", tokenize: "Tokenizar premium", syncing: "Conectando ao DemoBodega...", synced: "DemoBodega sincronizado com backend.", unavailable: "DemoBodega indisponivel.", sendingScan: "Enviando scan", registeredScan: "Scan registrado no DemoBodega.", failedScan: "Nao foi possivel simular o toque.", configs: [
      { title: "QR / GS1 Digital Link", body: "Entrada economica para conteudo, lote, recall e rastreabilidade GS1. Otimo fallback visivel; pode ser copiado, entao nao libera propriedade premium sozinho." },
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
      creamJar: { label: "Skincare", profile: "NTAG 424 DNA", product: "Premium skincare set", visual: "cream-jar-demo", proof: ["Lid-package seal", "Opening changes state", "Premium warranty", "Anti grey-market"] },
      perfume: { label: "Perfume", profile: "NTAG 424 DNA", product: "Premium perfume", visual: "perfume-demo", proof: ["Cap-neck seal", "Lot and serial", "Warranty", "Anti-counterfeit"] },
      creamTube: { label: "Cream", profile: "NTAG213 + batch", product: "Dermocosmetic cream", visual: "cream-tube-demo", proof: ["Seal over flip cap", "Visible batch", "Warranty", "Repurchase"] },
      bracelet: { label: "Wristband", profile: "NTAG215", product: "VIP event wristband", visual: "event-bracelet-demo", proof: ["Phone taps wristband", "Serialized UID", "VIP zones", "Duplicate block"] },
      ticket: { label: "Ticket", profile: "QR + NFC UID", product: "VIP party ticket", visual: "party-ticket-demo", proof: ["Visible QR", "UID fallback", "Zone access", "Replay blocked"] },
      sneaker: { label: "Sneaker", profile: "NTAG 424 DNA", product: "Drop Runner 37Z", visual: "sneaker-demo", proof: ["Tongue tap", "UID + SUN", "Rarity visible", "Owner/token"] },
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

function getRealProductBadge(locale: AppLocale) {
  if (locale === "en") return "Real product";
  if (locale === "pt-BR") return "Produto real";
  return "Producto real";
}

function formatEventResult(value?: string | null) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return "SIN DATO";
  if (normalized.includes("AUTH_OK") || normalized === "VALID") return "AUTENTICADO";
  if (normalized.includes("NOT_REGISTERED")) return "NO REGISTRADO";
  if (normalized.includes("REPLAY") || normalized.includes("DUPLICATE")) return "COPIA BLOQUEADA";
  if (normalized.includes("TAMPER")) return "MANIPULADO";
  if (normalized.includes("OPEN")) return "ABIERTO";
  if (normalized.includes("ORIGIN") || normalized.includes("PRODUCT")) return "ORIGEN LISTO";
  if (normalized.includes("REVOKED")) return "REVOCADO";
  if (normalized.includes("INVALID")) return "INVALIDO";
  return "EVENTO REGISTRADO";
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
      blocked: ["Reclamo de dueño", "Token de valor", "Garantia postventa"],
      chain: "Sin NFT: producto todavia no fue comprado ni reclamado.",
      primaryAction: "origin",
      primaryLabel: txt.controls.openOrigin,
    };
  }
  if (beat === 2) {
    return {
      tone: "risk",
      headline: "Copia o duplicado bloqueado",
      body: "El sistema conserva trazabilidad, pero bloquea club, puntos, tienda y tokenizacion hasta un nuevo toque fisico valido.",
      stateLabel: "RIESGO BLOQUEADO",
      allowed: ["Ver procedencia", "Reportar incidente"],
      blocked: ["Reclamo de dueño", "Garantia", "Tokenizacion", "Tienda"],
      chain: "No se firma en cadena cuando hay copia o URL reutilizada.",
      primaryAction: "report",
      primaryLabel: "Reportar copia",
    };
  }
  if (beat === 3) {
    return {
      tone: "open",
      headline: "Sello abierto como evento del producto",
      body: "El producto sigue siendo autentico. Cambia su estado fisico y habilita postventa o token de valor solo con compra/reclamo validado.",
      stateLabel: "SELLO ABIERTO",
      allowed: ["Garantia postventa", "Procedencia", "Token de valor con prueba de compra"],
      blocked: ["Reventa como cerrado", "Reclamo anonimo sin prueba"],
      chain: "NFT Polygon disponible cuando la politica de dueño confirma comprador.",
      primaryAction: "tokenize",
      primaryLabel: txt.controls.tokenize,
    };
  }
  return {
    tone: "ok",
    headline: "Toque valido con ruta de confianza",
    body: `Origen y toque quedan unidos en ${distance}. El consumidor ve autenticidad y la marca recibe datos accionables.`,
    stateLabel: "AUTENTICADO",
    allowed: ["Unirse al club", "Guardar pasaporte", "Tokenizacion Amoy", "Voucher o recompra"],
    blocked: ["Transferir dueño sin ingreso/reclamo"],
    chain: "Auto-tokenizacion activa: el toque valido crea solicitud y puede cerrar con tx_hash/token_id en Polygon Amoy.",
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
  const realProductBadge = getRealProductBadge(locale);
  const liveEvents = Array.isArray(summary?.events) ? summary.events : [];
  const latestEvent = liveEvents[0];
  const livePoints = liveEvents.flatMap((event) => {
    const lat = toFiniteNumber(event.lat);
    const lng = toFiniteNumber(event.lng);
    if (lat === null || lng === null) return [];
    return [{
      city: event.city || "Sin dato",
      country: event.country_code || "UNK",
      lat,
      lng,
      scans: 1,
      risk: /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "") ? 1 : 0,
      status: formatEventResult(event.result),
      lastSeen: event.created_at || fallbackLastSeen,
      vertical,
    }];
  });

  const mapPoints = useMemo(() => {
    const originPoint = { city: LOCATIONS.origin.city, country: LOCATIONS.origin.country, lat: LOCATIONS.origin.lat, lng: LOCATIONS.origin.lng, scans: 1, risk: 0, status: "ORIGEN LISTO", lastSeen: fallbackLastSeen, vertical };
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
    const modeLabel = mode === "replay" ? "COPIA" : mode === "tamper" ? "APERTURA" : "TOQUE";
    setSimulating(true);
    setBeat(nextBeat);
    setStatus(`${txt.controls.sendingScan} ${modeLabel.toLowerCase()} - ${nextDestination.city}...`);
    try {
      const response = await fetch("/api/demo/simulate-tap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, city: nextDestination.city, countryCode: nextDestination.countryCode, lat: nextDestination.lat, lng: nextDestination.lng, deviceLabel: `Laboratorio nexID - ${nextDestination.label}` }),
      });
      const payload = await response.json().catch(() => ({ ok: false, reason: "invalid json" }));
      if (!response.ok || payload?.ok === false) throw new Error(String(payload?.reason || payload?.payload?.reason || "lectura fallida"));
      if (payload?.degraded) {
        setStatus(`${modeLabel}: ${String(payload.reason || txt.controls.adminKey)}`);
        setActionMessage(mode === "replay" ? "Copia simulada: reclamo de dueño, puntos y tokenizacion quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra evento del producto y queda listo para postventa controlada." : "Toque valido: club, tienda y analitica quedan listos para activar.");
        return;
      }
      setStatus(`${modeLabel}: ${txt.controls.registeredScan}`);
      setActionMessage(mode === "replay" ? "Copia simulada: reclamo de dueño, puntos y tokenizacion quedan bloqueados." : mode === "tamper" ? "Sello abierto: se registra evento del producto y queda listo para postventa controlada." : "Toque valido: club, tienda y analitica quedan listos para activar.");
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
      setActionMessage(`Toque actual abierto en Maps: ${destination.city}.`);
      return;
    }
    if (action === "report") {
      setActionMessage("Incidente creado para CRM: copia, manipulacion o inconsistencia queda listo para revision operativa.");
      return;
    }
    if (action === "warranty") {
      setActionMessage(beat === 2 ? "Garantia bloqueada: se necesita un nuevo toque fisico valido." : "Garantia preparada: queda asociada al pasaporte del consumidor y a la marca.");
      return;
    }
    if (action === "tokenize") {
      setActionMessage(beat === 3 ? "Tokenizacion de valor preparada: requiere compra/reclamo validado antes de transferir dueño." : beat === 1 ? "Tokenizacion automatica lista: un toque valido crea solicitud y registra tx_hash/token_id en Polygon Amoy." : "Tokenizacion bloqueada por politica de seguridad para este estado.");
      return;
    }
    setActionMessage(beat === 2 ? "Club bloqueado por copia. Repeti el toque fisico para continuar." : "Club/tienda listo: el consumidor puede asociarse y recibir beneficios de la marca.");
  }

  function startGuidedDemo() {
    setBeat(0);
    setRunning(true);
    setModalView(null);
    setActionMessage("Modo guiado activo: primero mira la etiqueta cerrada, despues el toque valido, copia bloqueada y apertura con reclamo/tokenizacion.");
  }

  return (
    <main className="demo-lab-shell container-shell py-8 text-slate-100">
      <DemoLabStudioHero
        txt={txt}
        beat={beat}
        vertical={vertical}
        activeVertical={activeVertical}
        scenario={scenario}
        destination={destination}
        routeKm={routeKm}
        locale={locale}
        summary={summary}
        liveEvents={liveEvents}
        latestEvent={latestEvent}
        simulating={simulating}
        onVertical={setVertical}
        onBeat={setBeat}
        onPassport={() => setModalView("mobile")}
        onValid={() => void simulate("valid")}
        onOpen={() => void simulate("tamper")}
        onReplay={() => void simulate("replay")}
      />

      <DemoFinalTapDock
        status={status}
        simulating={simulating}
        onValid={() => void simulate("valid")}
        onTamper={() => void simulate("tamper")}
        onReplay={() => void simulate("replay")}
        onRefresh={() => void refreshSummary()}
      />

      <DemoDifferentiatorStrip beat={beat} onGuided={startGuidedDemo} />

      <InstitutionalVideoPanel locale={locale} variant="demo" className="mt-5" />

      <DemoCinematicShowcase
        beat={beat}
        locale={locale}
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
                  <button suppressHydrationWarning type="button" onClick={() => setModalView("mobile")} className="demo-lab-modal-open-button">Ver resultado en celular</button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {DEMO_VERTICAL_ORDER.map((item) => (
                  <button suppressHydrationWarning key={item} type="button" onClick={() => setVertical(item)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${vertical === item ? "border-cyan-300/50 bg-cyan-500/20 text-cyan-100" : "border-white/15 bg-white/5 text-slate-300"}`}>{txt.verticals[item].label}</button>
                ))}
              </div>
              <div className={`demo-lab-product-stage demo-lab-product-stage--${vertical} demo-lab-product-stage--beat-${beat} demo-lab-product-stage--${scenario.tone} mt-4`}>
                <StageRouteLayer txt={txt} routeKm={routeKm} destination={destination} scenario={scenario} locale={locale} />
                <span className="demo-lab-product-depth-floor" aria-hidden="true" />
                <span className="demo-lab-product-depth-rim" aria-hidden="true" />
                <DemoLabProductThreeStage
                  vertical={vertical}
                  product={activeVertical.product}
                  beat={beat}
                  badge={realProductBadge}
                />
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
                    <p className="font-bold text-white">{event.city || "Sin dato"}, {event.country_code || "S/D"} / {formatEventResult(event.result)}</p>
                    <p className="mt-1 text-slate-400">{event.product_name || activeVertical.product} / {event.uidMasked || "UID-NA"}</p>
                    <p className="mt-1 text-slate-500">{event.created_at || "sin fecha"}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </aside>
      </section>

      <details className="demo-lab-tech-map mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-3 md:p-5">
        <summary className="cursor-pointer text-sm font-black text-cyan-100">
          Mapa operativo completo / calor de actividad
          <span className="ml-2 text-xs font-semibold text-slate-400">{LOCATIONS.origin.city} -&gt; {destination.city} - {routeKm.toLocaleString(locale)} km</span>
        </summary>
        <div className="mt-4">
          <WorldMapRealtime
            title={txt.controls.mapTitle}
            subtitle={`${LOCATIONS.origin.city} -> ${destination.city}. ${txt.controls.distance}: ${routeKm.toLocaleString(locale)} km.`}
            points={mapPoints}
            routes={[{ fromLat: LOCATIONS.origin.lat, fromLng: LOCATIONS.origin.lng, toLat: destination.lat, toLng: destination.lng, tone: activeBeat.mode === "replay" ? "warn" : "info" }]}
            metadataRows={(point) => [{ label: "Coordenadas", value: `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}` }, { label: "Abrir", value: mapsLink(point) }]}
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

function DemoLabStudioHero({
  txt,
  beat,
  vertical,
  activeVertical,
  scenario,
  destination,
  routeKm,
  locale,
  summary,
  liveEvents,
  latestEvent,
  simulating,
  onVertical,
  onBeat,
  onPassport,
  onValid,
  onOpen,
  onReplay,
}: {
  txt: DemoCopy;
  beat: Beat;
  vertical: Vertical;
  activeVertical: DemoCopy["verticals"][Vertical];
  scenario: DemoScenario;
  destination: DemoLocation;
  routeKm: number;
  locale: AppLocale;
  summary: DemoSummary | null;
  liveEvents: DemoEvent[];
  latestEvent?: DemoEvent;
  simulating: boolean;
  onVertical: (vertical: Vertical) => void;
  onBeat: (beat: Beat) => void;
  onPassport: () => void;
  onValid: () => void;
  onOpen: () => void;
  onReplay: () => void;
}) {
  const verticalList = DEMO_VERTICAL_ORDER;
  const productFacts = [
    { icon: PackageCheck, label: "Producto", value: activeVertical.product },
    { icon: MapPin, label: "Origen", value: "Valle de Uco, Argentina" },
    { icon: UserRound, label: "Productor", value: "Bodega Demo" },
    { icon: CalendarDays, label: "Cosecha", value: vertical === "wine" ? "2022" : "Lote vigente" },
    { icon: Fingerprint, label: "Perfil", value: activeVertical.profile },
    { icon: ShieldCheck, label: "Estado", value: scenario.stateLabel },
  ];
  const provenance = [
    { label: "Origen", value: "Valle de Uco, Mendoza, Argentina" },
    { label: "Elaboracion", value: "Bodega Demo - lote MZA-2026-0424" },
    { label: "Embotellado", value: vertical === "wine" ? "750 ml - 100% Malbec" : activeVertical.product },
    { label: "Distribucion", value: "Canal autorizado" },
    { label: "Punto de venta", value: `${destination.city}, ${destination.country}` },
    { label: "Ultima lectura", value: latestEvent ? `${latestEvent.city || destination.city} - ${formatEventResult(latestEvent.result)}` : "Hace segundos" },
  ];
  const trustItems = [
    { icon: ShieldCheck, title: "Infraestructura segura", body: "Datos inmutables en blockchain" },
    { icon: BadgeCheck, title: "Privacidad por diseno", body: "Solo compartis lo que necesitas" },
    { icon: CheckCircle2, title: "Verifica siempre", body: "Un toque. Cero dudas." },
  ];
  const quickFlow = locale === "en"
    ? [
      { n: "1", title: "Tap", body: "Physical product proof" },
      { n: "2", title: "Understand", body: "Origin, batch and seal" },
      { n: "3", title: "Claim", body: "Safe buyer ownership" },
      { n: "4", title: "Activate", body: "Warranty, club or NFT" },
    ]
    : locale === "pt-BR"
    ? [
      { n: "1", title: "Toque", body: "Prova do produto fisico" },
      { n: "2", title: "Entenda", body: "Origem, lote e lacre" },
      { n: "3", title: "Claim", body: "Dono validado" },
      { n: "4", title: "Ative", body: "Garantia, clube ou NFT" },
    ]
    : [
      { n: "1", title: "Toca", body: "Prueba fisica del producto" },
      { n: "2", title: "Entende", body: "Origen, lote y sello" },
      { n: "3", title: "Reclama", body: "Dueno validado" },
      { n: "4", title: "Activa", body: "Garantia, club o NFT" },
    ];
  const topActions = locale === "en"
    ? { product: "See product proof", passport: "See passport" }
    : locale === "pt-BR"
    ? { product: "Ver prova do produto", passport: "Ver passport" }
    : { product: "Ver prueba del producto", passport: "Ver pasaporte" };
  const backHome = locale === "en" ? "Back to landing" : locale === "pt-BR" ? "Voltar para a landing" : "Volver a la landing";

  return (
    <section className={`demo-lab-studio demo-lab-studio--${vertical} demo-lab-studio--${scenario.tone}`}>
      <Link href="/" className="demo-lab-back-home" aria-label={backHome}>
        <ArrowLeft size={18} strokeWidth={2.5} />
        <span>{backHome}</span>
      </Link>
      <div className="demo-lab-studio-grid">
        <aside className="demo-lab-studio-left">
          <div className="demo-lab-studio-copy">
            <p>{txt.heroEyebrow}</p>
            <h1>Descubrir. Verificar. Confiar.</h1>
            <span>{txt.heroBody}</span>
          </div>

          <div className="demo-lab-studio-plain-flow" aria-label="Resumen simple del flujo">
            {quickFlow.map((item) => (
              <div key={item.n}>
                <strong>{item.n}</strong>
                <span>{item.title}</span>
                <small>{item.body}</small>
              </div>
            ))}
          </div>

          <div className="demo-lab-studio-top-actions">
            <a href="#demo-lab-product-stage">{topActions.product}</a>
            <button suppressHydrationWarning type="button" onClick={onPassport}>{topActions.passport}</button>
          </div>

          <div className="demo-lab-studio-passport">
            <p>Estado del pasaporte digital</p>
            <div className="demo-lab-studio-passport-row">
              <span className="demo-lab-studio-shield"><ShieldCheck size={32} strokeWidth={2.4} /></span>
              <div>
                <strong>{beat === 2 ? "COPIA BLOQUEADA" : beat === 0 ? "LISTO PARA TOQUE" : "NFT VERIFICADO"}</strong>
                <small>{scenario.chain}</small>
              </div>
            </div>
            <button suppressHydrationWarning type="button" onClick={onPassport}>Ver pasaporte</button>
          </div>

          <div className="demo-lab-studio-verticals">
            <p>Otras verticales</p>
            <span>Explora como nexID se adapta a tu industria.</span>
            <div className="demo-lab-studio-vertical-list">
              {verticalList.map((item) => (
                <button
                  suppressHydrationWarning
                  key={item}
                  type="button"
                  onClick={() => onVertical(item)}
                  className={vertical === item ? "is-active" : ""}
                >
                  <DemoStudioMiniProduct vertical={item} />
                  <span>
                    <strong>{txt.verticals[item].label}</strong>
                    <small>{txt.verticals[item].profile}</small>
                  </span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div id="demo-lab-product-stage" className="demo-lab-studio-stage">
          <div className="demo-lab-studio-stage-head">
            <p>Producto real</p>
            <span>Producto, tag NFC y pasaporte celular en una sola prueba.</span>
          </div>
          <div className="demo-lab-studio-callout demo-lab-studio-callout--nfc">
            <strong>NFC</strong>
            <span>Zona de toque</span>
            <small>Acerca tu dispositivo a la etiqueta</small>
          </div>
          <div className="demo-lab-studio-product">
            <span className="demo-lab-studio-pedestal" />
            <span className="demo-lab-studio-reflection" />
            <DemoCinematicProductRender
              vertical={vertical}
              product={activeVertical.product}
              badge={getRealProductBadge(locale)}
              beat={beat}
              title={scenario.stateLabel}
              stat={scenario.chain}
              variant="studio"
            />
          </div>
          <div className="demo-lab-studio-statusbar">
            <span><i /> {beat === 2 ? "Replay bloqueado" : beat === 3 ? "Sello abierto" : "Toque simulado"}</span>
            <span>{activeVertical.profile}</span>
            <span>Ultima lectura</span>
            <strong>{latestEvent?.created_at ? "feed real" : "hace segundos"}</strong>
          </div>
          <div className="demo-lab-studio-actions">
            <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid}>Toque valido</button>
            <button suppressHydrationWarning type="button" disabled={simulating} onClick={onReplay}>Copia bloqueada</button>
            <button suppressHydrationWarning type="button" disabled={simulating} onClick={onOpen}>Abrir sello</button>
          </div>
        </div>

        <aside className="demo-lab-studio-right">
          <div className="demo-lab-studio-info">
            <div className="demo-lab-studio-panel-head">
              <p>Informacion del producto</p>
              <span><i /> Autentico</span>
            </div>
            <div className="demo-lab-studio-facts">
              {productFacts.map((fact) => {
                const Icon = fact.icon;
                return (
                  <div key={fact.label}>
                    <Icon size={16} />
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="demo-lab-studio-info demo-lab-studio-info--provenance">
            <div className="demo-lab-studio-panel-head">
              <p>Procedencia verificada</p>
              <span>{routeKm.toLocaleString(locale)} km</span>
            </div>
            <ol>
              {provenance.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                  <span />
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.value}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>

      <div className="demo-lab-studio-bottom">
        {trustItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title}>
              <Icon size={22} />
              <span>
                <strong>{item.title}</strong>
                <small>{item.body}</small>
              </span>
            </div>
          );
        })}
        <div>
          <Fingerprint size={22} />
          <span>
            <strong>{summary?.tagCount ?? "--"} tags / {liveEvents.length} eventos</strong>
            <small>{LOCATIONS.origin.city} {"->"} {destination.city}</small>
          </span>
        </div>
      </div>

      <div className="demo-lab-studio-beats" aria-label="Estados de la experiencia">
        {([0, 1, 2, 3] as Beat[]).map((item) => (
          <button suppressHydrationWarning key={item} type="button" onClick={() => onBeat(item)} className={beat === item ? "is-active" : ""}>
            <span>{String(item + 1).padStart(2, "0")}</span>
            <strong>{txt.beats[item].title.replace(/^\d+\.\s*/, "")}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function DemoStudioMiniProduct({ vertical }: { vertical: Vertical }) {
  return (
    <span className={`demo-lab-studio-mini demo-lab-studio-mini--${vertical}`} aria-hidden="true">
      <i />
    </span>
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
    { beat: 0, kicker: "01", title: "Producto cerrado", body: "La etiqueta NFC esta intacta. Todavia no libera beneficios ni reclamo de dueño." },
    { beat: 1, kicker: "02", title: "Toque valido", body: "El SUN dinamico valida el producto y une origen, ubicacion y consumidor." },
    { beat: 2, kicker: "03", title: "Copia bloqueada", body: "Una URL repetida o copiada no habilita club, tienda ni NFT." },
    { beat: 3, kicker: "04", title: "Apertura + reclamo", body: "El sello abierto dispara postventa, certificado y reclamo de dueño." },
  ];

  return (
    <section className="demo-lab-first-run-guide" aria-label="Guia rapida para probar la demo">
      <div className="demo-lab-guide-copy">
        <p>Primera vez aca</p>
        <h3>Proba el flujo como lo haria un cliente en 30 segundos.</h3>
        <span>Arranca cerrado, hace un toque valido, mira como bloquea la copia y termina con sello abierto, NFT y reclamo.</span>
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
        <button suppressHydrationWarning type="button" onClick={onGuided}>Ver prueba guiada</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid}>Toque valido</button>
        <button suppressHydrationWarning type="button" disabled={simulating} onClick={onOpen}>Abrir sello</button>
        <button suppressHydrationWarning type="button" onClick={onMobile}>Ver celular</button>
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
      backend: "Servidor: lote y UID listos, sin reclamo de dueño ni token de valor habilitado.",
      next: "Siguiente: simular toque valido.",
    },
    1: {
      title: "Toque fisico fresco",
      body: `El cliente valida autenticidad y ve la ruta al origen en ${distance}.`,
      backend: "Servidor: evento valido, anti copia OK, acciones comerciales habilitadas.",
      next: "Siguiente: abrir celular, tokenizar o simular apertura.",
    },
    2: {
      title: "Copia bloqueada",
      body: "La prueba muestra por que copiar una URL no alcanza para reclamar beneficios.",
      backend: "Servidor: riesgo registrado; reclamo, club, tienda sensible y token quedan bloqueados.",
      next: "Siguiente: repetir con un toque valido.",
    },
    3: {
      title: "Sello abierto",
      body: "La etiqueta se parte visualmente y el producto cambia de estado.",
      backend: "Servidor: postventa, certificado, solicitud de token y reclamo requieren politica de compra/dueño.",
      next: "Siguiente: abrir NFT/certificado o reclamar dueño.",
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
    { label: "Toque fisico", value: beat === 0 ? "pendiente" : beat === 2 ? "sospechoso" : "fresco", tone: beat === 0 ? "pending" : beat === 2 ? "blocked" : "ok" },
    { label: "SUN anti copia", value: beat === 2 ? "bloqueado" : beat === 0 ? "en espera" : "ok", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Marca", value: "demobodega", tone: "ok" },
    { label: "Dueño", value: beat === 3 ? "reclamo listo" : beat === 2 ? "bloqueado" : "con regla", tone: beat === 3 ? "ok" : beat === 2 ? "blocked" : "pending" },
    { label: "Polygon", value: beat === 2 ? "sin NFT" : beat === 0 ? "antes de cadena" : "solicitud lista", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: "Tienda", value: beat === 2 ? "cerrada" : beat === 0 ? "publica" : "abierta", tone: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
  ] as const;
}

function DemoDifferentiatorStrip({ beat, onGuided }: { beat: Beat; onGuided: () => void }) {
  const chain = ["Producto fisico", "Confianza", "Dueño", "Comunidad", "Recompra", "Tienda", "Datos"];
  const activeIndex = beat === 0 ? 0 : beat === 1 ? 2 : beat === 2 ? 1 : 6;

  return (
    <section className="demo-lab-differentiator-strip mt-5">
      <div className="demo-lab-differentiator-copy">
        <p>Diferencial nexID</p>
        <h2>No vendemos solo anti-falsificacion. Convertimos cada producto en canal propio de ingresos.</h2>
        <span>El flujo que tiene que entender cualquier bodega, marca o evento: validar confianza, reclamar dueño, activar comunidad, recompra, tienda y datos.</span>
      </div>
      <div className="demo-lab-differentiator-chain" aria-label="Cadena de valor nexID">
        {chain.map((item, index) => (
          <span key={item} className={index <= activeIndex ? "active" : ""}>{item}</span>
        ))}
      </div>
      <button suppressHydrationWarning type="button" onClick={onGuided}>Presentacion guiada 90s</button>
    </section>
  );
}

function DemoCinematicShowcase({
  beat,
  locale,
  vertical,
  product,
  label,
  onGuided,
}: {
  beat: Beat;
  locale: AppLocale;
  vertical: Vertical;
  product: string;
  label: string;
  onGuided: () => void;
}) {
  const localized = locale === "en"
    ? {
      label: "nexID visual studio",
      title: "A demo that feels like a video: real product, physical proof, risk and business.",
      body: "This block works as a visual pitch inside the platform: any brand can understand trust, ownership, data and revenue in seconds.",
      openPack: "Open visual pack",
      scenes: [
        { beat: 0, tag: "Scene 01", title: "Product is born", body: "Premium package, UID and closed NFC label before the first tap.", stat: "UID + lot", tone: "origin" },
        { beat: 1, tag: "Scene 02", title: "Live tap", body: "Dynamic SUN, distance, origin and actionable data for consumer and brand.", stat: "Verified", tone: "ok" },
        { beat: 2, tag: "Scene 03", title: "Attack blocked", body: "A copied URL does not open benefits, claim, tokenization or store actions.", stat: "No claim", tone: "risk" },
        { beat: 3, tag: "Scene 04", title: "Business loop", body: "Open seal, owner claim, certificate, community and repurchase.", stat: "Open", tone: "open" },
      ],
      proof: {
        sun: beat === 0 ? "waiting" : beat === 2 ? "blocked" : "valid",
        claim: beat === 3 ? "owner ready" : beat === 2 ? "denied" : "gated",
        nft: beat === 2 ? "no mint" : beat === 0 ? "pre-chain" : "request",
        market: beat === 2 ? "closed" : beat === 0 ? "public" : "open",
      },
      proofLabels: { claim: "Claim", market: "Store" },
      passport: "Digital passport",
      tokenTitle: beat === 2 ? "Risk blocked" : beat === 0 ? "Waiting tap" : beat === 3 ? "Owner + NFT" : "NFT ready",
      tokenBody: beat === 2 ? "Replay does not unlock benefits." : "Hashed UID, access rules and on-chain evidence.",
      graph: "demand / risk / claim / repurchase",
    }
    : locale === "pt-BR"
      ? {
        label: "Estudio visual nexID",
        title: "Uma demo que parece video: produto real, prova fisica, risco e negocio.",
        body: "Este bloco funciona como apresentacao visual dentro da plataforma: qualquer marca entende confianca, dono, dados e receita em segundos.",
        openPack: "Abrir pacote visual",
        scenes: [
          { beat: 0, tag: "Cena 01", title: "Produto nasce", body: "Embalagem premium, UID e etiqueta NFC fechada antes do primeiro toque.", stat: "UID + lote", tone: "origin" },
          { beat: 1, tag: "Cena 02", title: "Toque vivo", body: "SUN dinamico, distancia, origem e dados acionaveis para consumidor e marca.", stat: "Verificado", tone: "ok" },
          { beat: 2, tag: "Cena 03", title: "Ataque bloqueado", body: "Uma URL copiada nao abre beneficios, dono, tokenizacao nem loja.", stat: "Sem dono", tone: "risk" },
          { beat: 3, tag: "Cena 04", title: "Ciclo comercial", body: "Lacre aberto, dono, certificado, comunidade e recompra.", stat: "Aberto", tone: "open" },
        ],
        proof: {
          sun: beat === 0 ? "em espera" : beat === 2 ? "bloqueado" : "valido",
          claim: beat === 3 ? "dono pronto" : beat === 2 ? "negado" : "com regra",
          nft: beat === 2 ? "sem mint" : beat === 0 ? "pre-cadeia" : "pedido",
          market: beat === 2 ? "fechada" : beat === 0 ? "publica" : "aberta",
        },
        proofLabels: { claim: "Dono", market: "Loja" },
        passport: "Passaporte digital",
        tokenTitle: beat === 2 ? "Risco bloqueado" : beat === 0 ? "Esperando toque" : beat === 3 ? "Dono + NFT" : "NFT pronto",
        tokenBody: beat === 2 ? "Replay nao libera beneficios." : "UID com hash, regras de acesso e evidencia em cadeia.",
        graph: "demanda / risco / dono / recompra",
      }
      : {
        label: "Estudio visual nexID",
        title: "Una prueba que se entiende como video: producto real, prueba fisica, riesgo y negocio.",
        body: "Este bloque funciona como presentacion visual dentro de la plataforma: cualquier marca entiende confianza, dueño, datos e ingresos en segundos.",
        openPack: "Abrir paquete visual",
        scenes: [
          { beat: 0, tag: "Escena 01", title: "Producto nace", body: "Envase de alto valor, UID y etiqueta NFC cerrada antes del primer toque.", stat: "UID + lote", tone: "origin" },
          { beat: 1, tag: "Escena 02", title: "Toque vivo", body: "SUN dinamico, distancia, origen y datos accionables para consumidor y marca.", stat: "Verificado", tone: "ok" },
          { beat: 2, tag: "Escena 03", title: "Ataque bloqueado", body: "Una URL copiada no abre beneficios, reclamo, tokenizacion ni tienda.", stat: "Sin reclamo", tone: "risk" },
          { beat: 3, tag: "Escena 04", title: "Ciclo comercial", body: "Sello abierto, reclamo de dueño, certificado, comunidad y recompra.", stat: "Abierto", tone: "open" },
        ],
        proof: {
          sun: beat === 0 ? "en espera" : beat === 2 ? "bloqueado" : "valido",
          claim: beat === 3 ? "dueño listo" : beat === 2 ? "denegado" : "con regla",
          nft: beat === 2 ? "sin NFT" : beat === 0 ? "antes de cadena" : "pedido listo",
          market: beat === 2 ? "cerrada" : beat === 0 ? "publica" : "abierta",
        },
        proofLabels: { claim: "Reclamo", market: "Tienda" },
        passport: "Pasaporte digital",
        tokenTitle: beat === 2 ? "Riesgo bloqueado" : beat === 0 ? "Esperando toque" : beat === 3 ? "Dueño + NFT" : "NFT listo",
        tokenBody: beat === 2 ? "La copia no libera beneficios." : "UID con hash, reglas de acceso y evidencia en cadena.",
        graph: "demanda / riesgo / reclamo / recompra",
      };
  const scenes: Array<{ beat: Beat; tag: string; title: string; body: string; stat: string; tone: "origin" | "ok" | "risk" | "open" }> = [
    localized.scenes[0],
    localized.scenes[1],
    localized.scenes[2],
    localized.scenes[3],
  ] as Array<{ beat: Beat; tag: string; title: string; body: string; stat: string; tone: "origin" | "ok" | "risk" | "open" }>;
  const active = scenes.find((scene) => scene.beat === beat) ?? scenes[1];
  const progress = `${(beat + 1) * 25}%`;
  const proofItems = [
    { label: "SUN", value: localized.proof.sun, state: beat === 0 ? "pending" : beat === 2 ? "blocked" : "ok" },
    { label: localized.proofLabels.claim, value: localized.proof.claim, state: beat === 3 ? "ok" : beat === 2 ? "blocked" : "pending" },
    { label: "NFT", value: localized.proof.nft, state: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
    { label: localized.proofLabels.market, value: localized.proof.market, state: beat === 2 ? "blocked" : beat === 0 ? "pending" : "ok" },
  ] as const;
  const graphBars = [56, beat === 0 ? 32 : 78, beat === 2 ? 26 : 88, beat === 3 ? 96 : 58];

  return (
    <section className={`demo-lab-cinematic-showcase demo-lab-cinematic-showcase--${active.tone} mt-5`} aria-label={localized.label}>
      <div className="demo-lab-cinematic-copy">
        <p>{localized.label}</p>
        <h2>{localized.title}</h2>
        <span>{localized.body}</span>
        <div className="demo-lab-cinematic-actions">
          <button suppressHydrationWarning type="button" onClick={onGuided}>Reproducir recorrido</button>
        </div>
        <div className="demo-lab-cinematic-scenes" aria-label="Escenas de la experiencia">
          {scenes.map((scene) => (
            <article key={scene.tag} className={scene.beat === beat ? "active" : ""}>
              <small>{scene.tag}</small>
              <strong>{scene.title}</strong>
              <em>{scene.stat}</em>
              <span>{scene.body}</span>
            </article>
          ))}
        </div>
      </div>

      <div className="demo-lab-cinematic-canvas" style={{ "--cinematic-progress": progress } as CSSProperties}>
        <span className="demo-lab-cinematic-scanline" aria-hidden="true" />
        <span className="demo-lab-cinematic-orbit demo-lab-cinematic-orbit--one" aria-hidden="true" />
        <span className="demo-lab-cinematic-orbit demo-lab-cinematic-orbit--two" aria-hidden="true" />
        <div className="demo-lab-cinematic-product-shell">
          <DemoCinematicProductRender
            vertical={vertical}
            product={product}
            badge={getRealProductBadge(locale)}
            beat={beat}
            title={active.title}
            stat={active.stat}
          />
        </div>

        <div className="demo-lab-cinematic-headline">
          <small>{active.tag}</small>
          <strong>{active.title}</strong>
          <span>{active.stat}</span>
        </div>

        <div className="demo-lab-cinematic-proof-stack">
          {proofItems.map((item) => (
            <span key={item.label} className={`demo-lab-cinematic-proof demo-lab-cinematic-proof--${item.state}`}>
              <b>{item.label}</b>
              <em>{item.value}</em>
            </span>
          ))}
        </div>

        <div className="demo-lab-cinematic-token-card">
          <p>{localized.passport}</p>
          <strong>{localized.tokenTitle}</strong>
          <span>{localized.tokenBody}</span>
        </div>

        <div className="demo-lab-cinematic-graph" aria-label="Grafico de negocio post toque">
          <div>
            {graphBars.map((height, index) => (
              <span key={index} className={index <= beat ? "active" : ""} style={{ "--bar-height": `${height}%` } as CSSProperties} />
            ))}
          </div>
          <p>{localized.graph}</p>
        </div>
      </div>
    </section>
  );
}

function DemoCinematicProductRender({
  vertical,
  product,
  badge,
  beat,
  title,
  stat,
  variant = "cinematic",
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  title: string;
  stat: string;
  variant?: "cinematic" | "studio";
}) {
  const state = beat === 2 ? "risk" : beat === 3 ? "open" : beat === 1 ? "ok" : "origin";
  const phoneStatus = beat === 2 ? "BLOQUEADO" : beat === 3 ? "SELLO ABIERTO" : beat === 1 ? "AUTENTICADO" : "LISTO";

  if (vertical === "wine") {
    return <DemoWineProduct product={product} badge={badge} beat={beat} stat={stat} variant={variant} />;
  }

  if (isEventAccessVertical(vertical)) {
    return <DemoEventAccessProduct vertical={vertical} product={product} badge={badge} beat={beat} variant={variant} />;
  }

  if (isPremiumCosmeticVertical(vertical)) {
    return <DemoPremiumCosmeticProduct vertical={vertical} product={product} badge={badge} beat={beat} variant={variant} />;
  }

  if (vertical === "sneaker") {
    return <DemoSneakerProduct product={product} badge={badge} beat={beat} stat={stat} variant={variant} />;
  }

  return (
    <div className={`demo-lab-cinematic-render demo-lab-cinematic-render--${variant} demo-lab-cinematic-render--${vertical} demo-lab-cinematic-render--${state}`} role="img" aria-label={`${badge}: ${product}. ${title}.`}>
      <span className="demo-lab-cinematic-render__glow" aria-hidden="true" />
      <span className="demo-lab-cinematic-render__floor" aria-hidden="true" />
      <div className="demo-lab-cinematic-render__product" aria-hidden="true">
        <span className="demo-lab-cinematic-render__main" />
        <span className="demo-lab-cinematic-render__neck" />
        <span className="demo-lab-cinematic-render__cap" />
        <span className="demo-lab-cinematic-render__accent" />
        <span className="demo-lab-cinematic-render__sole" />
        <span className="demo-lab-cinematic-render__lace demo-lab-cinematic-render__lace--one" />
        <span className="demo-lab-cinematic-render__lace demo-lab-cinematic-render__lace--two" />
        <span className="demo-lab-cinematic-render__lace demo-lab-cinematic-render__lace--three" />
        <span className="demo-lab-cinematic-render__label">
          <em>nexID</em>
          <strong>{product}</strong>
        </span>
        <span className="demo-lab-cinematic-render__seal">NFC</span>
      </div>
      <div className="demo-lab-cinematic-render__phone" aria-hidden="true">
        <i />
        <small>SALIDA CELULAR</small>
        <strong>{phoneStatus}</strong>
        <span>UID 04A7****1090</span>
      </div>
      <div className="demo-lab-cinematic-render__proof" aria-hidden="true">
        <small>{badge}</small>
        <strong>{product}</strong>
        <span>{stat}</span>
      </div>
    </div>
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
  const txStatus = beat === 2 ? "bloqueado" : beat === 0 ? "antes de cadena" : "tx/solicitud lista";
  const owner = beat === 3 ? "dueño listo" : beat === 2 ? "reclamo bloqueado" : "ingreso requerido";

  return (
    <article className={`demo-lab-proof-card demo-lab-proof-card--${scenario.tone}`}>
      <div className="demo-lab-proof-card-header">
        <span>{scenario.stateLabel}</span>
        <strong>Tarjeta de prueba</strong>
      </div>
      <h4>{product}</h4>
      <div className="demo-lab-proof-grid">
        <InfoCell label="Origen" value={LOCATIONS.origin.city} />
        <InfoCell label="Toque" value={destination.city} />
        <InfoCell label="Ruta" value={`${routeKm.toLocaleString(locale)} km`} />
        <InfoCell label="Token" value={txStatus} />
        <InfoCell label="Dueño" value={owner} />
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
  const cta = beat === 2 ? "Repetir toque fisico" : beat === 3 ? "Reclamar dueño" : beat === 0 ? "Acercar telefono" : "Unirme al club";

  return (
    <article className={`demo-lab-phone-mirror demo-lab-phone-mirror--${scenario.tone}`}>
      <div className="demo-lab-phone-shell">
        <div className="demo-lab-phone-topbar"><span />nexID celular</div>
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
    { label: "Club + beneficios", body: "Beneficios y recompra solo con toque valido.", unlocked: beat === 1 || beat === 3 },
    { label: "Garantia + reclamo", body: "Dueño, garantia y postventa con ingreso.", unlocked: beat === 3 },
    { label: "NFT / certificado", body: "Solicitud Polygon y token de valor si la politica lo permite.", unlocked: beat === 1 || beat === 3 },
    { label: "Tienda", body: "Reventa, comunidad y ofertas contextuales.", unlocked: beat === 1 || beat === 3 },
    { label: "Registro de datos", body: "Eventos, riesgo, zona, demanda y atribucion.", unlocked: beat !== 0 },
  ];

  return (
    <article className="demo-lab-unlock-ladder">
      <p>Escalera comercial</p>
      <h4>Que se habilita despues del toque</h4>
      <div>
        {rows.map((row) => (
          <span key={row.label} className={row.unlocked && beat !== 2 ? "unlocked" : beat === 2 && row.label !== "Info publica" ? "blocked" : ""}>
            <b>{row.label}</b>
            <em>{beat === 2 && row.label !== "Info publica" ? "bloqueado por copia" : row.body}</em>
          </span>
        ))}
      </div>
    </article>
  );
}

function DemoLabProductThreeStage({
  vertical,
  product,
  beat,
  badge,
}: {
  vertical: Vertical;
  product: string;
  beat: Beat;
  badge: string;
}) {
  const [ready, setReady] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const threeVertical = mapDemoVerticalToThree(vertical);

  useEffect(() => {
    setReady(false);
    setShowLoader(true);
    const timeoutId = window.setTimeout(() => setShowLoader(false), 900);
    return () => window.clearTimeout(timeoutId);
  }, [threeVertical]);

  if (isEventAccessVertical(vertical)) {
    return <DemoEventAccessProduct vertical={vertical} product={product} badge={badge} beat={beat} variant="stage" />;
  }

  if (isPremiumCosmeticVertical(vertical)) {
    return <DemoPremiumCosmeticProduct vertical={vertical} product={product} badge={badge} beat={beat} variant="stage" />;
  }

  if (vertical === "sneaker") {
    return <DemoSneakerProduct product={product} badge={badge} beat={beat} variant="stage" />;
  }

  if (vertical === "wine") {
    return <DemoWineProduct product={product} badge={badge} beat={beat} variant="stage" />;
  }

  return (
    <>
      <DemoRealProductShot vertical={vertical} product={product} badge={badge} variant="stage" />
      <div className="demo-lab-three-product demo-lab-three-product--with-real">
        {!ready && showLoader ? <span className="demo-lab-three-product-loader" aria-hidden="true" /> : null}
        <HeroThreeStage
          active={threeVertical}
          product={product}
          className="demo-lab-three-stage"
          state={beat === 3 ? "opened" : beat === 2 ? "blocked" : "idle"}
          onReady={() => setReady(true)}
        />
      </div>
    </>
  );
}

function isEventAccessVertical(vertical: Vertical) {
  return vertical === "bracelet" || vertical === "ticket";
}

function isPremiumCosmeticVertical(vertical: Vertical) {
  return vertical === "creamJar" || vertical === "perfume" || vertical === "creamTube";
}

function isEditorialProductVertical(vertical: Vertical) {
  return isEventAccessVertical(vertical) || isPremiumCosmeticVertical(vertical);
}

function DemoWineProduct({
  product,
  badge,
  beat,
  stat,
  variant,
}: {
  product: string;
  badge: string;
  beat: Beat;
  stat?: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets.wine;
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "SELLO ABIERTO" : beat === 0 ? "LISTO PARA TOQUE" : "AUTENTICADO";
  const action = blocked ? "Replay bloqueado" : opened ? "Reclamo + token listo" : "Compra confiable";
  const proof = stat || (blocked ? "SUN bloquea copia y beneficios" : "Origen, lote, sello y canal auditados");

  return (
    <div
      className={`demo-lab-wine-product demo-lab-wine-product--${variant} demo-lab-wine-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <span className="demo-lab-wine-product__aura" aria-hidden="true" />
      <span className="demo-lab-wine-product__floor" aria-hidden="true" />
      <figure className="demo-lab-wine-product__packshot" data-credit={asset.credit} aria-hidden="true">
        <img src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <span className="demo-lab-wine-product__brand-mask" />
        <span className="demo-lab-wine-product__label-cover">
          <em>nexID</em>
          <strong>{product}</strong>
          <small>Valle de Uco - 2022</small>
        </span>
        <figcaption>
          <span>Producto real</span>
          <strong>{product}</strong>
          <small>Valle de Uco - 2022 - NTAG 424 DNA TT</small>
        </figcaption>
      </figure>
      <div className="demo-lab-wine-product__seal" aria-hidden="true">
        <span>nexID</span>
        <strong>NTAG 424 DNA TT</strong>
        <em>{opened ? "abierto" : blocked ? "riesgo" : "sellado"}</em>
      </div>
      <div className="demo-lab-wine-product__chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-wine-product__phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-wine-product__proof" aria-hidden="true">
        <span>{badge}</span>
        <strong>Botella + sello + lote</strong>
        <small>{proof}</small>
      </div>
    </div>
  );
}

function DemoPremiumCosmeticProduct({
  vertical,
  product,
  badge,
  beat,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  const blocked = beat === 2;
  const opened = beat === 3;
  const isPerfume = vertical === "perfume";
  const status = blocked ? "RIESGO BLOQUEADO" : opened ? "SELLO ABIERTO" : beat === 0 ? "SELLADO" : "AUTENTICADO";
  const action = blocked ? "Sin reclamo" : opened ? "Garantia lista" : "Compra confiable";
  const referenceLabel = isPerfume ? "Perfume premium" : vertical === "creamJar" ? "Skincare premium" : "Dermo premium";
  const proofLabel = isPerfume ? "Tapa NFC + lote" : "Envase sellado + lote";

  return (
    <div
      className={`demo-lab-cosmetic-product demo-lab-cosmetic-product--${variant} demo-lab-cosmetic-product--${vertical} demo-lab-cosmetic-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <figure className="demo-lab-cosmetic-photo" data-credit={asset.credit} aria-hidden="true">
        <img src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <span className="demo-lab-cosmetic-label-cover">
          <em>nexID</em>
          <strong>{product}</strong>
          <small>{proofLabel}</small>
        </span>
        <figcaption>
          <span>{referenceLabel}</span>
          <strong>{product}</strong>
          <small>{proofLabel}</small>
        </figcaption>
      </figure>
      <div className="demo-lab-cosmetic-product-chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-cosmetic-phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-cosmetic-proof-card" aria-hidden="true">
        <span>NTAG 424 DNA</span>
        <strong>{isPerfume ? "Tapa + serie + lote" : "Envase + sello + lote"}</strong>
        <small>{blocked ? "Replay no abre garantia" : "SUN dinamico validado"}</small>
      </div>
    </div>
  );
}

function DemoEventAccessProduct({
  vertical,
  product,
  badge,
  beat,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  beat: Beat;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "SELLO ABIERTO" : beat === 0 ? "LISTO PARA TOQUE" : "ACCESO VERIFICADO";
  const primary = vertical === "ticket" ? "Entrada VIP" : "Pulsera VIP";
  const action = blocked ? "Sin beneficios" : opened ? "Reclamo listo" : "Autentico";

  return (
    <div
      className={`demo-lab-event-product demo-lab-event-product--${variant} demo-lab-event-product--${vertical} demo-lab-event-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <figure className="demo-lab-event-photo" data-credit={asset.credit}>
        <img src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>{badge}</span>
          <strong>{product}</strong>
        </figcaption>
      </figure>
      <div className="demo-lab-event-wristband" aria-hidden="true">
        <span className="demo-lab-event-wristband__band" />
        <span className="demo-lab-event-wristband__tag">N</span>
        <span className="demo-lab-event-wristband__chip" />
        <span className="demo-lab-event-wristband__lock">{opened ? "OPEN" : blocked ? "RISK" : "SUN"}</span>
      </div>
      <div className="demo-lab-event-phone" aria-hidden="true">
        <i />
        <span>{primary}</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-event-proof-card" aria-hidden="true">
        <span>NTAG215</span>
        <strong>NFC + pasaporte</strong>
        <small>{blocked ? "Replay no abre reclamo" : "Toque fisico validado"}</small>
      </div>
    </div>
  );
}

function DemoSneakerProduct({
  product,
  badge,
  beat,
  stat,
  variant,
}: {
  product: string;
  badge: string;
  beat: Beat;
  stat?: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets.sneaker;
  const blocked = beat === 2;
  const opened = beat === 3;
  const status = blocked ? "COPIA BLOQUEADA" : opened ? "OWNER LISTO" : beat === 0 ? "LISTO PARA TOQUE" : "AUTENTICADO";
  const action = blocked ? "Repetir tap fisico" : opened ? "Claim + token listo" : "SUN dinamico validado";
  const proof = stat || (blocked ? "Replay no habilita beneficios" : "Lengueta NFC + UID + lote verificable");

  return (
    <div
      className={`demo-lab-sneaker-product demo-lab-sneaker-product--${variant} demo-lab-sneaker-product--beat-${beat}`}
      role="img"
      aria-label={`${badge}: ${product}. ${status}.`}
    >
      <span className="demo-lab-sneaker-product__aura" aria-hidden="true" />
      <span className="demo-lab-sneaker-product__floor" aria-hidden="true" />
      <figure className="demo-lab-sneaker-product__photo" data-credit={asset.credit}>
        <img src={asset.imageUrl} alt="" loading="eager" decoding="async" />
        <figcaption>
          <span>{badge}</span>
          <strong>{product}</strong>
        </figcaption>
      </figure>
      <div className="demo-lab-sneaker-product__tag" aria-hidden="true">
        <span>nexID</span>
        <strong>{product}</strong>
        <em>NFC</em>
      </div>
      <div className="demo-lab-sneaker-product__chip" aria-hidden="true">NFC</div>
      <div className="demo-lab-sneaker-product__phone" aria-hidden="true">
        <i />
        <span>Salida celular</span>
        <strong>{status}</strong>
        <small>UID 04A7****1090</small>
        <em>{action}</em>
      </div>
      <div className="demo-lab-sneaker-product__proof" aria-hidden="true">
        <span>NTAG 424 DNA</span>
        <strong>Lengueta + UID + ownership</strong>
        <small>{proof}</small>
      </div>
    </div>
  );
}

function DemoRealProductShot({
  vertical,
  product,
  badge,
  variant,
}: {
  vertical: Vertical;
  product: string;
  badge: string;
  variant: DemoRealProductVariant;
}) {
  const asset = demoLabRealAssets[vertical];
  return (
    <figure
      className={`demo-lab-real-product-shot demo-lab-real-product-shot--${variant} demo-lab-real-product-shot--${vertical}`}
      data-credit={asset.credit}
      role="img"
      aria-label={`${badge}: ${product}`}
    >
      <img src={asset.imageUrl} alt="" loading="eager" decoding="async" />
      <figcaption>
        <span>{badge}</span>
        <strong>{product}</strong>
      </figcaption>
    </figure>
  );
}

function mapDemoVerticalToThree(vertical: Vertical): ThreeProductVertical {
  if (vertical === "bracelet") return "bracelet";
  if (vertical === "ticket") return "ticket";
  if (vertical === "seeds") return "seeds";
  if (vertical === "creamJar") return "creamJar";
  if (vertical === "perfume") return "perfume";
  if (vertical === "creamTube") return "creamTube";
  if (vertical === "sneaker") return "wine";
  return "wine";
}

function ProductIllustration({ vertical, product, label, beat }: { vertical: Vertical; product: string; label: string; beat: Beat }) {
  const uid = `demo-product-${vertical}`;
  const statusLabel = beat === 2 ? "BLOQ" : beat === 3 ? "ABIERTO" : "NFC";
  const productLine = product.length > 24 ? `${product.slice(0, 22)}...` : product;
  const accent = beat === 2 ? "#fb7185" : beat === 3 ? "#a78bfa" : "#22d3ee";
  const sceneState = beat === 0 ? "origin" : beat === 1 ? "auth" : beat === 2 ? "blocked" : "open";
  const sealTitle = beat === 2 ? "COPIA" : beat === 3 ? "ABIERTO" : "CERRADO";
  const sealBody = beat === 0 ? "UID SELLADO" : beat === 1 ? "SUN OK" : beat === 2 ? "SIN RECLAMO" : "RECLAMO LISTO";
  const stateTitle = beat === 2 ? "Riesgo bloqueado" : beat === 3 ? "Etiqueta NFC abierta" : "Etiqueta NFC cerrada";
  const stateBody = beat === 0 ? "lista para primer toque" : beat === 1 ? "toque validado" : beat === 2 ? "copia detenida" : "beneficios habilitados";

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
        <radialGradient id={`${uid}-floor`} cx="50%" cy="50%" r="58%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.34" />
          <stop offset="62%" stopColor="#0f172a" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.42" />
          <stop offset="26%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="72%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.22" />
        </linearGradient>
        <linearGradient id={`${uid}-label-paper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="54%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </linearGradient>
        <filter id={`${uid}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor={accent} floodOpacity="0.28" />
        </filter>
      </defs>

      <ellipse cx="180" cy="368" rx="132" ry="30" fill={`url(#${uid}-floor)`} />
      <ellipse cx="180" cy="368" rx="82" ry="13" fill="#e0f2fe" opacity="0.07" />
      <path d="M58 342 C110 320 249 320 303 344 L266 373 C219 388 134 388 93 373 Z" fill="#0f172a" opacity="0.32" />
      <path d="M78 348 C128 333 229 332 282 348" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" opacity="0.16" />
      <ellipse cx="180" cy="218" rx="156" ry="144" fill={`url(#${uid}-stage-glow)`} />

      {vertical === "wine" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M158 38h44l7 58c2 15 13 24 25 34 13 11 19 28 19 49v141c0 27-20 48-49 48h-48c-29 0-49-21-49-48V179c0-21 6-38 19-49 12-10 23-19 25-34l7-58Z" fill="#7f1d1d" />
          <path d="M158 38h44l5 48h-54l5-48Z" fill="#f59e0b" />
          <path d="M141 119c14-14 27-21 39-21s25 7 39 21c-10 12-68 12-78 0Z" fill="#14532d" opacity="0.86" />
          <path d="M210 113c22 16 34 36 34 68v132c0 24-16 42-40 42h-16c18-21 22-66 22-133V113Z" fill="#020617" opacity="0.26" />
          <path d="M132 139c11-17 26-24 48-24 22 0 38 8 51 25" fill="none" stroke="#fef3c7" strokeWidth="5" strokeLinecap="round" opacity="0.16" />
          <path d="M124 157c16-19 33-29 56-29 25 0 44 10 60 29v43H124v-43Z" fill={`url(#${uid}-rim)`} opacity="0.35" />
          <rect x="127" y="210" width="106" height="82" rx="12" fill="#0f172a" opacity="0.2" />
          <rect x="130" y="212" width="100" height="78" rx="10" fill={`url(#${uid}-label-paper)`} />
          <rect x="142" y="225" width="76" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.72" />
          <text x="180" y="252" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900" letterSpacing="2">GRAN RESERVA</text>
          <text x="180" y="270" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="2">MALBEC</text>
          <path d="M147 278h66" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" opacity="0.28" />
          <path d="M122 154c18-18 36-27 58-27 24 0 42 9 58 27v44H122v-44Z" fill="#450a0a" opacity="0.38" />
          <path d="M134 60c11-9 29-11 38-2 10 10 2 25-12 22-14-3-21-9-26-20Z" fill="#fde68a" opacity="0.52" />
          <path d="M149 54c-12 46-18 111-16 203" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.08" />
        </g>
      ) : null}

      {vertical === "seeds" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill="#84cc16" />
          <path d="M105 76h150c13 0 24 11 24 24v230c0 13-11 24-24 24H105c-13 0-24-11-24-24V100c0-13 11-24 24-24Z" fill={`url(#${uid}-holo)`} opacity="0.32" />
          <path d="M247 82c18 4 32 16 32 34v214c0 13-11 24-24 24h-26c14-26 18-79 18-161V82Z" fill="#14532d" opacity="0.2" />
          <path d="M101 88h158" stroke="#ecfccb" strokeWidth="10" strokeLinecap="round" opacity="0.42" />
          <path d="M96 177c46-18 115-18 168 2" fill="none" stroke="#fef08a" strokeWidth="4" strokeLinecap="round" opacity="0.16" />
          <rect x="101" y="105" width="158" height="52" rx="12" fill="#f0fdf4" />
          <text x="180" y="138" textAnchor="middle" fill="#166534" fontSize="13" fontWeight="900" letterSpacing="2">SEMILLAS</text>
          <rect x="119" y="169" width="122" height="34" rx="10" fill="#14532d" opacity="0.2" />
          <text x="180" y="191" textAnchor="middle" fill="#f0fdf4" fontSize="10" fontWeight="900" letterSpacing="1.6">TRAZA + ORIGEN</text>
          <path d="M109 289h142" stroke="#166534" strokeWidth="2" strokeDasharray="5 7" opacity="0.42" />
          <text x="180" y="317" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="900" letterSpacing="1.5">LOTE A12</text>
          {[132, 163, 197, 225].map((cx, index) => (
            <path key={cx} d={`M${cx} ${235 + (index % 2) * 14}c18-18 35-8 30 11-20 7-32 1-30-11Z`} fill="#facc15" opacity="0.82" />
          ))}
          {[126, 154, 188, 217].map((cx, index) => (
            <path key={`leaf-${cx}`} d={`M${cx} ${250 + (index % 2) * 9}c14-18 33-14 37 6-15 11-32 9-37-6Z`} fill="#fef3c7" opacity="0.34" />
          ))}
          <path d="M99 91h162" stroke="#ecfccb" strokeWidth="7" strokeLinecap="round" opacity="0.5" />
        </g>
      ) : null}

      {vertical === "creamJar" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <ellipse cx="180" cy="116" rx="73" ry="18" fill="#f8fafc" opacity="0.18" />
          <rect x="107" y="115" width="146" height="48" rx="16" fill={`url(#${uid}-metal)`} />
          <rect x="117" y="124" width="126" height="11" rx="6" fill="#f8fafc" opacity="0.38" />
          <path d="M89 164h182v111c0 47-34 78-91 78s-91-31-91-78V164Z" fill="#fce7f3" />
          <path d="M225 164h46v111c0 40-25 68-70 76 23-26 24-70 24-187Z" fill="#831843" opacity="0.12" />
          <path d="M89 164h182v64H89v-64Z" fill="#fff7ed" opacity="0.86" />
          <rect x="112" y="196" width="136" height="66" rx="14" fill="#fff1f2" />
          <rect x="125" y="207" width="110" height="10" rx="5" fill={`url(#${uid}-holo)`} opacity="0.48" />
          <text x="180" y="237" textAnchor="middle" fill="#be185d" fontSize="14" fontWeight="900" letterSpacing="4">CREMA</text>
          <text x="180" y="254" textAnchor="middle" fill="#9d174d" fontSize="8" fontWeight="900" letterSpacing="1.4">GARANTIA NFC</text>
          <path d="M91 275c27 25 62 38 89 38s62-13 89-38v16c0 38-36 62-89 62s-89-24-89-62v-16Z" fill="#fbcfe8" opacity="0.85" />
          <circle cx="239" cy="204" r="14" fill={`url(#${uid}-holo)`} opacity="0.74" />
          <path d="M116 178c9 45 8 104-5 138" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.22" />
        </g>
      ) : null}

      {vertical === "perfume" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="153" y="49" width="54" height="45" rx="8" fill={`url(#${uid}-metal)`} />
          <rect x="140" y="29" width="80" height="28" rx="8" fill="#f8fafc" />
          <rect x="151" y="34" width="58" height="7" rx="4" fill="#cbd5e1" opacity="0.7" />
          <path d="M110 116c0-22 18-40 40-40h60c22 0 40 18 40 40v194c0 24-19 43-43 43h-54c-24 0-43-19-43-43V116Z" fill={`url(#${uid}-glass)`} />
          <path d="M211 82c24 8 39 26 39 53v174c0 24-19 44-43 44h-18c19-26 24-77 22-271Z" fill="#020617" opacity="0.16" />
          <path d="M126 139c0-20 17-37 37-37h34c21 0 38 17 38 37v160c0 15-12 27-27 27h-56c-15 0-26-12-26-27V139Z" fill="#312e81" opacity="0.32" />
          <rect x="131" y="193" width="98" height="76" rx="12" fill="transparent" stroke="#e0e7ff" strokeWidth="2" opacity="0.45" />
          <rect x="144" y="206" width="72" height="9" rx="5" fill={`url(#${uid}-holo)`} opacity="0.56" />
          <text x="180" y="238" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="900" letterSpacing="2">PERFUME</text>
          <text x="180" y="255" textAnchor="middle" fill="#e0e7ff" fontSize="8" fontWeight="900" letterSpacing="1.2">ORIGEN VALIDADO</text>
          <path d="M122 126c20-22 80-26 110 4" stroke="#f8fafc" strokeWidth="8" strokeLinecap="round" opacity="0.16" />
          <path d="M136 126c-12 61-9 135 8 194" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.18" />
          <path d="M231 138c-8 58-7 109 5 153" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.08" />
        </g>
      ) : null}

      {vertical === "creamTube" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill="#67e8f9" />
          <path d="M127 79c0-26 21-47 53-47s53 21 53 47v230c0 27-18 46-53 46s-53-19-53-46V79Z" fill={`url(#${uid}-holo)`} opacity="0.34" />
          <path d="M203 39c20 8 30 23 30 40v230c0 27-18 46-53 46h-8c20-28 31-98 31-316Z" fill="#0e7490" opacity="0.22" />
          <path d="M140 90h80M139 106h82" stroke="#ecfeff" strokeWidth="3" strokeLinecap="round" opacity="0.28" />
          <rect x="143" y="176" width="74" height="94" rx="10" fill="#cffafe" opacity="0.82" />
          <text x="183" y="229" textAnchor="middle" fill="#155e75" fontSize="13" fontWeight="900" letterSpacing="3" transform="rotate(90 183 229)">CREMA</text>
          <path d="M154 188h52" stroke="#155e75" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
          <path d="M154 260h52" stroke="#155e75" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
          <rect x="130" y="333" width="100" height="45" rx="12" fill="#0f172a" />
          <rect x="137" y="343" width="86" height="9" rx="5" fill="#475569" />
          <path d="M144 66c20-17 52-17 72 0" stroke="#ecfeff" strokeWidth="8" strokeLinecap="round" opacity="0.34" />
          <path d="M145 78c-8 72-8 154 0 234" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" opacity="0.2" />
        </g>
      ) : null}

      {vertical === "bracelet" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-8 180 210)">
          <path d="M51 198c46-40 212-60 258-10 20 22 4 58-28 62-66 9-151 26-220-4-27-12-31-30-10-48Z" fill="#14b8a6" />
          <path d="M69 197c68 18 155 4 230 0 13 17 0 42-24 46-60 10-148 24-211-5-24-11-22-29 5-41Z" fill={`url(#${uid}-holo)`} opacity="0.62" />
          <path d="M62 216c70 22 155 11 229 4" fill="none" stroke="#ecfeff" strokeWidth="6" strokeLinecap="round" opacity="0.18" />
          <path d="M66 198c34-26 108-42 168-34" fill="none" stroke="#ccfbf1" strokeWidth="5" strokeLinecap="round" opacity="0.2" />
          <rect x="149" y="189" width="70" height="38" rx="9" fill="#0f172a" />
          <text x="184" y="214" textAnchor="middle" fill="#ecfeff" fontSize="16" fontWeight="900" letterSpacing="2">VIP</text>
          <rect x="155" y="222" width="58" height="7" rx="4" fill="#22d3ee" opacity="0.42" />
          {[83, 111, 138].map((cx) => <circle key={cx} cx={cx} cy="218" r="6" fill="#0f172a" opacity="0.72" />)}
          {[84, 111, 138].map((cx) => <circle key={`rim-${cx}`} cx={cx} cy="218" r="9" fill="none" stroke="#ccfbf1" strokeWidth="2" opacity="0.18" />)}
          <circle cx="276" cy="205" r="20" fill="#c4b5fd" opacity="0.82" />
          <circle cx="276" cy="205" r="11" fill="#f8fafc" opacity="0.4" />
          <rect x="262" y="225" width="38" height="13" rx="6" fill="#071827" opacity="0.32" />
        </g>
      ) : null}

      {vertical === "ticket" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-4 180 210)">
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill="#e11d48" />
          <path d="M66 129h228c19 0 34 15 34 34v114c0 19-15 34-34 34H66c-19 0-34-15-34-34V163c0-19 15-34 34-34Z" fill={`url(#${uid}-holo)`} opacity="0.56" />
          <path d="M294 129c19 0 34 15 34 34v114c0 19-15 34-34 34h-48c17-30 20-91 18-182h30Z" fill="#020617" opacity="0.15" />
          <circle cx="35" cy="220" r="21" fill="#07111f" />
          <circle cx="325" cy="220" r="21" fill="#07111f" />
          <path d="M222 145v150" stroke="#fff7ed" strokeWidth="3" strokeDasharray="7 9" opacity="0.38" />
          <text x="82" y="183" fill="#fff7ed" fontSize="24" fontWeight="900" letterSpacing="3">FIESTA VIP</text>
          <text x="82" y="209" fill="#ffedd5" fontSize="10" fontWeight="900" letterSpacing="1.6">ACCESO CON NFC</text>
          <path d="M73 252h130" stroke="#fecdd3" strokeWidth="3" strokeDasharray="7 8" opacity="0.42" />
          <rect x="240" y="222" width="58" height="58" rx="8" fill="#f8fafc" />
          {[252, 276].map((x) => [234, 258].map((y) => <rect key={`${x}-${y}`} x={x} y={y} width="13" height="13" fill="#0f172a" />))}
          <rect x="275" y="260" width="13" height="13" fill="#0f172a" />
          <circle cx="258" cy="169" r="16" fill="#fff7ed" opacity="0.18" />
          <text x="258" y="173" textAnchor="middle" fill="#fff7ed" fontSize="9" fontWeight="900">VIP</text>
        </g>
      ) : null}

      <g className="demo-lab-open-burst" transform="translate(180 196)">
        <circle cx="0" cy="0" r="44" fill="none" stroke={accent} strokeWidth="3" />
        <path d="M0-72v-28M51-51l20-20M72 0h30M51 51l20 20M0 72v28M-51 51l-20 20M-72 0h-30M-51-51l-20-20" stroke={accent} strokeWidth="5" strokeLinecap="round" />
      </g>

      <g className="demo-lab-nfc-seal" transform="translate(180 188) rotate(-7)">
        <rect x="-136" y="-42" width="272" height="84" rx="25" fill="#020617" opacity="0.34" filter={`url(#${uid}-glow)`} />
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
  const passport = beat === 0 ? "antes de cadena" : beat === 2 ? "bloqueado" : beat === 3 ? "abierto" : "listo";
  const marketplace = beat === 2 ? "bloqueada" : beat === 0 ? "pendiente" : "lista";

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
        <InfoCell label="Pasaporte" value={passport} />
        <InfoCell label="Garantia" value={beat === 2 ? "bloqueada" : txt.controls.warranty} />
        <InfoCell label="Tienda" value={marketplace} />
      </div>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}

function DemoFlowRail({ scenario, beat, onOpen }: { scenario: DemoScenario; beat: Beat; onOpen: (view: DemoModalView) => void }) {
  const riskCopy = beat === 2 ? "Bloqueado por copia" : "Listo para continuar";
  const items: Array<{ view: Exclude<DemoModalView, null>; eyebrow: string; title: string; body: string; tone: string }> = [
    { view: "mobile", eyebrow: scenario.stateLabel, title: "Resultado en celular", body: riskCopy, tone: scenario.tone },
    { view: "nft", eyebrow: "Polygon Amoy", title: "NFT / certificado", body: beat === 2 ? "No crea NFT si hay copia" : "Solicitud + tx_hash + token_id", tone: "nft" },
    { view: "claim", eyebrow: "Portal usuario", title: "Reclamar dueño", body: "Ingreso, marca y dueño", tone: "claim" },
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

  const title = view === "mobile" ? "Resultado en celular" : view === "nft" ? "NFT / certificado Polygon" : "Reclamar dueño";
  const subtitle = view === "mobile"
    ? "Lo que ve el consumidor despues del toque."
    : view === "nft"
      ? "Como se conecta el toque valido con tokenizacion y evidencia en cadena."
      : "Como el consumidor pasa de autenticar a asociar el producto en el portal.";

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
          <button suppressHydrationWarning type="button" onClick={() => onOpen("mobile")} className={view === "mobile" ? "active" : ""}>Celular</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("nft")} className={view === "nft" ? "active" : ""}>NFT</button>
          <button suppressHydrationWarning type="button" onClick={() => onOpen("claim")} className={view === "claim" ? "active" : ""}>Reclamo</button>
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
    { label: "01", title: "Toque valido", body: blocked ? "Copia detectada: no se firma en cadena." : "SUN fresco confirma autenticidad y crea evento." },
    { label: "02", title: "UID hasheado", body: "El UID no se expone crudo; se usa hash con salt para el certificado." },
    { label: "03", title: "Solicitud", body: blocked ? "La solicitud queda bloqueada por politica." : "Se prepara solicitud idempotente de tokenizacion." },
    { label: "04", title: "Polygon Amoy", body: blocked ? "Sin tx_hash/token_id hasta nuevo toque valido." : "La creacion del NFT devuelve tx_hash y token_id para trazabilidad." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Tokenizacion bloqueada por seguridad" : "Auto-tokenizacion lista para toque valido"}</strong>
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
    { label: "Ingreso", body: "El consumidor entra al portal con sesion propia." },
    { label: "Marca", body: "El reclamo valida que producto, marca y evento coincidan." },
    { label: "Dueño", body: blocked ? "La copia bloquea el reclamo hasta nuevo toque fisico." : "El producto queda asociado al usuario." },
    { label: "Tienda", body: blocked ? "Beneficios de valor bloqueados." : "Se habilitan club, garantia, recompra y beneficios." },
  ];
  return (
    <div className="demo-lab-modal-story">
      <div className={`demo-lab-modal-status demo-lab-modal-status--${scenario.tone}`}>
        <span>{scenario.stateLabel}</span>
        <strong>{blocked ? "Reclamo bloqueado correctamente" : "Reclamo listo con politica de dueño"}</strong>
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
    { step: "01", title: "Toque fisico fresco", body: "El chip genera SUN dinamico. No sirve URL copiada." },
    { step: "02", title: "Anti copia + pasaporte", body: "Si es valido, se habilitan acciones y queda evento." },
    { step: "03", title: "NFT / certificado", body: "Se crea solicitud y Polygon devuelve tx_hash + token_id." },
    { step: "04", title: "Reclamar dueño", body: "El usuario asocia producto con ingreso, marca y politica de dueño." },
  ];

  return (
    <section className="demo-lab-final-dock mt-5 rounded-3xl border p-4 md:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Lista antes del toque final</p>
          <h2 className="mt-2 text-2xl font-black text-white md:text-3xl">Probar el camino real: toque valido - NFT - reclamar dueño.</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{status}</p>
        </div>
        <div className="demo-lab-final-actions">
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onValid} className="demo-lab-final-button demo-lab-final-button--primary">
            Simular toque valido
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onReplay} className="demo-lab-final-button demo-lab-final-button--danger">
            Probar copia bloqueada
          </button>
          <button suppressHydrationWarning type="button" disabled={simulating} onClick={onTamper} className="demo-lab-final-button demo-lab-final-button--warn">
            Sello abierto
          </button>
          <button suppressHydrationWarning type="button" onClick={onRefresh} className="demo-lab-final-button demo-lab-final-button--ghost">
            Actualizar servidor
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
  const routeCopy = locale === "en"
    ? {
      eyebrow: "Live route",
      title: "Origin to tap verified",
      distance: "Distance",
      origin: "Origin",
      tap: "Current tap",
      chain: "Proof chain",
      path: "Audited product route",
      pathBody: "One readable proof: product, UID, SUN, seal and channel policy.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Policy",
    }
    : locale === "pt-BR"
    ? {
      eyebrow: "Rota viva",
      title: "Origem e toque verificados",
      distance: "Distancia",
      origin: "Origem",
      tap: "Toque atual",
      chain: "Cadeia de prova",
      path: "Rota auditada do produto",
      pathBody: "Uma prova legivel: produto, UID, SUN, lacre e politica do canal.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Politica",
    }
    : {
      eyebrow: "Ruta viva",
      title: "Origen y toque verificados",
      distance: "Distancia",
      origin: "Origen",
      tap: "Toque actual",
      chain: "Cadena de prueba",
      path: "Ruta auditada del producto",
      pathBody: "Una prueba legible: producto, UID, SUN, sello y politica de canal.",
      checkpointA: "UID",
      checkpointB: "SUN",
      checkpointC: "Politica",
    };
  const proofStrip = [
    { label: txt.controls.origin, value: LOCATIONS.origin.city },
    { label: txt.controls.currentTap, value: destination.city },
    { label: "SUN", value: scenario.tone === "risk" ? "bloqueado" : "valido" },
    { label: routeCopy.checkpointC, value: scenario.stateLabel },
  ];

  return (
    <div className={`demo-lab-stage-route-layer demo-lab-stage-route-layer--${scenario.tone}`} aria-hidden="true">
      <div className="demo-lab-route-backdrop">
        <svg className="demo-lab-route-diagram" viewBox="0 0 720 360" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="demo-lab-route-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="48%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor={scenario.tone === "risk" ? "#fb7185" : scenario.tone === "open" ? "#a78bfa" : "#60a5fa"} />
            </linearGradient>
            <radialGradient id="demo-lab-route-radar" cx="50%" cy="50%" r="58%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.22" />
              <stop offset="64%" stopColor="#22d3ee" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#020617" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="0" width="720" height="360" rx="26" fill="url(#demo-lab-route-radar)" />
          <path className="demo-lab-route-diagram__grid" d="M92 56 H640 M92 118 H640 M92 180 H640 M92 242 H640 M92 304 H640 M128 34 V328 M248 34 V328 M368 34 V328 M488 34 V328 M608 34 V328" />
          <path className="demo-lab-route-diagram__ghost" d="M116 246 C214 112 318 98 402 176 C484 252 566 210 632 90" />
          <path className="demo-lab-route-diagram__line" d="M116 246 C214 112 318 98 402 176 C484 252 566 210 632 90" />
          <g className="demo-lab-route-diagram__node demo-lab-route-diagram__node--origin" transform="translate(116 246)">
            <circle r="33" />
            <circle r="11" />
          </g>
          <g className={`demo-lab-route-diagram__node demo-lab-route-diagram__node--tap demo-lab-route-diagram__node--${scenario.tone}`} transform="translate(632 90)">
            <circle r="38" />
            <circle r="13" />
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(264 125)">
            <rect x="-36" y="-18" width="72" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointA}</text>
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(410 181)">
            <rect x="-38" y="-18" width="76" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointB}</text>
          </g>
          <g className="demo-lab-route-diagram__checkpoint" transform="translate(538 198)">
            <rect x="-48" y="-18" width="96" height="36" rx="14" />
            <text textAnchor="middle" y="5">{routeCopy.checkpointC}</text>
          </g>
        </svg>
      </div>
      <div className="demo-lab-route-command">
        <small>{routeCopy.eyebrow}</small>
        <strong>{routeCopy.title}</strong>
        <span>{LOCATIONS.origin.city}{" -> "}{destination.city}</span>
      </div>
      <div className="demo-lab-route-summary">
        <span>
          <small>{routeCopy.distance}</small>
          <strong>{routeKm.toLocaleString(locale)} km</strong>
        </span>
        <span>
          <small>{routeCopy.tap}</small>
          <strong>{destination.city}</strong>
        </span>
        <span>
          <small>Estado</small>
          <strong>{scenario.stateLabel}</strong>
        </span>
      </div>
      <div className="demo-lab-route-proof-strip">
        {proofStrip.map((item) => (
          <span key={item.label}>
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </span>
        ))}
      </div>
      <div className="demo-lab-route-path-card">
        <small>{routeCopy.path}</small>
        <strong>{LOCATIONS.origin.city} - {destination.city}</strong>
        <span>{routeCopy.pathBody}</span>
      </div>
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
    { id: "join", label: txt.controls.joinClub, body: "Asocia al consumidor con club, beneficios y tienda de la marca.", locked: beat === 0 || beat === 2 },
    { id: "warranty", label: txt.controls.warranty, body: "Registra garantia, postventa o fecha de apertura con politica de la marca.", locked: beat === 0 || beat === 2 },
    { id: "tokenize", label: txt.controls.tokenize, body: "Prepara solicitud Polygon con UID hasheado y prueba de dueño.", locked: beat === 0 || beat === 2 },
    { id: "report", label: "Reportar riesgo", body: "Crea alerta operativa cuando aparece copia, duplicado o manipulacion sospechosa.", locked: beat !== 2 },
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
        <InfoCell label="Estado" value={status} />
        <InfoCell label="Marca" value={DEMO_TENANT_SLUG} />
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Ruta activa: {LOCATIONS.origin.city} -&gt; {destination.city}. Los botones cambian de politica segun estado fisico, copia y compra/reclamo.
      </p>
      {actionMessage ? <p className="demo-lab-action-message mt-4 rounded-xl border border-emerald-300/25 bg-emerald-500/10 px-3 py-3 text-xs font-bold text-emerald-100">{actionMessage}</p> : null}
    </article>
  );
}
