"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@product/config";
import { PremiumVectorMap, Globe3dMap } from "@product/ui";
import { platformVerticals, type PlatformDemoVertical, type PlatformVertical } from "../lib/platform-verticals";

type Vertical = "wine" | "events" | "cosmetics" | "agro" | "fashion";
type HeroSelectorKey = PlatformDemoVertical;

const HeroThreeStage = dynamic(() => import("./hero-three-stage").then((mod) => mod.HeroThreeStage), {
  ssr: false,
});

const heroSceneFallbackByDemoVertical: Record<HeroSelectorKey, Vertical> = {
  wine: "wine",
  bracelet: "events",
  pharma: "cosmetics",
  perfume: "cosmetics",
  seeds: "agro",
  sneaker: "fashion",
  logistics: "agro",
  electronics: "fashion",
  textile: "fashion",
};

function verticalLabel(item: PlatformVertical, locale: AppLocale) {
  if (locale === "en") return item.titleEn;
  if (locale === "pt-BR") return item.titlePt;
  return item.title;
}

type LocationPoint = {
  city: string;
  country: string;
  label: string;
  lat: number;
  lng: number;
};

type Scene = {
  label: string;
  profile: string;
  action: string;
  result: string;
  product: string;
  batch: string;
  uid: string;
  origin: LocationPoint;
  security: string;
  nextAction: string;
  marketplace: string;
  loyalty: string;
  businessValue: string;
  objectClass: string;
  phoneTag: string;
  steps: string[];
};

const tapLocations: LocationPoint[] = [
  { city: "Buenos Aires", country: "Argentina", label: "miembro del club", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", label: "comprador en tienda", lat: -33.4489, lng: -70.6693 },
  { city: "Sao Paulo", country: "Brasil", label: "demo de distribuidor", lat: -23.5558, lng: -46.6396 },
  { city: "Miami", country: "Estados Unidos", label: "distribuidor de exportacion", lat: 25.7617, lng: -80.1918 },
  { city: "Zurich", country: "Suiza", label: "coleccionista premium", lat: 47.3769, lng: 8.5417 },
  { city: "Cordoba", country: "Argentina", label: "ingreso de evento", lat: -31.4201, lng: -64.1888 },
];

const labels: Record<AppLocale, {
  selectorTitle: string;
  microcopy: string;
  commercialRail: string;
  valuePills: string[];
  ctaBands: string[];
  phoneLabel: string;
  swapTap: string;
  liveTap: string;
  whatHappened: string;
  routeTitle: string;
  originMap: string;
  tapMap: string;
  openOriginMap: string;
  custody: string;
  assetBank: string;
  realAsset: string;
  renderFallback: string;
  evidenceChart: string;
  labels: {
    product: string;
    origin: string;
    tap: string;
    distance: string;
    uid: string;
    batch: string;
    security: string;
    nextAction: string;
    marketplace: string;
    loyalty: string;
      businessValue: string;
  };
  metrics: {
    authenticity: string;
    traceability: string;
    commercial: string;
  };
  items: Record<Vertical, Scene>;
}> = {
  "es-AR": {
    selectorTitle: "Elegi vertical",
    microcopy: "Cada toque convierte seguridad en relacion: prueba de origen, club, garantia, puntos, recompra y tienda contextual para la marca.",
    commercialRail: "Capa comercial que se activa despues del toque",
    valuePills: ["Club VIP", "Puntos", "Garantia", "Dato para CRM", "Tienda", "Token opcional"],
    ctaBands: ["Bodegas", "Eventos", "Cosmetica", "Agro", "Moda", "Salud"],
    phoneLabel: "Salida celular",
    swapTap: "Cambiar toque",
    liveTap: "Toque simulado",
    whatHappened: "Que esta pasando",
    routeTitle: "Ruta de confianza",
    originMap: "Origen",
    tapMap: "Toque",
    openOriginMap: "Ver origen en Maps",
    custody: "Origen, distancia y accion quedan unidos al evento.",
    assetBank: "Banco visual",
    realAsset: "Foto real",
    renderFallback: "Render interactivo",
    evidenceChart: "Evidencia del toque",
    labels: {
      product: "Producto",
      origin: "Origen",
      tap: "Toque actual",
      distance: "Distancia",
      uid: "UID",
      batch: "Lote",
      security: "Seguridad",
      nextAction: "Siguiente accion",
      marketplace: "Tienda",
      loyalty: "Beneficios",
      businessValue: "Valor para marca",
    },
    metrics: {
      authenticity: "Autenticidad",
      traceability: "Trazabilidad",
      commercial: "Post-tap",
    },
    items: {
      wine: {
        label: "Vino",
        profile: "NTAG 424 DNA TT",
        action: "Descorche o sello abierto: la etiqueta cambia estado y el SUN valida el toque.",
        result: "Autentico, sello abierto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "bodega", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinamico + sello fisico + anti copia",
        nextAction: "Club, garantia, reclamo de dueño o token premium",
        marketplace: "Voucher post-compra + trazabilidad de coleccion",
        loyalty: "320 pts, club de cosecha, voucher y recompra premium",
        businessValue: "CRM post-toque + tienda + tokenizacion opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "VINO - AUT_OK",
        steps: ["Se lee UID fisico", "SUN evita copia", "El sello queda abierto", "Se abre club y tienda"],
      },
      events: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulsera VIP escaneada en puerta: UID serializado y regla del servidor.",
        result: "Acceso VIP aprobado",
        product: "Pulsera VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + estado de acceso + bloqueo de reingreso",
        nextAction: "Beneficio backstage o mejora de entrada",
        marketplace: "Promos de barra, merch y reventa controlada",
        loyalty: "Puntos por asistencia, mejoras y merch",
        businessValue: "Control de acceso + datos de audiencia + ingresos post-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENTO - INGRESO_OK",
        steps: ["Toque en ingreso", "Servidor valida UID", "Marca ingreso", "Activa beneficio"],
      },
      cosmetics: {
        label: "Cosmetica",
        profile: "NTAG 424 DNA",
        action: "Tapa o sello validado: el producto demuestra lote, origen y garantia.",
        result: "Producto genuino",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "SUN dinamico + lote + garantia",
        nextAction: "Registro de garantia y recompra",
        marketplace: "Venta cruzada, muestras y beneficios",
        loyalty: "Garantia, muestras y recompra",
        businessValue: "Antifalsificacion + datos propios + venta cruzada",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Toque en tapa", "SUN verifica autenticidad", "Muestra lote", "Activa garantia"],
      },
      agro: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Bolsa abierta en campo: lote, ficha tecnica y custodia visibles.",
        result: "Lote y origen verificados",
        product: "Semilla premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + trazabilidad logistica",
        nextAction: "Ficha tecnica, soporte y reclamo",
        marketplace: "Reposicion, asesor tecnico y cupon rural",
        loyalty: "Soporte tecnico, reposicion y beneficios por lote",
        businessValue: "Trazabilidad + asistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Lectura en campo", "Lote confirmado", "Origen visible", "Soporte activo"],
      },
      fashion: {
        label: "Zapatillas",
        profile: "NTAG 424 DNA",
        action: "Zapatilla coleccionable verificada: UID, rareza, dueno y beneficio quedan unidos al toque.",
        result: "Autenticada con dueno",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "SUN dinamico + UID + reclamo de dueno",
        nextAction: "Verificar dueno, garantia, reventa o token premium",
        marketplace: "Drop exclusivo, reventa controlada y beneficios de comunidad",
        loyalty: "Acceso a drops, puntos y certificado de coleccion",
        businessValue: "Anti copia + ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Toque en lengueta", "SUN valida pieza", "Rareza visible", "Dueno/token habilitado"],
      },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Cada toque transforma seguranca em relacionamento: prova de origem, clube, garantia, pontos, recompra e marketplace contextual para a marca.",
    commercialRail: "Camada comercial ativada depois do toque",
    valuePills: ["Clube VIP", "Pontos", "Garantia", "CRM lead", "Marketplace", "Token opcional"],
    ctaBands: ["Vinhos", "Eventos", "Cosmeticos", "Agro", "Moda", "Pharma"],
    phoneLabel: "Saida mobile",
    swapTap: "Trocar toque",
    liveTap: "Toque simulado",
    whatHappened: "O que acontece",
    routeTitle: "Rota de confianca",
    originMap: "Origem",
    tapMap: "Toque",
    openOriginMap: "Ver origem no Maps",
    custody: "Origem, distancia e acao ficam ligados ao evento.",
    assetBank: "Banco visual",
    realAsset: "Foto real",
    renderFallback: "Render interativo",
    evidenceChart: "Evidencia do toque",
    labels: {
      product: "Produto",
      origin: "Origem",
      tap: "Toque atual",
      distance: "Distancia",
      uid: "UID",
      batch: "Lote",
      security: "Seguranca",
      nextAction: "Proxima acao",
      marketplace: "Marketplace",
      loyalty: "Loyalty",
      businessValue: "Valor empresa",
    },
    metrics: {
      authenticity: "Autenticidade",
      traceability: "Rastreabilidade",
      commercial: "Pos-toque",
    },
    items: {
      wine: {
        label: "Vinho",
        profile: "NTAG 424 DNA TT",
        action: "Rolha ou lacre aberto: o tamper muda estado e o SUN valida o toque.",
        result: "Autentico, lacre aberto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "vinicola", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinamico + tamper fisico + anti-replay",
        nextAction: "Clube, garantia, dono ou token premium",
        marketplace: "Voucher pos-compra + rastreabilidade de colecao",
        loyalty: "320 pts, clube de safra, voucher e recompra premium",
        businessValue: "CRM pos-toque + marketplace + tokenizacao opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - AUTH_OK",
        steps: ["Leitura de UID fisico", "SUN reduz replay", "Lacre muda para OPENED", "Clube e marketplace abrem"],
      },
      events: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulseira VIP escaneada na porta: UID serializado e regra server-side.",
        result: "Acesso VIP aprovado",
        product: "Pulseira VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + estado de acesso + bloqueio duplicado",
        nextAction: "Beneficio backstage ou upgrade",
        marketplace: "Promos, merch e revenda controlada",
        loyalty: "Pontos por presenca, upgrades e merch",
        businessValue: "Controle de acesso + dados de audiencia + receita pos-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ENTRY_OK",
        steps: ["Toque na entrada", "Backend valida UID", "Marca check-in", "Ativa beneficio"],
      },
      cosmetics: {
        label: "Cosmeticos",
        profile: "NTAG 424 DNA",
        action: "Tampa ou lacre validado: o produto mostra lote, origem e garantia.",
        result: "Produto genuino",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "SUN dinamico + lote + garantia",
        nextAction: "Registro de garantia e recompra",
        marketplace: "Cross-sell, amostras e loyalty",
        loyalty: "Garantia, amostras e recompra",
        businessValue: "Antifalsificacao + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Toque na tampa", "SUN verifica", "Lote aparece", "Garantia ativa"],
      },
      agro: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Saco aberto no campo: lote, ficha tecnica e custodia visiveis.",
        result: "Lote e origem verificados",
        product: "Semente premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + rastreabilidade logistica",
        nextAction: "Ficha tecnica, suporte e reclamo",
        marketplace: "Reposicao, tecnico e cupom rural",
        loyalty: "Suporte tecnico, reposicao e beneficios por lote",
        businessValue: "Rastreabilidade + assistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Scan no campo", "Lote confirmado", "Origem visivel", "Suporte ativo"],
      },
      fashion: {
        label: "Tenis",
        profile: "NTAG 424 DNA",
        action: "Tenis colecionavel verificado: UID, raridade, dono e beneficio ficam ligados ao toque.",
        result: "Autenticado com dono",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "SUN dinamico + UID + claim de dono",
        nextAction: "Verificar dono, garantia, revenda ou token premium",
        marketplace: "Drop exclusivo, revenda controlada e beneficios de comunidade",
        loyalty: "Acesso a drops, pontos e certificado de colecao",
        businessValue: "Anti copia + ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Toque na lingueta", "SUN valida peca", "Raridade visivel", "Dono/token habilitado"],
      },
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "Every tap turns security into relationship: origin proof, club, warranty, points, reorder and a contextual marketplace for the brand.",
    commercialRail: "Commercial layer unlocked after the tap",
    valuePills: ["VIP club", "Points", "Warranty", "CRM lead", "Marketplace", "Optional token"],
    ctaBands: ["Wineries", "Events", "Cosmetics", "Agro", "Fashion", "Pharma"],
    phoneLabel: "Mobile output",
    swapTap: "Change tap",
    liveTap: "Simulated tap",
    whatHappened: "What happens",
    routeTitle: "Trust route",
    originMap: "Origin",
    tapMap: "Tap",
    openOriginMap: "Open origin map",
    custody: "Origin, distance and physical action are attached to the event.",
    assetBank: "Visual bank",
    realAsset: "Real photo",
    renderFallback: "Interactive render",
    evidenceChart: "Tap evidence",
    labels: {
      product: "Product",
      origin: "Origin",
      tap: "Current tap",
      distance: "Distance",
      uid: "UID",
      batch: "Batch",
      security: "Security",
      nextAction: "Next action",
      marketplace: "Marketplace",
      loyalty: "Loyalty",
      businessValue: "Business value",
    },
    metrics: {
      authenticity: "Authenticity",
      traceability: "Traceability",
      commercial: "Post-tap",
    },
    items: {
      wine: {
        label: "Wine",
        profile: "NTAG 424 DNA TT",
        action: "Uncork or seal break: tamper changes state and SUN validates the tap.",
        result: "Authentic, opened seal",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Uco Valley", country: "Argentina", label: "winery", lat: -33.6131, lng: -69.2075 },
        security: "Dynamic SUN + physical tamper + anti-replay",
        nextAction: "Club, warranty, ownership or premium token",
        marketplace: "Post-purchase voucher + collectible provenance",
        loyalty: "320 pts, harvest club, voucher and premium reorder",
        businessValue: "Post-tap CRM + marketplace + optional tokenization",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - AUTH_OK",
        steps: ["Reads physical UID", "SUN blocks replay", "Seal becomes OPENED", "Club and marketplace open"],
      },
      events: {
        label: "Events",
        profile: "NTAG215",
        action: "VIP wristband scanned at gate: serialized UID and server-side rule.",
        result: "VIP access granted",
        product: "VIP wristband",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + access state + duplicate entry block",
        nextAction: "Backstage perk or ticket upgrade",
        marketplace: "Bar promos, merch and controlled resale",
        loyalty: "Attendance points, upgrades and merch",
        businessValue: "Access control + audience data + post-event revenue",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ENTRY_OK",
        steps: ["Tap at access", "Backend validates UID", "Check-in is written", "Benefit is unlocked"],
      },
      cosmetics: {
        label: "Cosmetics",
        profile: "NTAG 424 DNA",
        action: "Cap or seal validated: the product proves batch, origin and warranty.",
        result: "Genuine product",
        product: "Premium serum",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "lab", lat: -33.4489, lng: -70.6693 },
        security: "Dynamic SUN + batch + warranty",
        nextAction: "Warranty registration and reorder",
        marketplace: "Cross-sell, samples and loyalty",
        loyalty: "Warranty, samples and reorder",
        businessValue: "Anti-counterfeit + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Tap on cap", "SUN proves authenticity", "Batch appears", "Warranty opens"],
      },
      agro: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Bag opened in field: lot, technical sheet and custody become visible.",
        result: "Lot and origin verified",
        product: "Premium seed",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "plant", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + logistics traceability",
        nextAction: "Technical sheet, support and claim flow",
        marketplace: "Reorder, agronomist support and rural coupon",
        loyalty: "Technical support, reorder and lot benefits",
        businessValue: "Traceability + support + rural channel",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Field scan", "Lot is confirmed", "Origin is visible", "Support opens"],
      },
      fashion: {
        label: "Sneakers",
        profile: "NTAG 424 DNA",
        action: "Collectible sneaker verified: UID, rarity, owner and benefits stay attached to the tap.",
        result: "Authenticated owner",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "Dynamic SUN + UID + ownership claim",
        nextAction: "Verify owner, warranty, resale or premium token",
        marketplace: "Exclusive drop, controlled resale and community benefits",
        loyalty: "Drop access, points and collector certificate",
        businessValue: "Anti-copy + ownership + resale channel",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Tap on tongue", "SUN validates item", "Rarity visible", "Owner/token enabled"],
      },
    },
  },
};

function haversineKm(a: LocationPoint, b: LocationPoint) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const radiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radiusKm * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function localeName(locale: AppLocale) {
  if (locale === "pt-BR") return "pt-BR";
  if (locale === "en") return "en-US";
  return "es-AR";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const HERO_MAP_WIDTH = 1200;
const HERO_MAP_HEIGHT = 620;

function projectMercator(point: LocationPoint) {
  const x = ((point.lng + 180) / 360) * HERO_MAP_WIDTH;
  const clippedLat = Math.max(-85.05112878, Math.min(85.05112878, point.lat));
  const sin = Math.sin((clippedLat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * HERO_MAP_HEIGHT;
  return { x, y };
}

function traceViewBox(origin: LocationPoint, tap: LocationPoint) {
  const coords = [projectMercator(origin), projectMercator(tap)];
  const minX = Math.min(...coords.map((coord) => coord.x));
  const maxX = Math.max(...coords.map((coord) => coord.x));
  const minY = Math.min(...coords.map((coord) => coord.y));
  const maxY = Math.max(...coords.map((coord) => coord.y));
  const width = Math.min(HERO_MAP_WIDTH, Math.max(150, Math.max(1, maxX - minX) * 4.2));
  const height = Math.min(HERO_MAP_HEIGHT, Math.max(116, Math.max(1, maxY - minY) * 4.8));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  return {
    x: clamp(centerX - width / 2, 0, HERO_MAP_WIDTH - width),
    y: clamp(centerY - height / 2, 0, HERO_MAP_HEIGHT - height),
    width,
    height,
  };
}

function projectMapPoint(point: LocationPoint, origin: LocationPoint, tap: LocationPoint) {
  const box = traceViewBox(origin, tap);
  const projected = projectMercator(point);
  const x = ((projected.x - box.x) / box.width) * 100;
  const y = ((projected.y - box.y) / box.height) * 100;
  return { x: clamp(x, 8, 92), y: clamp(y, 13, 84) };
}

function mapsHref(point: LocationPoint) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.lat},${point.lng}`)}`;
}

function HeroTraceMap({
  origin,
  tap,
  distance,
  numberLocale,
  txt,
}: {
  origin: LocationPoint;
  tap: LocationPoint;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "routeTitle" | "originMap" | "tapMap" | "openOriginMap" | "custody">;
}) {
  const originPoint = projectMapPoint(origin, origin, tap);
  const tapPoint = projectMapPoint(tap, origin, tap);
  const pinDistance = Math.hypot(originPoint.x - tapPoint.x, originPoint.y - tapPoint.y);
  const pinsOverlap = pinDistance < 18;
  const originPinPoint = pinsOverlap
    ? { x: clamp(originPoint.x - 14, 14, 74), y: clamp(originPoint.y + 12, 26, 76) }
    : originPoint;
  const tapPinPoint = pinsOverlap
    ? { x: clamp(tapPoint.x + 14, 26, 86), y: clamp(tapPoint.y - 12, 22, 72) }
    : tapPoint;
  const formattedDistance = distance.toLocaleString(numberLocale);
  const routeHeadline = txt.routeTitle === "Trust route" ? "Live route" : txt.routeTitle.startsWith("Rota") ? "Rota viva" : "Ruta viva";
  const tapCopy = txt.routeTitle === "Trust route" ? "Physical tap" : txt.routeTitle.startsWith("Rota") ? "Toque fisico" : "Tap fisico";
  const distanceCopy = txt.routeTitle === "Trust route" ? "Distance" : txt.routeTitle.startsWith("Rota") ? "Distancia" : "Distancia";
  const evidenceCopy = txt.routeTitle === "Trust route"
    ? `${formattedDistance} km with physical tap, SUN and channel evidence.`
    : txt.routeTitle.startsWith("Rota")
      ? `${formattedDistance} km com evidencia de toque, SUN e canal.`
      : `${formattedDistance} km con evidencia de toque fisico, SUN y canal.`;

  return (
    <div className="hero-trace-map hero-trace-map--clear" aria-label={txt.routeTitle}>
      <Globe3dMap
        offset={[0, 0]}
        points={[
          {
            city: origin.city,
            country: origin.country,
            lat: origin.lat,
            lng: origin.lng,
            scans: 1,
            status: "origin"
          },
          {
            city: tap.city,
            country: tap.country,
            lat: tap.lat,
            lng: tap.lng,
            scans: 1,
            status: "tap"
          }
        ]}
        routes={[{
          fromLat: origin.lat,
          fromLng: origin.lng,
          toLat: tap.lat,
          toLng: tap.lng,
          tone: "info"
        }]}
        width={420}
        height={320}
        className="border-0 bg-transparent shadow-none"
      />
      <div className="hero-map-intel">
        <p>{routeHeadline}</p>
        <strong>{origin.city} / {tap.city}</strong>
        <span>{evidenceCopy}</span>
      </div>
      <div className="hero-route-summary-card">
        <div className="hero-route-summary-grid">
          <span>
            <small>{txt.originMap}</small>
            <strong>{origin.city}</strong>
          </span>
          <span>
            <small>{tapCopy}</small>
            <strong>{tap.city}</strong>
          </span>
          <span>
            <small>{distanceCopy}</small>
            <strong>{formattedDistance} km</strong>
          </span>
        </div>
        <a className="hero-route-map-link" href={mapsHref(origin)} target="_blank" rel="noreferrer">
          {txt.openOriginMap}
        </a>
      </div>
    </div>
  );
}

const heroPrimeProducts: Record<Vertical, {
  kind: "wine" | "bracelet" | "perfume" | "seeds";
  seal: string;
  detail: string;
  accent: string;
}> = {
  wine: { kind: "wine", seal: "NFC TT", detail: "SUN OK", accent: "#22d3ee" },
  events: { kind: "bracelet", seal: "VIP", detail: "UID OK", accent: "#2dd4bf" },
  cosmetics: { kind: "perfume", seal: "AUTH", detail: "LOTE OK", accent: "#a78bfa" },
  agro: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#84cc16" },
  fashion: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#22d3ee" },
};

const heroRealAssets: Partial<Record<Vertical, {
  imageUrl: string;
  alt: string;
  bank: string;
  sourceLabel: string;
  sourceUrl: string;
}>> = {
  wine: {
    imageUrl: "/demo/wine-secure/real-malbec-bottle-pexels.jpg",
    alt: "Botella real de vino Malbec con copa, usada como asset demo del banco visual.",
    bank: "Pexels",
    sourceLabel: "Pexels / Imperio Ame",
    sourceUrl: "https://www.pexels.com/photo/close-up-photo-of-a-bottle-of-wine-15063487/",
  },
  events: {
    imageUrl: "/demo/events-basic/real-event-wristband-pexels.jpg",
    alt: "Brazalete real de festival en una muneca, usado como asset demo del banco visual.",
    bank: "Pexels",
    sourceLabel: "Pexels / freestocks.org",
    sourceUrl: "https://www.pexels.com/photo/woman-holding-black-steel-pole-during-daytime-119788/",
  },
  cosmetics: {
    imageUrl: "/demo/cosmetics-secure/real-cosmetic-bottles-pexels.jpg",
    alt: "Botellas reales de cosmetica premium, usadas como asset demo del banco visual.",
    bank: "Pexels",
    sourceLabel: "Pexels / Daria Liudnaya",
    sourceUrl: "https://www.pexels.com/photo/blank-perfume-bottles-8166611/",
  },
  agro: {
    imageUrl: "/demo/agro-secure/real-seed-packet-pexels.jpg",
    alt: "Paquete real de semillas siendo usado en campo, asset demo para trazabilidad agro.",
    bank: "Pexels",
    sourceLabel: "Pexels / RDNE Stock project",
    sourceUrl: "https://www.pexels.com/photo/person-catching-seeds-from-a-packet-7782889/",
  },
  fashion: {
    imageUrl: "/demo/luxury-basic/real-premium-sneakers-neutral-pexels.jpg",
    alt: "Zapatillas reales usadas como asset demo para autenticidad, ownership y reventa controlada.",
    bank: "Pexels",
    sourceLabel: "Pexels / Jibarofoto",
    sourceUrl: "https://www.pexels.com/photo/14212621/",
  },
};

function HeroPrimeProduct({ active, product }: { active: Vertical; product: string }) {
  const spec = heroPrimeProducts[active];
  const uid = `hero-prime-${active}`;
  const productLine = product.length > 22 ? `${product.slice(0, 20)}...` : product;

  return (
    <svg className={`hero-prime-product hero-prime-product--${spec.kind}`} viewBox="0 0 360 420" aria-hidden="true" focusable="false">
      <defs>
        <filter id={`${uid}-shadow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="20" stdDeviation="18" floodColor="#020617" floodOpacity="0.5" />
        </filter>
        <filter id={`${uid}-glow`} x="-35%" y="-35%" width="170%" height="170%">
          <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor={spec.accent} floodOpacity="0.38" />
        </filter>
        <linearGradient id={`${uid}-holo`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="48%" stopColor="#a78bfa" stopOpacity="0.86" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id={`${uid}-glass`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" stopOpacity="0.9" />
          <stop offset="48%" stopColor="#67e8f9" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#4c1d95" stopOpacity="0.82" />
        </linearGradient>
        <linearGradient id={`${uid}-metal`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="46%" stopColor="#94a3b8" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id={`${uid}-paper`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="58%" stopColor="#e0f2fe" />
          <stop offset="100%" stopColor="#c7d2fe" />
        </linearGradient>
        <radialGradient id={`${uid}-floor`} cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor={spec.accent} stopOpacity="0.36" />
          <stop offset="64%" stopColor="#0f172a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#020617" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="180" cy="366" rx="142" ry="32" fill={`url(#${uid}-floor)`} />
      <path d="M48 338 C110 312 248 314 312 340 L270 375 C218 392 134 392 90 374 Z" fill="#020617" opacity="0.34" />
      <path d="M76 348 C126 329 234 329 284 348" fill="none" stroke={spec.accent} strokeWidth="2" strokeLinecap="round" opacity="0.24" />
      <ellipse cx="180" cy="214" rx="156" ry="148" fill={spec.accent} opacity="0.06" />

      {spec.kind === "wine" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M158 35h44l7 60c2 15 13 25 25 35 13 12 20 29 20 51v139c0 30-20 50-50 50h-48c-30 0-50-20-50-50V181c0-22 7-39 20-51 12-10 23-20 25-35l7-60Z" fill="#7f1d1d" />
          <path d="M158 35h44l5 50h-54l5-50Z" fill="#f59e0b" />
          <path d="M140 119c15-15 28-22 40-22s25 7 40 22c-11 13-69 13-80 0Z" fill="#14532d" opacity="0.9" />
          <path d="M211 112c22 17 35 38 35 69v132c0 25-16 43-41 43h-16c19-23 22-68 22-135V112Z" fill="#020617" opacity="0.26" />
          <path d="M123 156c17-20 35-30 57-30 25 0 45 10 61 30v45H123v-45Z" fill="#450a0a" opacity="0.36" />
          <rect x="129" y="211" width="102" height="82" rx="11" fill={`url(#${uid}-paper)`} />
          <rect x="141" y="224" width="78" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.72" />
          <text x="180" y="252" textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="900" letterSpacing="2">GRAN RESERVA</text>
          <text x="180" y="271" textAnchor="middle" fill="#0f172a" fontSize="15" fontWeight="900" letterSpacing="2">MALBEC</text>
          <path d="M149 53c-13 48-17 116-14 205" fill="none" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.1" />
          <path d="M134 60c11-9 29-11 38-2 10 10 2 25-12 22-14-3-21-9-26-20Z" fill="#fde68a" opacity="0.54" />
        </g>
      ) : null}

      {spec.kind === "bracelet" ? (
        <g filter={`url(#${uid}-shadow)`} transform="rotate(-8 180 214)">
          <path d="M48 198c48-42 216-62 262-11 21 23 4 60-29 64-67 10-152 28-223-4-28-13-32-31-10-49Z" fill="#14b8a6" />
          <path d="M68 197c70 19 157 4 232 0 14 18 0 44-24 48-61 10-149 25-214-5-25-11-22-30 6-43Z" fill={`url(#${uid}-holo)`} opacity="0.66" />
          <path d="M63 217c72 23 156 12 230 4" fill="none" stroke="#ecfeff" strokeWidth="7" strokeLinecap="round" opacity="0.2" />
          <rect x="144" y="187" width="78" height="42" rx="10" fill="#0f172a" />
          <text x="183" y="215" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">VIP</text>
          {[83, 112, 141].map((cx) => <circle key={cx} cx={cx} cy="218" r="7" fill="#0f172a" opacity="0.74" />)}
          <circle cx="278" cy="205" r="21" fill="#c4b5fd" opacity="0.84" />
          <circle cx="278" cy="205" r="11" fill="#f8fafc" opacity="0.42" />
        </g>
      ) : null}

      {spec.kind === "perfume" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <rect x="153" y="48" width="54" height="46" rx="8" fill={`url(#${uid}-metal)`} />
          <rect x="140" y="28" width="80" height="29" rx="8" fill="#f8fafc" />
          <path d="M110 116c0-22 18-40 40-40h60c22 0 40 18 40 40v194c0 25-19 44-44 44h-52c-25 0-44-19-44-44V116Z" fill={`url(#${uid}-glass)`} />
          <path d="M211 82c24 8 39 26 39 53v174c0 25-19 45-44 45h-17c19-26 24-78 22-272Z" fill="#020617" opacity="0.16" />
          <path d="M126 139c0-20 17-37 37-37h34c21 0 38 17 38 37v160c0 15-12 28-28 28h-54c-16 0-27-13-27-28V139Z" fill="#312e81" opacity="0.32" />
          <rect x="131" y="193" width="98" height="76" rx="12" fill="transparent" stroke="#e0e7ff" strokeWidth="2" opacity="0.46" />
          <rect x="144" y="206" width="72" height="9" rx="5" fill={`url(#${uid}-holo)`} opacity="0.6" />
          <text x="180" y="238" textAnchor="middle" fill="#f8fafc" fontSize="14" fontWeight="900" letterSpacing="2">PERFUME</text>
          <text x="180" y="255" textAnchor="middle" fill="#e0e7ff" fontSize="8" fontWeight="900" letterSpacing="1.2">ORIGEN VALIDADO</text>
          <path d="M136 126c-12 61-9 135 8 194" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.18" />
        </g>
      ) : null}

      {spec.kind === "seeds" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M105 75h150c14 0 25 11 25 25v229c0 14-11 25-25 25H105c-14 0-25-11-25-25V100c0-14 11-25 25-25Z" fill="#84cc16" />
          <path d="M105 75h150c14 0 25 11 25 25v229c0 14-11 25-25 25H105c-14 0-25-11-25-25V100c0-14 11-25 25-25Z" fill={`url(#${uid}-holo)`} opacity="0.34" />
          <path d="M248 82c18 4 32 16 32 34v213c0 14-11 25-25 25h-25c14-27 18-80 18-162V82Z" fill="#14532d" opacity="0.2" />
          <rect x="100" y="105" width="160" height="52" rx="12" fill="#f0fdf4" />
          <text x="180" y="138" textAnchor="middle" fill="#166534" fontSize="13" fontWeight="900" letterSpacing="2">SEMILLAS</text>
          <rect x="119" y="170" width="122" height="34" rx="10" fill="#14532d" opacity="0.22" />
          <text x="180" y="192" textAnchor="middle" fill="#f0fdf4" fontSize="10" fontWeight="900" letterSpacing="1.6">TRAZA + ORIGEN</text>
          <path d="M109 289h142" stroke="#166534" strokeWidth="2" strokeDasharray="5 7" opacity="0.44" />
          <text x="180" y="317" textAnchor="middle" fill="#14532d" fontSize="13" fontWeight="900" letterSpacing="1.5">LOTE A12</text>
          {[132, 163, 197, 225].map((cx, index) => (
            <path key={cx} d={`M${cx} ${235 + (index % 2) * 14}c18-18 35-8 30 11-20 7-32 1-30-11Z`} fill="#facc15" opacity="0.84" />
          ))}
          <path d="M99 91h162" stroke="#ecfccb" strokeWidth="8" strokeLinecap="round" opacity="0.5" />
        </g>
      ) : null}

      <g className="hero-prime-product-seal" transform="translate(180 190) rotate(-7)">
        <rect x="-136" y="-42" width="272" height="84" rx="25" fill="#020617" opacity="0.38" filter={`url(#${uid}-glow)`} />
        <path d="M-104-32H0v64h-104c-12 0-22-10-22-22v-20c0-12 10-22 22-22Z" fill="#071827" stroke={spec.accent} strokeWidth="2" />
        <path d="M0-32h104c12 0 22 10 22 22v20c0 12-10 22-22 22H0v-64Z" fill="#071827" stroke={spec.accent} strokeWidth="2" />
        <path d="M-92-4c12-15 30-15 42 0M-84 8c8-9 18-9 26 0M-74 20c4-4 8-4 12 0" fill="none" stroke="#ecfeff" strokeWidth="4" strokeLinecap="round" opacity="0.84" />
        <text x="-38" y="-6" textAnchor="middle" fill="#ecfeff" fontSize="17" fontWeight="900" letterSpacing="2">NFC</text>
        <text x="-38" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.6">FISICO</text>
        <text x="58" y="-5" textAnchor="middle" fill="#ecfeff" fontSize="14" fontWeight="900" letterSpacing="1.8">{spec.seal}</text>
        <text x="58" y="15" textAnchor="middle" fill="#a5f3fc" fontSize="8" fontWeight="900" letterSpacing="1.4">{spec.detail}</text>
        <path d="M0-29v58" stroke="#ecfeff" strokeWidth="2" strokeDasharray="4 5" opacity="0.62" />
      </g>

      <g transform="translate(274 62)">
        <circle cx="0" cy="0" r="27" fill="#082f49" stroke={spec.accent} strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fill="#ecfeff" fontSize="12" fontWeight="900">NFC</text>
      </g>
      <text x="180" y="399" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">{productLine}</text>
    </svg>
  );
}

function HeroProductVisual({ active, product }: { active: Vertical; product: string }) {
  const [threeReady, setThreeReady] = useState(false);
  const threeActive = active === "fashion" ? "ticket" : active;

  return (
    <div className="hero-product-visual-shell">
      {!threeReady ? <HeroPrimeProduct active={active} product={product} /> : null}
      <HeroThreeStage key={active} active={threeActive} product={product} onReady={() => setThreeReady(true)} />
    </div>
  );
}

function trustMetricValues(active: Vertical, distance: number) {
  const distanceScore = clamp(Math.round(64 + Math.min(distance, 2200) / 42), 70, 96);
  if (active === "wine") return [98, distanceScore, 91];
  if (active === "events") return [86, 78, 84];
  if (active === "cosmetics") return [95, 82, 88];
  if (active === "fashion") return [96, 84, 93];
  return [81, 90, 82];
}

function HeroEvidenceChart({
  active,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "evidenceChart" | "metrics">;
}) {
  const values = trustMetricValues(active, distance);
  const metricLabels = [txt.metrics.authenticity, txt.metrics.traceability, txt.metrics.commercial];
  const polyline = values
    .map((value, index) => `${22 + index * 48},${92 - value * 0.62}`)
    .join(" ");

  return (
    <div className="hero-evidence-chart" aria-label={txt.evidenceChart}>
      <div className="hero-evidence-chart-head">
        <span>{txt.evidenceChart}</span>
        <strong>{distance.toLocaleString(numberLocale)} km</strong>
      </div>
      <svg viewBox="0 0 140 58" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`hero-evidence-line-${active}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="58%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <path d="M10 48H132M10 30H132M10 12H132" />
        <polyline points={polyline} />
        {values.map((value, index) => (
          <circle key={metricLabels[index]} cx={22 + index * 48} cy={92 - value * 0.62} r="3.1" />
        ))}
      </svg>
      <div className="hero-evidence-bars">
        {values.map((value, index) => (
          <div key={metricLabels[index]}>
            <span>{metricLabels[index]}</span>
            <em>
              <i style={{ width: `${value}%` }} />
            </em>
            <strong>{value}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroPassportPhone({
  active,
  data,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "phoneLabel" | "labels">;
}) {
  const asset = heroRealAssets[active];
  const actionLine = data.nextAction.length > 46 ? `${data.nextAction.slice(0, 44)}...` : data.nextAction;

  return (
    <div className={`hero-passport-phone hero-passport-phone--${active}`} aria-hidden="true">
      <span className="hero-passport-notch" />
      <div className="hero-passport-thumb">
        {asset ? <img src={asset.imageUrl} alt="" loading="eager" /> : <HeroProductVisual active={active} product={data.product} />}
      </div>
      <div className="hero-passport-body">
        <span>{txt.phoneLabel}</span>
        <strong>{data.product}</strong>
        <dl>
          <div>
            <dt>{txt.labels.uid}</dt>
            <dd>{data.uid}</dd>
          </div>
          <div>
            <dt>{txt.labels.distance}</dt>
            <dd>{distance.toLocaleString(numberLocale)} km</dd>
          </div>
        </dl>
        <p><i />{data.result}</p>
        <em>{actionLine}</em>
      </div>
    </div>
  );
}

function HeroProductShowcase({
  active,
  data,
  distance,
  numberLocale,
  txt,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "assetBank" | "realAsset" | "renderFallback" | "evidenceChart" | "metrics" | "phoneLabel" | "labels">;
}) {
  const asset = heroRealAssets[active];

  return (
    <div className={`hero-asset-showcase hero-asset-showcase--${active}`}>
      <div className="hero-asset-media">
        {asset ? (
          <div className="hero-asset-photo">
            <img className="hero-real-asset" src={asset.imageUrl} alt={asset.alt} loading="eager" />
            <span className="hero-asset-brand-mask" aria-hidden="true" />
            <span className="hero-asset-label-cover" aria-hidden="true">
              <em>nexID</em>
              <strong>{data.product}</strong>
              <small>{data.profile}</small>
            </span>
          </div>
        ) : (
          <div className="hero-asset-photo hero-asset-photo--fallback">
            <HeroProductVisual active={active} product={data.product} />
          </div>
        )}
        <span className="hero-asset-nfc">NFC</span>
        <span className="hero-asset-status">{data.profile}</span>
        <HeroPassportPhone active={active} data={data} distance={distance} numberLocale={numberLocale} txt={txt} />
      </div>
      <div className="hero-asset-copy">
        <span>{txt.assetBank} / {asset ? txt.realAsset : txt.renderFallback}</span>
        <strong>{data.product}</strong>
        <p>{data.batch} - {data.security}</p>
      </div>
      <HeroEvidenceChart active={active} distance={distance} numberLocale={numberLocale} txt={txt} />
    </div>
  );
}

export function HeroScene({ locale }: { locale: AppLocale }) {
  const [selectedVertical, setSelectedVertical] = useState<HeroSelectorKey>("wine");
  const [tapIndex, setTapIndex] = useState(0);
  const txt = labels[locale] || labels["es-AR"];
  const active = heroSceneFallbackByDemoVertical[selectedVertical] || "wine";
  const data = useMemo(() => txt.items[active], [txt, active]);
  const tap = tapLocations[tapIndex % tapLocations.length];
  const distance = haversineKm(data.origin, tap);
  const numberLocale = localeName(locale);

  useEffect(() => {
    setTapIndex(Math.floor(Math.random() * tapLocations.length));
  }, []);

  const proofRows = [
    { label: txt.labels.product, value: data.product },
    { label: txt.labels.origin, value: `${data.origin.city}, ${data.origin.country}` },
    { label: txt.labels.tap, value: `${tap.city}, ${tap.country} - ${tap.label}` },
    { label: txt.labels.distance, value: `${distance.toLocaleString(numberLocale)} km` },
    { label: txt.labels.uid, value: data.uid },
    { label: txt.labels.batch, value: data.batch },
    { label: txt.labels.security, value: data.security },
  ];
  const commerceRows = [
    { label: txt.labels.nextAction, value: data.nextAction },
    { label: txt.labels.marketplace, value: data.marketplace },
    { label: txt.labels.loyalty, value: data.loyalty },
    { label: txt.labels.businessValue, value: data.businessValue },
  ];

  return (
    <div>
      <div className="hero-scene rounded-2xl border border-white/10 p-4 md:p-5">
        <div className="hero-scene-topline flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] uppercase tracking-[0.16em] text-cyan-300">{txt.selectorTitle}</p>
          <button suppressHydrationWarning type="button" onClick={() => setTapIndex((current) => current + 1)} className="hero-scene-swap">
            {txt.swapTap}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {platformVerticals.map((item) => (
            <button
              suppressHydrationWarning
              key={item.id}
              type="button"
              onClick={() => setSelectedVertical(item.demoVertical)}
              className={`hero-vertical-pill ${selectedVertical === item.demoVertical ? "hero-vertical-pill--active" : ""}`}
              title={verticalLabel(item, locale)}
            >
              {item.shortTitle}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="hero-scene-stage-card rounded-xl border border-white/10 bg-slate-950/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="hero-scene-action text-xs font-semibold text-slate-200">{data.action}</p>
                <p className="mt-1 text-[11px] text-slate-400">{txt.liveTap}: {tap.city}, {tap.country}</p>
              </div>
              <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100">{data.profile}</span>
            </div>
            <div className={`hero-product-stage hero-product-stage--${active} mt-3`}>
              <div className="hero-object-frame hero-object-frame--split">
                <div className="hero-object-map-pane">
                  <HeroTraceMap origin={data.origin} tap={tap} distance={distance} numberLocale={numberLocale} txt={txt} />
                </div>
                <div className="hero-object-product-pane">
                  <HeroProductShowcase active={active} data={data} distance={distance} numberLocale={numberLocale} txt={txt} />
                </div>
              </div>
              <div className="hero-scene-phone">
                <span />
                <em>{data.phoneTag}</em>
                <strong>{data.result}</strong>
                <small>{tap.city} - {distance.toLocaleString(numberLocale)} km</small>
              </div>
            </div>
            <div className="hero-flow-steps mt-3">
              {data.steps.map((step, index) => (
                <div key={step} className="hero-flow-step">
                  <span>{index + 1}</span>
                  <p>{step}</p>
                </div>
              ))}
            </div>
            <div className="hero-commercial-rail mt-3">
              <span>{txt.commercialRail}</span>
              <div>
                {txt.valuePills.map((pill) => (
                  <em key={pill}>{pill}</em>
                ))}
              </div>
            </div>
          </div>

          <div className="hero-scene-result-card rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="hero-scene-result-label text-[11px] uppercase tracking-[0.14em] text-cyan-200">{txt.phoneLabel}</p>
            <p className="hero-scene-result-state mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{data.result}</p>
            <div className="hero-passport-summary mt-3">
              <span>{data.profile}</span>
              <strong>{data.product}</strong>
              <em>{tap.city} - {distance.toLocaleString(numberLocale)} km</em>
            </div>
            <div className="hero-output-grid hero-output-grid--proof mt-3">
              {proofRows.map((item) => (
                <div key={item.label} className="hero-output-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="hero-commerce-stack mt-3">
              {commerceRows.map((item) => (
                <article key={item.label} className="hero-commerce-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </article>
              ))}
            </div>
            <div className="hero-result-explain mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-300">{txt.whatHappened}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{data.action}</p>
            </div>
          </div>
        </div>

        <p className="hero-scene-microcopy mt-3 text-xs text-slate-300">{txt.microcopy}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {platformVerticals.map((item) => (
          <span key={item.id} className="hero-scene-band rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">
            {verticalLabel(item, locale)}
          </span>
        ))}
      </div>
    </div>
  );
}
