"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { AppLocale } from "@product/config";
import type { VectorMapLedgerItem, VectorMapPoint, VectorMapRoute } from "@product/ui";
import { CheckCircle2, Maximize2, X } from "lucide-react";
import { platformVerticals, traceabilityGlobePoints, traceabilityGlobeRoutes, type PlatformDemoVertical, type PlatformVertical } from "../lib/platform-verticals";
import { WORLD_ATLAS_PATHS } from "../lib/world-atlas-paths";
import { PremiumTraceabilityGlobe, type TraceabilityGlobePoint, type TraceabilityGlobeRoute } from "./premium-traceability-globe";

type Vertical = PlatformDemoVertical;
type HeroSelectorKey = PlatformDemoVertical;

const HeroThreeStage = dynamic(() => import("./hero-three-stage").then((mod) => mod.HeroThreeStage), {
  ssr: false,
});

const heroAtlasMapSize = { width: 440, height: 270 };

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

type ProductInfoRow = {
  label: string;
  value: string;
};

const productModalCopy: Record<AppLocale, {
  open: string;
  close: string;
  title: string;
  subtitle: string;
  consumerTitle: string;
  operatorTitle: string;
  proofTitle: string;
  commerceTitle: string;
  iphone: string;
  samsung: string;
  state: string;
  trustedTap: string;
  productTitle: string;
  productSubtitle: string;
  livePhoneTitle: string;
  phoneNote: string;
}> = {
  "es-AR": {
    open: "Ampliar ficha",
    close: "Cerrar",
    title: "Ficha completa de producto",
    subtitle: "Registro ampliado del activo fisico: producto, lote, origen, estado, evidencia SUN, proxima accion comercial y trazabilidad.",
    consumerTitle: "Producto ampliado",
    operatorTitle: "Ficha premium",
    proofTitle: "Evidencia tecnica",
    commerceTitle: "Acciones post-tap",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "Estado",
    trustedTap: "Tap fisico verificado",
    productTitle: "Activo fisico",
    productSubtitle: "Click para abrir ficha completa",
    livePhoneTitle: "Demo celular en vivo",
    phoneNote: "La autenticidad se valida en el momento del tap con la informacion disponible. Si no hay conexion, la lectura queda pendiente hasta sincronizar.",
  },
  "pt-BR": {
    open: "Ampliar ficha",
    close: "Fechar",
    title: "Ficha completa do produto",
    subtitle: "Registro ampliado do ativo fisico: produto, lote, origem, estado, evidencia SUN, proxima acao comercial e rastreabilidade.",
    consumerTitle: "Produto ampliado",
    operatorTitle: "Ficha premium",
    proofTitle: "Evidencia tecnica",
    commerceTitle: "Acoes pos-toque",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "Estado",
    trustedTap: "Toque fisico verificado",
    productTitle: "Ativo fisico",
    productSubtitle: "Clique para abrir ficha completa",
    livePhoneTitle: "Demo mobile ao vivo",
    phoneNote: "A autenticidade e validada no momento do toque com a evidencia disponivel. Sem conexao, a leitura fica pendente ate sincronizar.",
  },
  en: {
    open: "Open product detail",
    close: "Close",
    title: "Complete product detail",
    subtitle: "Expanded record for the physical asset: product, batch, origin, state, SUN evidence, commercial next action and traceability.",
    consumerTitle: "Expanded product",
    operatorTitle: "Premium record",
    proofTitle: "Technical evidence",
    commerceTitle: "Post-tap actions",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "State",
    trustedTap: "Verified physical tap",
    productTitle: "Physical asset",
    productSubtitle: "Click to open full detail",
    livePhoneTitle: "Live phone demo",
    phoneNote: "Authenticity is validated at tap time with available evidence. When offline, the read remains pending until sync.",
  },
};

const heroStageCopy: Record<AppLocale, {
  identityTitle: string;
  consumerTitle: string;
  routeTitle: string;
  routeSubtitle: string;
  live: string;
  custodyTitle: string;
  integrity: string;
  verified: string;
  events: string;
  alerts: string;
  clickHint: string;
  detailHint: string;
  cellularState: string;
  productType: string;
  bottle: string;
  tapFinal: string;
  demoEvent: string;
}> = {
  "es-AR": {
    identityTitle: "PRUEBA DE IDENTIDAD",
    consumerTitle: "TAP FINAL (CONSUMIDOR)",
    routeTitle: "RUTA VIVA",
    routeSubtitle: "Trazabilidad en tiempo real",
    live: "En vivo",
    custodyTitle: "HITOS DE CUSTODIA",
    integrity: "Integridad de ruta",
    verified: "verificada",
    events: "Eventos",
    alerts: "Alertas",
    clickHint: "Hacé click para abrir la ficha completa en una vista centrada",
    detailHint: "Ver detalle completo del producto",
    cellularState: "SALIDA CELULAR",
    productType: "Tipo",
    bottle: "Botella",
    tapFinal: "Tap final",
    demoEvent: "Evento demo",
  },
  "pt-BR": {
    identityTitle: "PROVA DE IDENTIDADE",
    consumerTitle: "TOQUE FINAL (CONSUMIDOR)",
    routeTitle: "ROTA VIVA",
    routeSubtitle: "Rastreabilidade em tempo real",
    live: "Ao vivo",
    custodyTitle: "MARCOS DE CUSTODIA",
    integrity: "Integridade da rota",
    verified: "verificada",
    events: "Eventos",
    alerts: "Alertas",
    clickHint: "Clique para abrir a ficha completa em uma vista centralizada",
    detailHint: "Ver detalhe completo do produto",
    cellularState: "SAIDA MOBILE",
    productType: "Tipo",
    bottle: "Unidade",
    tapFinal: "Toque final",
    demoEvent: "Evento demo",
  },
  en: {
    identityTitle: "IDENTITY PROOF",
    consumerTitle: "FINAL TAP (CONSUMER)",
    routeTitle: "LIVE ROUTE",
    routeSubtitle: "Real-time traceability",
    live: "Live",
    custodyTitle: "CUSTODY MILESTONES",
    integrity: "Route integrity",
    verified: "verified",
    events: "Events",
    alerts: "Alerts",
    clickHint: "Click to open the full product detail in a centered view",
    detailHint: "View complete product detail",
    cellularState: "MOBILE OUTPUT",
    productType: "Type",
    bottle: "Unit",
    tapFinal: "Final tap",
    demoEvent: "Demo event",
  },
};

const tapLocations: LocationPoint[] = [
  { city: "Sydney", country: "Australia", label: "tap de consumidor", lat: -33.8688, lng: 151.2093 },
  { city: "Buenos Aires", country: "Argentina", label: "miembro del club", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", label: "comprador en tienda", lat: -33.4489, lng: -70.6693 },
  { city: "São Paulo", country: "Brasil", label: "distribuidor validado", lat: -23.5558, lng: -46.6396 },
  { city: "Miami", country: "Estados Unidos", label: "distribuidor de exportación", lat: 25.7617, lng: -80.1918 },
  { city: "Zúrich", country: "Suiza", label: "coleccionista premium", lat: 47.3769, lng: 8.5417 },
  { city: "Córdoba", country: "Argentina", label: "ingreso de evento", lat: -31.4201, lng: -64.1888 },
];

const atlasNetworkPoints: TraceabilityGlobePoint[] = traceabilityGlobePoints.map((point) => ({
  city: point.city,
  country: point.country,
  lat: point.lat,
  lng: point.lng,
  scans: point.scans,
  risk: point.risk,
  status: point.status,
  vertical: point.vertical,
}));

function uniqueAtlasPoints(points: TraceabilityGlobePoint[]) {
  const seen = new Set<string>();
  return points.filter((point) => {
    const key = `${point.city}|${point.country || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    selectorTitle: "Elegí vertical",
    microcopy: "Cada toque convierte seguridad en relación: prueba de origen, club, garantía, puntos, recompra y tienda contextual para la marca.",
    commercialRail: "Capa comercial que se activa después del toque",
    valuePills: ["Club VIP", "Puntos", "Garantía", "Dato para CRM", "Tienda", "Token opcional"],
    ctaBands: ["Bodegas", "Eventos", "Cosmética", "Agro", "Moda", "Salud"],
    phoneLabel: "Salida celular",
    swapTap: "Cambiar toque",
    liveTap: "Toque simulado",
    whatHappened: "Qué está pasando",
    routeTitle: "Ruta de confianza",
    originMap: "Origen",
    tapMap: "Toque",
    openOriginMap: "Ver origen en Maps",
    custody: "Origen, distancia y acción quedan unidos al evento.",
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
      nextAction: "Siguiente acción",
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
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Bolsa abierta en campo: lote, ficha técnica y custodia visibles.",
        result: "Lote y origen verificados",
        product: "Semilla premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID + trazabilidad logística",
        nextAction: "Ficha técnica, soporte y reclamo",
        marketplace: "Reposición, asesor técnico y cupón rural",
        loyalty: "Soporte técnico, reposición y beneficios por lote",
        businessValue: "Trazabilidad + asistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - LOT_OK",
        steps: ["Lectura en campo", "Lote confirmado", "Origen visible", "Soporte activo"],
      },
      bracelet: {
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
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicamento escaneado: veracidad, lote y recall por unidad verificado en base de datos.",
        result: "Medicamento verificado",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "SUN anticopia + recall unitario",
        nextAction: "Ver prospecto digital o reporte de lote",
        marketplace: "Canal farmacia + soporte médico",
        loyalty: "Garantía de autenticidad, prospecto y recordatorios de dosis",
        businessValue: "Auditoría de lote + alerta recall + first party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Lectura en caja", "SUN valida origen", "Verifica estado de recall", "Abre prospecto digital"],
      },
      perfume: {
        label: "Cosmética",
        profile: "NTAG 424 DNA",
        action: "Tapa o sello validado: el producto demuestra lote, origen y garantía.",
        result: "Producto genuino",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "SUN dinámico + lote + garantía",
        nextAction: "Registro de garantía y recompra",
        marketplace: "Venta cruzada, muestras y beneficios",
        loyalty: "Garantía, muestras y recompra",
        businessValue: "Antifalsificación + datos propios + venta cruzada",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Toque en tapa", "SUN verifica autenticidad", "Muestra lote", "Activa garantía"],
      },
      wine: {
        label: "Vino",
        profile: "NTAG 424 DNA TT",
        action: "Descorche o sello abierto: la etiqueta cambia estado y el SUN valida el toque.",
        result: "Auténtico, sello abierto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "bodega", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinámico + sello físico + anticopia",
        nextAction: "Club, garantía, reclamo de dueño o token premium",
        marketplace: "Voucher post-compra + trazabilidad de colección",
        loyalty: "320 pts, club de cosecha, voucher y recompra premium",
        businessValue: "CRM post-toque + tienda + tokenización opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "VINO - AUT_OK",
        steps: ["Se lee UID físico", "SUN evita copia", "El sello queda abierto", "Se abre club y tienda"],
      },
      sneaker: {
        label: "Zapatillas",
        profile: "NTAG 424 DNA",
        action: "Zapatilla coleccionable verificada: UID, rareza, dueño y beneficio quedan unidos al toque.",
        result: "Autenticada con dueño",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "SUN dinámico + UID + reclamo de dueño",
        nextAction: "Verificar dueño, garantía, reventa o token premium",
        marketplace: "Drop exclusivo, reventa controlada y beneficios de comunidad",
        loyalty: "Acceso a drops, puntos y certificado de colección",
        businessValue: "Anticopia + ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - OWNER_OK",
        steps: ["Toque en lengueta", "SUN valida pieza", "Rareza visible", "Dueño/token habilitado"],
      },
      logistics: {
        label: "Logística",
        profile: "UHF + NFC",
        action: "Pallet escaneado en distribuidora: temperatura, ruta de custodia y lote confirmados.",
        result: "Cadena de frío OK",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logístico", lat: -32.8895, lng: -68.8458 },
        security: "Sensores IoT + UID + cadena de custodia",
        nextAction: "Ficha de temperatura y auditoría",
        marketplace: "Servicios logísticos premium + seguros de carga",
        loyalty: "Historial de ruta, temperatura promedio y reporte de conformidad",
        businessValue: "Auditoría en tiempo real + reclamos automatizados + control de calidad",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Lectura en pallet", "Check de temperatura IoT", "Valida ruta", "Confirma recepción"],
      },
      electronics: {
        label: "Electrónica",
        profile: "NFC + QR",
        action: "Dispositivo electrónico validado: propiedad, número de serie y garantía activados.",
        result: "Garantía activa",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID único + firma digital + tracking de garantía",
        nextAction: "Soporte oficial, registro o reclamo",
        marketplace: "Accesorios oficiales + extensión de garantía",
        loyalty: "Garantía digital activa, soporte prioritario y club de upgrades",
        businessValue: "Antifraude de garantía + registro post-venta + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Toque en caja/equipo", "SUN valida serie", "Garantía se activa", "Habilita soporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Pasaporte digital textil escaneado: origen, materiales y reventa verificados.",
        result: "Pasaporte DPP válido",
        product: "Campera Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "España", label: "fábrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Pasaporte digital europeo + UID NFC + certificado de propiedad",
        nextAction: "Ver circularidad y reclamar dueño",
        marketplace: "Canal de recompra circular + guía de cuidados",
        loyalty: "Acceso a pre-ventas, club de circularidad y descuento por reciclado",
        businessValue: "Cumplimiento regulatorio EU DPP + reventa de marca + engagement circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Lectura de etiqueta", "Valida pasaporte DPP", "Muestra materiales/origen", "Habilita reventa/cuidados"],
      },
      luxury: {
        label: "Lujo",
        profile: "NTAG 424 DNA",
        action: "Reloj cronógrafo escaneado: certificado de propiedad, garantía y autenticidad validados en el servidor.",
        result: "Autenticado con dueño",
        product: "Reloj cronógrafo premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "SUN dinámico + certificado de propiedad",
        nextAction: "Verificar dueño, garantía, reventa o token premium",
        marketplace: "Beneficios exclusivos, recompra y club de coleccionistas",
        loyalty: "Garantía digital activa, acceso VIP y club de coleccionistas",
        businessValue: "Antifalsificación + mercado de reventa verificado + CRM directo",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Toque en tarjeta", "SUN verifica autenticidad", "Valida propiedad", "Abre club de valor"],
      },
      bottle: {
        label: "Botellas",
        profile: "NFC + QR",
        action: "Botella de bebida retornable escaneada: procedencia, ciclo de reciclaje y retorno validados.",
        result: "Retorno Validado",
        product: "Bebida Gaseosa Orgánica",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta embotelladora", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + control de ciclo",
        nextAction: "Registrar retorno de envase o ver impacto ecológico",
        marketplace: "Tienda de recarga + cupones verdes",
        loyalty: "Descuento en próxima compra por retornar envase",
        businessValue: "Estadísticas ESG + incentivos de circularidad + control de inventario",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Lectura de envase", "Verifica retorno", "Asigna incentivo ecológico", "Confirma recepción"],
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
      seeds: {
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
      bracelet: {
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
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicamento escaneado: veracidade, lote e recall por unidade verificado no banco de dados.",
        result: "Medicamento verificado",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "SUN anticopia + recall unitario",
        nextAction: "Ver bula digital ou relatorio de lote",
        marketplace: "Canal farmacia + suporte medico",
        loyalty: "Garantia de autenticidade, bula e lembretes de dose",
        businessValue: "Auditoria de lote + alerta recall + first party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Leitura na caixa", "SUN valida origem", "Verifica estado de recall", "Abre bula digital"],
      },
      perfume: {
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
      sneaker: {
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
      logistics: {
        label: "Logistica",
        profile: "UHF + NFC",
        action: "Pallet escaneado na distribuidora: temperatura, rota de custodia e lote confirmados.",
        result: "Cadeia de frio OK",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logistico", lat: -32.8895, lng: -68.8458 },
        security: "Sensores IoT + UID + cadeia de custodia",
        nextAction: "Ficha de temperatura e auditoria",
        marketplace: "Servicos logisticos premium + seguros de carga",
        loyalty: "Historico de rota, temperatura media e relatorio de conformidade",
        businessValue: "Auditoria em tempo real + reclamacoes automatizadas + controle de qualidade",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Leitura no pallet", "Check de temperatura IoT", "Valida rota", "Confirma recepcao"],
      },
      electronics: {
        label: "Eletronica",
        profile: "NFC + QR",
        action: "Dispositivo eletronico verificado: propriedade, numero de serie e garantia ativados.",
        result: "Garantia Ativa",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID unico + assinatura digital + tracking de garantia",
        nextAction: "Suporte oficial, registro ou reclamacao",
        marketplace: "Acessorios oficiais + extensao de garantia",
        loyalty: "Garantia digital activa, suporte prioritario e clube de upgrades",
        businessValue: "Antifraude de garantia + registro pos-venda + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Toque na caixa/equipamento", "SUN valida serie", "Garantia activa", "Habilita suporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Passaporte digital textil escaneado: origem, composicao e revenda verificados.",
        result: "Passaporte DPP Valido",
        product: "Jaqueta Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Espanha", label: "fabrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Passaporte digital europeu + UID NFC + certificado de propriedade",
        nextAction: "Ver circularidade e reclamar dono",
        marketplace: "Canal de recompra circular + guia de cuidados",
        loyalty: "Acesso a pre-vendas, clube de circularidade e desconto por reciclagem",
        businessValue: "Cumplimiento regulatorio EU DPP + revenda de marca + engajamento circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Leitura da etiqueta", "Valida pasaporte DPP", "Mostra materiais/origem", "Habilita revenda/cuidados"],
      },
      luxury: {
        label: "Luxo",
        profile: "NTAG 424 DNA",
        action: "Relogio cronografo escaneado: certificado de propriedade, garantia e autenticidade validados no servidor.",
        result: "Autenticado com dono",
        product: "Relogio Cronografo Premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "SUN dinamico + certificado de propriedade",
        nextAction: "Verificar dono, garantia, revenda ou token premium",
        marketplace: "Beneficios exclusivos, recompra e clube de colecionadores",
        loyalty: "Garantia digital ativa, acesso VIP e clube de colecionadores",
        businessValue: "Antifalsificacao + mercado de revenda verificado + CRM direto",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Toque no cartao", "SUN verifica autenticidade", "Valida propriedade", "Abre clube de valor"],
      },
      bottle: {
        label: "Garrafas",
        profile: "NFC + QR",
        action: "Garrafa de bebida retornavel escaneada: procedencia, ciclo de reciclagem e retorno validados.",
        result: "Retorno Validado",
        product: "Refrigerante Organico",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta de engarrafamento", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + controle de ciclo",
        nextAction: "Registrar retorno da embalagem ou ver impacto ecologico",
        marketplace: "Loja de recarga + cupons verdes",
        loyalty: "Desconto na proxima compra por retornar embalagem",
        businessValue: "Estatisticas ESG + incentivos de circularidade + controle de estoque",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Leitura da garrafa", "Verifica retorno", "Atribui incentivo ecologico", "Confirma recepcao"],
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
      seeds: {
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
      bracelet: {
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
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Medicine scanned: authenticity, batch and unit recall status verified in database.",
        result: "Medicine verified",
        product: "Premium Amoxicillin",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "lab", lat: 4.711, lng: -74.0721 },
        security: "Dynamic SUN + unit recall",
        nextAction: "View digital leaflet or batch audit trail",
        marketplace: "Pharmacy channel + medical support",
        loyalty: "Authenticity warranty, leaflet and dosage reminders",
        businessValue: "Batch audit trail + recall alert + first-party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - AUTH_OK",
        steps: ["Box scan", "SUN verifies origin", "Verifies recall status", "Opens digital leaflet"],
      },
      perfume: {
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
      sneaker: {
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
      logistics: {
        label: "Logistics",
        profile: "UHF + NFC",
        action: "Pallet scanned at warehouse: temperature, custody route and batch confirmed.",
        result: "Cold chain OK",
        product: "Co-19 Vaccine Pallet",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "logistics hub", lat: -32.8895, lng: -68.8458 },
        security: "IoT Sensors + UID + custody chain",
        nextAction: "Temperature log and audit trail",
        marketplace: "Premium logistics + cargo insurance",
        loyalty: "Route history, average temperature and compliance report",
        businessValue: "Real-time auditing + automated claims + quality control",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - COLD_OK",
        steps: ["Pallet read", "IoT temperature check", "Validate route", "Confirm delivery"],
      },
      electronics: {
        label: "Electronics",
        profile: "NFC + QR",
        action: "Electronic device verified: ownership, serial number and warranty activated.",
        result: "Warranty Active",
        product: "Nex-V Smartwatch",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "United States", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Unique UID + digital signature + warranty tracking",
        nextAction: "Official support, register or claim",
        marketplace: "Official accessories + warranty extension",
        loyalty: "Active digital warranty, priority support and upgrade club",
        businessValue: "Warranty anti-fraud + registration + upgrade offers",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - WARRANTY_OK",
        steps: ["Box/device tap", "SUN validates serial", "Warranty activates", "Enables support"],
      },
      textile: {
        label: "Textile",
        profile: "NFC + QR DPP",
        action: "Digital product passport scanned: origin, composition and verified resale status.",
        result: "Valid DPP Passport",
        product: "Premium Denim Jacket",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Spain", label: "textile mill", lat: 40.4168, lng: -3.7038 },
        security: "EU Digital Passport + NFC UID + owner cert",
        nextAction: "View circularity and claim ownership",
        marketplace: "Circular resale channel + care guide",
        loyalty: "Pre-sales access, circularity club and recycling discounts",
        businessValue: "EU DPP compliance + branded resale + circular engagement",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_OK",
        steps: ["Tag scan", "Validate DPP passport", "Show materials/origin", "Enable circular options"],
      },
      luxury: {
        label: "Luxury",
        profile: "NTAG 424 DNA",
        action: "Chronograph watch scanned: certificate of ownership, warranty and authenticity verified on server.",
        result: "Authenticated owner",
        product: "Premium Chronograph Watch",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "United States", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Dynamic SUN + ownership certificate",
        nextAction: "Verify owner, warranty, resale or premium token",
        marketplace: "Exclusive benefits, resale and collector club",
        loyalty: "Active digital warranty, VIP access and collector club",
        businessValue: "Anti-counterfeiting + verified resale market + direct CRM",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - AUTH_OK",
        steps: ["Card tap", "SUN verifies authenticity", "Validates ownership", "Opens value club"],
      },
      bottle: {
        label: "Bottles",
        profile: "NFC + QR",
        action: "Returnable beverage bottle scanned: provenance, recycling cycle and returns verified.",
        result: "Return Verified",
        product: "Organic Soda Bottle",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "bottling plant", lat: -32.9442, lng: -60.6505 },
        security: "QR + UID NFC + cycle control",
        nextAction: "Register container return or see green impact",
        marketplace: "Refill store + green coupons",
        loyalty: "Next purchase discount for returning container",
        businessValue: "ESG stats + circularity incentives + inventory control",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_OK",
        steps: ["Bottle read", "Verify return", "Assigns green incentive", "Confirms reception"],
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

type HeroRouteHover = {
  eyebrow: string;
  title: string;
  detail: string;
  tone: "origin" | "tap" | "route" | "crm";
};

const HERO_ATLAS_WIDTH = 1200;
const HERO_ATLAS_HEIGHT = 620;
const HERO_ATLAS_MIN_LAT = -105;
const HERO_ATLAS_MAX_LAT = 84;
const HERO_ATLAS_WORLD_SCALE_Y = 142 / (HERO_ATLAS_MAX_LAT - HERO_ATLAS_MIN_LAT);

function projectHeroAtlasPoint(point: Pick<VectorMapPoint, "lat" | "lng">) {
  const lat = clamp(point.lat, HERO_ATLAS_MIN_LAT, HERO_ATLAS_MAX_LAT);
  return {
    x: ((point.lng + 180) / 360) * HERO_ATLAS_WIDTH,
    y: ((HERO_ATLAS_MAX_LAT - lat) / (HERO_ATLAS_MAX_LAT - HERO_ATLAS_MIN_LAT)) * HERO_ATLAS_HEIGHT,
  };
}

function heroAtlasRoutePath(route: VectorMapRoute) {
  const start = projectHeroAtlasPoint({ lat: route.fromLat, lng: route.fromLng });
  const end = projectHeroAtlasPoint({ lat: route.toLat, lng: route.toLng });
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lift = Math.min(170, Math.max(58, Math.abs(dx) * 0.16 + Math.abs(dy) * 0.08));
  const c1x = start.x + dx * 0.32;
  const c2x = start.x + dx * 0.68;
  const c1y = Math.min(start.y, end.y) - lift;
  const c2y = Math.min(start.y, end.y) - lift * 0.9;
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

function heroAtlasLabelPosition(point: VectorMapPoint) {
  const projected = projectHeroAtlasPoint(point);
  const offsets: Record<string, { dx: number; dy: number; anchor: "start" | "end" }> = {
    origin: { dx: 18, dy: -64, anchor: "start" },
    "custody-miami": { dx: 22, dy: -40, anchor: "start" },
    "custody-madrid": { dx: 24, dy: -48, anchor: "start" },
    "custody-singapore": { dx: 24, dy: -34, anchor: "start" },
    tap: { dx: -48, dy: -82, anchor: "end" },
  };
  const offset = offsets[point.id] || { dx: 18, dy: -34, anchor: "start" as const };
  return {
    x: clamp(projected.x + offset.dx, 28, HERO_ATLAS_WIDTH - 28),
    y: clamp(projected.y + offset.dy, 54, HERO_ATLAS_HEIGHT - 48),
    anchor: offset.anchor,
  };
}

export function HeroTrustAtlasSvg({
  points,
  routes,
  selectedPointId = "tap",
}: {
  points: VectorMapPoint[];
  routes: VectorMapRoute[];
  selectedPointId?: string;
}) {
  const atlasId = useId().replace(/:/g, "");
  const oceanId = `hero-atlas-ocean-${atlasId}`;
  const landId = `hero-atlas-land-${atlasId}`;
  const routeInfoId = `hero-atlas-route-info-${atlasId}`;
  const routeSuccessId = `hero-atlas-route-success-${atlasId}`;
  const nodeGlowId = `hero-atlas-node-glow-${atlasId}`;
  const softGlowId = `hero-atlas-soft-glow-${atlasId}`;
  const gridId = `hero-atlas-grid-${atlasId}`;

  return (
    <svg
      className="hero-trust-atlas"
      viewBox={`0 0 ${HERO_ATLAS_WIDTH} ${HERO_ATLAS_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Atlas nexID de trazabilidad en tiempo real"
      data-nexid-map="hero-trust-atlas"
    >
      <defs>
        <linearGradient id={oceanId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--hero-atlas-ocean-a, #06233a)" />
          <stop offset="48%" stopColor="var(--hero-atlas-ocean-b, #031321)" />
          <stop offset="100%" stopColor="var(--hero-atlas-ocean-c, #050918)" />
        </linearGradient>
        <linearGradient id={landId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--hero-atlas-land-a, #0f766e)" stopOpacity="0.72" />
          <stop offset="52%" stopColor="var(--hero-atlas-land-b, #0891b2)" stopOpacity="0.46" />
          <stop offset="100%" stopColor="var(--hero-atlas-land-c, #1e3a8a)" stopOpacity="0.34" />
        </linearGradient>
        <linearGradient id={routeInfoId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--hero-atlas-route-info-a, #22d3ee)" stopOpacity="0.2" />
          <stop offset="45%" stopColor="var(--hero-atlas-route-info-b, #67e8f9)" stopOpacity="0.98" />
          <stop offset="100%" stopColor="var(--hero-atlas-route-info-c, #a78bfa)" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id={routeSuccessId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="var(--hero-atlas-route-success-a, #34d399)" stopOpacity="0.42" />
          <stop offset="50%" stopColor="var(--hero-atlas-route-success-b, #22d3ee)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--hero-atlas-route-success-c, #fbbf24)" stopOpacity="0.88" />
        </linearGradient>
        <radialGradient id={nodeGlowId} cx="50%" cy="50%" r="62%">
          <stop offset="0%" stopColor="var(--hero-atlas-node-a, #ffffff)" stopOpacity="0.98" />
          <stop offset="36%" stopColor="var(--hero-atlas-node-b, #67e8f9)" stopOpacity="0.72" />
          <stop offset="100%" stopColor="var(--hero-atlas-node-c, #22d3ee)" stopOpacity="0" />
        </radialGradient>
        <filter id={softGlowId} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.12 0 0 0 0 0.82 0 0 0 0 0.92 0 0 0 .72 0" result="glow" />
          <feMerge>
            <feMergeNode in="glow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <pattern id={gridId} width="80" height="80" patternUnits="userSpaceOnUse">
          <path d="M80 0H0V80" fill="none" stroke="rgba(125,211,252,.08)" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width={HERO_ATLAS_WIDTH} height={HERO_ATLAS_HEIGHT} fill={`url(#${oceanId})`} />
      <rect width={HERO_ATLAS_WIDTH} height={HERO_ATLAS_HEIGHT} fill={`url(#${gridId})`} opacity="0.7" />

      <g className="hero-trust-atlas__parallels" aria-hidden="true">
        {[120, 220, 320, 420, 520].map((y) => (
          <path key={`parallel-${y}`} d={`M 24 ${y} C 210 ${y - 24} 482 ${y + 22} 696 ${y - 4} C 904 ${y - 30} 1050 ${y + 12} 1176 ${y - 8}`} />
        ))}
        {[150, 300, 450, 600, 750, 900, 1050].map((x) => (
          <path key={`meridian-${x}`} d={`M ${x} 36 C ${x - 38} 174 ${x + 44} 360 ${x - 16} 590`} />
        ))}
      </g>

      <g className="hero-trust-atlas__regions" transform={`scale(1 ${HERO_ATLAS_WORLD_SCALE_Y})`} aria-hidden="true">
        {WORLD_ATLAS_PATHS.map((region, index) => (
          <g key={region.id} className={`hero-trust-atlas__region-group hero-trust-atlas__region-group--${region.tone}`}>
            <path
              className={`hero-trust-atlas__region hero-trust-atlas__region--${region.tone}`}
              d={region.d}
              fill={`url(#${landId})`}
              fillRule="evenodd"
              stroke="rgba(103,232,249,.24)"
              strokeWidth="0.95"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ "--hero-atlas-land-fill": `url(#${landId})`, opacity: Math.min(0.92, 0.58 + index * 0.035) } as CSSProperties}
            />
            <path
              className={`hero-trust-atlas__coastline hero-trust-atlas__coastline--${region.tone}`}
              d={region.d}
              fill="none"
              stroke="rgba(207,250,254,.24)"
              strokeWidth="0.48"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        ))}
      </g>

      <g className="hero-trust-atlas__routes" filter={`url(#${softGlowId})`}>
        {routes.map((route, index) => {
          const path = heroAtlasRoutePath(route);
          const tone = route.tone === "success" ? "success" : route.tone === "warn" ? "warn" : "info";
          const routeStroke = tone === "success" ? `url(#${routeSuccessId})` : tone === "warn" ? "#f59e0b" : `url(#${routeInfoId})`;
          return (
            <g key={route.id}>
              <path className="hero-trust-atlas__route-halo" d={path} />
              <path className={`hero-trust-atlas__route hero-trust-atlas__route--${tone}`} d={path} style={{ "--hero-atlas-route-stroke": routeStroke, animationDelay: `${index * -0.55}s` } as CSSProperties} />
              <circle className={`hero-trust-atlas__comet hero-trust-atlas__comet--${tone}`} r={tone === "success" ? 7 : 5} style={{ "--hero-atlas-node-glow": `url(#${nodeGlowId})` } as CSSProperties}>
                <animateMotion dur={`${4.8 + index * 0.45}s`} repeatCount="indefinite" path={path} />
              </circle>
            </g>
          );
        })}
      </g>

      <g className="hero-trust-atlas__nodes">
        {points.map((point) => {
          const { x, y } = projectHeroAtlasPoint(point);
          const label = heroAtlasLabelPosition(point);
          const tone = point.tone || "hub";
          const isSelected = point.id === selectedPointId;
          const isEndpoint = point.id === "origin" || point.id === "tap";
          const plateWidth = isEndpoint ? 122 : 106;
          const plateHeight = isEndpoint ? 42 : 38;
          const plateY = isEndpoint ? -12 : -10;
          const plateX = label.anchor === "end" ? -plateWidth + 10 : -10;
          const accentX = label.anchor === "end" ? -6 : -10;
          const leaderX = label.x + (label.anchor === "end" ? -10 : 10);
          const leaderY = label.y + 10;
          return (
            <g key={point.id}>
              <path
                className={`hero-trust-atlas__leader hero-trust-atlas__leader--${tone}`}
                d={`M ${x.toFixed(1)} ${y.toFixed(1)} L ${leaderX.toFixed(1)} ${leaderY.toFixed(1)}`}
                vectorEffect="non-scaling-stroke"
              />
              <g className={`hero-trust-atlas__node hero-trust-atlas__node--${tone} ${isSelected ? "is-selected" : ""}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
                <circle className="hero-trust-atlas__node-pulse" r={isSelected ? 22 : 18} />
                <circle className="hero-trust-atlas__node-ring" r={isSelected ? 11 : 9} />
                <circle className="hero-trust-atlas__node-core" r={isSelected ? 4.8 : 4} />
              </g>
              <g className={`hero-trust-atlas__label-callout hero-trust-atlas__label-callout--${tone} hero-trust-atlas__label-callout--point-${point.id}`} transform={`translate(${label.x.toFixed(1)} ${label.y.toFixed(1)})`}>
                <rect className="hero-trust-atlas__label-plate" x={plateX} y={plateY} width={plateWidth} height={plateHeight} rx="7" />
                <rect className="hero-trust-atlas__label-accent" x={accentX} y={plateY} width="3" height={plateHeight} rx="1.5" />
                <text textAnchor={label.anchor} className="hero-trust-atlas__label-eyebrow">{point.stageLabel || (point.id === "tap" ? "Tap final" : "Custodia")}</text>
                <text textAnchor={label.anchor} y="14" className="hero-trust-atlas__label-main">{point.label}</text>
                <text textAnchor={label.anchor} y="27" className="hero-trust-atlas__label-sub">{point.sublabel}</text>
              </g>
            </g>
          );
        })}
      </g>

      <g className="hero-trust-atlas__legend" transform="translate(28 560)">
        <rect width="210" height="40" rx="8" />
        <text x="14" y="17">nexID TRUST ATLAS</text>
        <text x="14" y="31">live custody + physical tap</text>
      </g>
    </svg>
  );
}

function EnterpriseHeroAtlasPanel({
  origin,
  tap,
  distance,
  numberLocale,
  txt,
  stageCopy,
}: {
  origin: LocationPoint;
  tap: LocationPoint;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "routeTitle" | "originMap" | "tapMap" | "custody">;
  stageCopy: (typeof heroStageCopy)["es-AR"];
}) {
  const formattedDistance = distance.toLocaleString(numberLocale);
  const isEnglish = txt.routeTitle === "Trust route";
  const isPortuguese = txt.routeTitle.startsWith("Rota");
  const custodyStage = isEnglish ? "Custody" : "Custodia";
  const madridCountry = isEnglish ? "Spain" : isPortuguese ? "Espanha" : "Espana";
  const singaporeLabel = isEnglish ? "Singapore" : isPortuguese ? "Singapura" : "Singapur";
  const distributionEvidence = isEnglish ? "Distribution center" : isPortuguese ? "Centro de distribuicao" : "Centro de distribucion";
  const documentEvidence = isEnglish ? "Document control" : isPortuguese ? "Controle documental" : "Control documental";
  const exportEvidence = isEnglish ? "Export channel" : isPortuguese ? "Canal de exportacao" : "Canal de exportacion";
  const evidenceCopy = txt.routeTitle === "Trust route"
    ? `${formattedDistance} km with physical tap, SUN and channel evidence.`
    : txt.routeTitle.startsWith("Rota")
      ? `${formattedDistance} km com evidencia de toque, SUN e canal.`
      : `${formattedDistance} km con evidencia de tap fisico, SUN y canal.`;

  const custodyStops = useMemo<VectorMapPoint[]>(() => {
    const stops: VectorMapPoint[] = [
      {
        id: "origin",
        label: origin.city,
        sublabel: origin.country,
        lat: origin.lat,
        lng: origin.lng,
        scans: 1,
        risk: 0,
        tone: "origin",
        stageLabel: txt.originMap,
        evidence: txt.custody,
      },
      {
        id: "custody-miami",
        label: "Miami",
        sublabel: "USA",
        lat: 25.7617,
        lng: -80.1918,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: custodyStage,
        evidence: distributionEvidence,
      },
      {
        id: "custody-madrid",
        label: "Madrid",
        sublabel: madridCountry,
        lat: 40.4168,
        lng: -3.7038,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: custodyStage,
        evidence: documentEvidence,
      },
      {
        id: "custody-singapore",
        label: singaporeLabel,
        sublabel: "SGP",
        lat: 1.3521,
        lng: 103.8198,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: custodyStage,
        evidence: exportEvidence,
      },
      {
        id: "tap",
        label: tap.city,
        sublabel: tap.country,
        lat: tap.lat,
        lng: tap.lng,
        scans: 1,
        risk: 0,
        tone: "tap",
        stageLabel: stageCopy.tapFinal,
        evidence: tap.label,
        lastSeen: stageCopy.demoEvent,
      },
    ];

    return stops.filter((point, index, all) => all.findIndex((item) => Math.abs(item.lat - point.lat) < 0.01 && Math.abs(item.lng - point.lng) < 0.01) === index);
  }, [custodyStage, distributionEvidence, documentEvidence, exportEvidence, madridCountry, origin, singaporeLabel, stageCopy.demoEvent, stageCopy.tapFinal, tap, txt.custody, txt.originMap]);

  const eventCountLabel = isEnglish ? `${custodyStops.length} events` : `${custodyStops.length} eventos`;

  const vectorRoutes = useMemo<VectorMapRoute[]>(() => custodyStops.slice(1).map((stop, index) => {
    const previous = custodyStops[index];
    const isFinal = stop.id === "tap";
    return {
      id: `enterprise-route-${previous.id}-${stop.id}`,
      fromLat: previous.lat,
      fromLng: previous.lng,
      toLat: stop.lat,
      toLng: stop.lng,
      label: `${previous.label} -> ${stop.label}`,
      tone: isFinal ? "success" : "info",
      distanceLabel: isFinal ? `${formattedDistance} km` : undefined,
      evidence: isFinal ? evidenceCopy : stop.evidence,
    };
  }), [custodyStops, evidenceCopy, formattedDistance]);

  const timelineStops = custodyStops.map((stop, index) => ({
    ...stop,
    title: index === 0 ? txt.originMap : stop.id === "tap" ? stageCopy.tapFinal : stop.stageLabel || "Custodia",
    date: index === 0 ? "12 ENE 08:15" : index === 1 ? "15 ENE 14:22" : index === 2 ? "19 ENE 09:10" : index === 3 ? "22 ENE 12:45" : "24 ENE 18:33",
  }));

  const ledgerItems = [
    { id: "integrity", label: stageCopy.integrity, value: stageCopy.verified },
    { id: "events", label: stageCopy.events, value: `${custodyStops.length}/${custodyStops.length}` },
    { id: "alerts", label: stageCopy.alerts, value: "0" },
  ];

  return (
    <section className="nexid-hero-atlas-card" aria-label={stageCopy.routeTitle}>
      <header className="nexid-hero-atlas-card__head">
        <div>
          <span>{stageCopy.routeTitle}</span>
          <strong>{stageCopy.routeSubtitle}</strong>
        </div>
        <em><i />{stageCopy.live}</em>
      </header>

      <div className="nexid-hero-atlas-card__map">
        <HeroTrustAtlasSvg points={custodyStops} routes={vectorRoutes} selectedPointId="tap" />
        <div className="nexid-hero-atlas-card__map-controls" aria-hidden="true">
          <span>+</span>
          <span>-</span>
        </div>
      </div>

      <div className="nexid-hero-atlas-card__timeline">
        <div className="nexid-hero-atlas-card__timeline-head">
          <span>{stageCopy.custodyTitle}</span>
          <strong>{eventCountLabel}</strong>
        </div>
        <div className="nexid-hero-atlas-card__stops">
          {timelineStops.map((stop) => (
            <article key={stop.id} className={stop.id === "tap" ? "is-final" : ""}>
              <i>{stop.id === "tap" ? "" : "✓"}</i>
              <span>{stop.title}</span>
              <strong>{stop.label}</strong>
              <em>{stop.sublabel}</em>
              <small>{stop.date}</small>
            </article>
          ))}
        </div>
      </div>

      <footer className="nexid-hero-atlas-card__ledger">
        {ledgerItems.map((item) => (
          <span key={item.id}>
            <em>{item.label}</em>
            <strong>{item.value}</strong>
          </span>
        ))}
      </footer>
    </section>
  );
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
  const formattedDistance = distance.toLocaleString(numberLocale);
  const routeHeadline = txt.routeTitle === "Trust route" ? "Live route" : txt.routeTitle.startsWith("Rota") ? "Rota viva" : "Ruta viva";
  const tapCopy = txt.routeTitle === "Trust route" ? "Physical tap" : txt.routeTitle.startsWith("Rota") ? "Toque físico" : "Tap físico";
  const evidenceCopy = txt.routeTitle === "Trust route"
    ? `${formattedDistance} km with physical tap, SUN and channel evidence.`
    : txt.routeTitle.startsWith("Rota")
      ? `${formattedDistance} km com evidencia de toque, SUN e canal.`
    : `${formattedDistance} km con evidencia de toque físico, SUN y canal.`;
  const signedCopy = txt.routeTitle === "Trust route" ? "Signed evidence" : txt.routeTitle.startsWith("Rota") ? "Evidência assinada" : "Evidencia firmada";
  const crmCopy = txt.routeTitle === "Trust route" ? "CRM ready" : txt.routeTitle.startsWith("Rota") ? "CRM pronto" : "CRM listo";
  const crmDetailCopy = txt.routeTitle === "Trust route"
    ? "benefit, warranty and reorder"
    : txt.routeTitle.startsWith("Rota")
      ? "benefício, garantia e recompra"
      : "beneficio, garantía y recompra";
  const proofSteps: HeroRouteHover[] = [
    { eyebrow: "01", title: txt.originMap, detail: `${origin.city} · ${origin.country}`, tone: "origin" },
    { eyebrow: "02", title: "UID + SUN", detail: signedCopy, tone: "route" },
    { eyebrow: "03", title: tapCopy, detail: `${tap.city} · ${tap.label}`, tone: "tap" },
    { eyebrow: "04", title: crmCopy, detail: crmDetailCopy, tone: "crm" },
  ];

  const [routeHover, setRouteHover] = useState<HeroRouteHover | null>(null);
  const routeDistanceLabel = `${formattedDistance} km`;
  const selectedProof = routeHover || proofSteps[0];
  const originPoint: TraceabilityGlobePoint = {
    city: origin.city,
    country: origin.country,
    lat: origin.lat,
    lng: origin.lng,
    scans: 6,
    risk: 0,
    status: "origin",
    vertical: "wine",
  };
  const tapPoint: TraceabilityGlobePoint = {
    city: tap.city,
    country: tap.country,
    lat: tap.lat,
    lng: tap.lng,
    scans: 14,
    risk: 0,
    status: "tap",
    vertical: "wine",
    lastSeen: new Date().toISOString(),
  };
  const globePoints = uniqueAtlasPoints([originPoint, tapPoint, ...atlasNetworkPoints]);
  const globeRoutes: TraceabilityGlobeRoute[] = [
    {
      fromLat: origin.lat,
      fromLng: origin.lng,
      toLat: tap.lat,
      toLng: tap.lng,
      label: `${origin.city} -> ${tap.city}`,
      tone: "info",
    },
    ...traceabilityGlobeRoutes.slice(0, 4),
  ];
  const atlasCities = globePoints.slice(0, 6);

  return (
    <div id="trace-signal-atlas" className="hero-trace-map hero-trace-map--trust-globe" aria-label={txt.routeTitle}>
      <PremiumTraceabilityGlobe
        title={routeHeadline}
        subtitle={`${origin.city} → ${tap.city} · ${routeDistanceLabel}`}
        caption={evidenceCopy}
        points={globePoints}
        routes={globeRoutes}
        compact
        mapSize={heroAtlasMapSize}
        variant="hero"
        className="hero-traceability-globe"
      />
      <div className="hero-atlas-city-rail" aria-hidden="true">
        {atlasCities.map((point) => (
          <span key={`${point.city}-${point.country || "network"}`}>
            <strong>{point.city}</strong>
            <em>{point.country || "nexID"}</em>
          </span>
        ))}
      </div>
      <div className="hero-map-intel hero-map-intel--atlas">
        <p>{selectedProof.eyebrow}</p>
        <strong>{selectedProof.title}</strong>
        <span>{selectedProof.detail}</span>
      </div>
      <div className="hero-route-proof-steps hero-route-proof-steps--atlas" aria-label="Evidencia de ruta">
        {proofSteps.map((step) => (
          <button
            key={step.eyebrow}
            className={`hero-route-proof-step hero-route-proof-step--${step.tone}`}
            type="button"
            aria-label={`${step.title}: ${step.detail}`}
            title={`${step.title}: ${step.detail}`}
            onMouseEnter={() => setRouteHover(step)}
            onFocus={() => setRouteHover(step)}
            onMouseLeave={() => setRouteHover(null)}
            onBlur={() => setRouteHover(null)}
          >
            <small>{step.eyebrow}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function HeroEnterpriseTraceMap({
  origin,
  tap,
  distance,
  numberLocale,
  txt,
  stageCopy,
}: {
  origin: LocationPoint;
  tap: LocationPoint;
  distance: number;
  numberLocale: string;
  txt: Pick<(typeof labels)["es-AR"], "routeTitle" | "originMap" | "tapMap" | "custody">;
  stageCopy: (typeof heroStageCopy)["es-AR"];
}) {
  const formattedDistance = distance.toLocaleString(numberLocale);
  const evidenceCopy = txt.routeTitle === "Trust route"
    ? `${formattedDistance} km with physical tap, SUN and channel evidence.`
    : txt.routeTitle.startsWith("Rota")
      ? `${formattedDistance} km com evidencia de toque, SUN e canal.`
      : `${formattedDistance} km con evidencia de tap fisico, SUN y canal.`;
  const [routeHover, setRouteHover] = useState<HeroRouteHover | null>(null);

  const custodyStops = useMemo<VectorMapPoint[]>(() => {
    const base: VectorMapPoint[] = [
      {
        id: "origin",
        label: origin.city,
        sublabel: origin.country,
        lat: origin.lat,
        lng: origin.lng,
        scans: 1,
        risk: 0,
        tone: "origin",
        stageLabel: txt.originMap,
        evidence: txt.custody,
      },
      {
        id: "custody-miami",
        label: "Miami",
        sublabel: "USA",
        lat: 25.7617,
        lng: -80.1918,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: "Custodia",
        evidence: "Centro de distribucion",
      },
      {
        id: "custody-madrid",
        label: "Madrid",
        sublabel: "Espana",
        lat: 40.4168,
        lng: -3.7038,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: "Custodia",
        evidence: "Control documental",
      },
      {
        id: "custody-singapore",
        label: "Singapur",
        sublabel: "SGP",
        lat: 1.3521,
        lng: 103.8198,
        scans: 1,
        risk: 0,
        tone: "hub",
        stageLabel: "Custodia",
        evidence: "Canal de exportacion",
      },
      {
        id: "tap",
        label: tap.city,
        sublabel: tap.country,
        lat: tap.lat,
        lng: tap.lng,
        scans: 1,
        risk: 0,
        tone: "tap",
        stageLabel: stageCopy.tapFinal,
        evidence: tap.label,
        lastSeen: stageCopy.demoEvent,
      },
    ];

    return base.filter((point, index, all) => all.findIndex((item) => Math.abs(item.lat - point.lat) < 0.01 && Math.abs(item.lng - point.lng) < 0.01) === index);
  }, [origin, stageCopy.demoEvent, stageCopy.tapFinal, tap, txt.custody, txt.originMap]);

  const vectorRoutes = useMemo<VectorMapRoute[]>(() => custodyStops.slice(1).map((stop, index) => {
    const previous = custodyStops[index];
    const isFinal = stop.id === "tap";
    return {
      id: `route-${previous.id}-${stop.id}`,
      fromLat: previous.lat,
      fromLng: previous.lng,
      toLat: stop.lat,
      toLng: stop.lng,
      label: `${previous.label} -> ${stop.label}`,
      tone: isFinal ? "success" : "info",
      distanceLabel: isFinal ? `${formattedDistance} km` : undefined,
      evidence: isFinal ? evidenceCopy : stop.evidence,
    };
  }), [custodyStops, evidenceCopy, formattedDistance]);

  const ledgerItems = useMemo<VectorMapLedgerItem[]>(() => [
    { id: "integrity", label: stageCopy.integrity, value: stageCopy.verified, detail: evidenceCopy, tone: "loyalty" },
    { id: "events", label: stageCopy.events, value: `${custodyStops.length}/${custodyStops.length}`, detail: `${formattedDistance} km`, tone: "tap" },
    { id: "alerts", label: stageCopy.alerts, value: "0", detail: "Sin alertas en esta lectura demo", tone: "origin" },
  ], [custodyStops.length, evidenceCopy, formattedDistance, stageCopy.alerts, stageCopy.events, stageCopy.integrity, stageCopy.verified]);

  const proofSteps: HeroRouteHover[] = [
    { eyebrow: "01", title: txt.originMap, detail: `${origin.city} - ${origin.country}`, tone: "origin" },
    { eyebrow: "02", title: "SUN / UID", detail: "Evidencia firmada por lectura", tone: "route" },
    { eyebrow: "03", title: stageCopy.tapFinal, detail: `${tap.city} - ${tap.label}`, tone: "tap" },
    { eyebrow: "04", title: "CRM", detail: "Beneficio, garantia y recompra", tone: "crm" },
  ];
  const selectedProof = routeHover || proofSteps[0];
  const timelineStops = custodyStops.map((stop, index) => ({
    ...stop,
    title: index === 0 ? txt.originMap : stop.id === "tap" ? stageCopy.tapFinal : stop.stageLabel || "Custodia",
    date: index === 0 ? "12 ENE 08:15" : index === 1 ? "15 ENE 14:22" : index === 2 ? "19 ENE 09:10" : index === 3 ? "22 ENE 12:45" : "24 ENE 18:33",
  }));

  return (
    <div id="trace-signal-atlas" className="hero-trace-map hero-trace-map--atlas hero-live-route-card" aria-label={txt.routeTitle}>
      <div className="hero-live-route-card__head">
        <div>
          <strong>{stageCopy.routeTitle}</strong>
          <span>{stageCopy.routeSubtitle}</span>
        </div>
        <em><i />{stageCopy.live}</em>
      </div>

      <div className="hero-route-vector-atlas" aria-hidden="true">
        <HeroTrustAtlasSvg
          points={custodyStops}
          routes={vectorRoutes}
          selectedPointId="tap"
        />
      </div>

      <div className="hero-map-intel hero-map-intel--atlas">
        <p>{selectedProof.eyebrow}</p>
        <strong>{selectedProof.title}</strong>
        <span>{selectedProof.detail}</span>
      </div>

      <div className="hero-route-proof-steps hero-route-proof-steps--atlas" aria-label="Evidencia de ruta">
        {proofSteps.map((step) => (
          <button
            key={step.eyebrow}
            className={`hero-route-proof-step hero-route-proof-step--${step.tone}`}
            type="button"
            aria-label={`${step.title}: ${step.detail}`}
            title={`${step.title}: ${step.detail}`}
            onMouseEnter={() => setRouteHover(step)}
            onFocus={() => setRouteHover(step)}
            onMouseLeave={() => setRouteHover(null)}
            onBlur={() => setRouteHover(null)}
          >
            <small>{step.eyebrow}</small>
          </button>
        ))}
      </div>

      <div className="hero-custody-timeline">
        <div className="hero-custody-timeline__head">
          <strong>{stageCopy.custodyTitle}</strong>
          <span>{custodyStops.length} eventos</span>
        </div>
        <div className="hero-custody-timeline__rail">
          {timelineStops.map((stop) => (
            <article key={stop.id} className={stop.id === "tap" ? "is-final" : ""}>
              <i>{stop.id === "tap" ? "" : "✓"}</i>
              <span>{stop.title}</span>
              <strong>{stop.label}</strong>
              <em>{stop.sublabel}</em>
              <small>{stop.date}</small>
            </article>
          ))}
        </div>
      </div>

      <div className="hero-atlas-status-row">
        {ledgerItems.map((item) => (
          <span key={item.id}>
            <em>{item.label}</em>
            <strong>{item.value}</strong>
          </span>
        ))}
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
  seeds: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#84cc16" },
  bracelet: { kind: "bracelet", seal: "VIP", detail: "UID OK", accent: "#2dd4bf" },
  pharma: { kind: "perfume", seal: "AUTH", detail: "LOTE OK", accent: "#38bdf8" },
  perfume: { kind: "perfume", seal: "AUTH", detail: "LOTE OK", accent: "#a78bfa" },
  wine: { kind: "wine", seal: "NFC TT", detail: "SUN OK", accent: "#22d3ee" },
  bottle: { kind: "wine", seal: "NFC QR", detail: "RETORNO", accent: "#38bdf8" },
  luxury: { kind: "bracelet", seal: "LUJO", detail: "OWNER", accent: "#c084fc" },
  sneaker: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#a78bfa" },
  logistics: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#a3e635" },
  electronics: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#818cf8" },
  textile: { kind: "bracelet", seal: "DROP", detail: "OWNER", accent: "#64748b" },
};

const heroRealAssets: Record<Vertical, {
  imageUrl: string;
  imageLightUrl: string;
  alt: string;
  bank: string;
  sourceLabel: string;
  sourceUrl: string;
}> = {
  seeds: {
    imageUrl: "/sdk/verticals/agro-nfc-qr-traceability.webp",
    imageLightUrl: "/sdk/verticals/light/premium-agro-light.webp",
    alt: "Bolsa de semillas de Agro & Alimentos con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  bracelet: {
    imageUrl: "/sdk/verticals/events-nfc-qr-access.webp",
    imageLightUrl: "/sdk/verticals/light/premium-events-light.webp",
    alt: "Brazalete y app de Eventos & Tickets con tags NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  pharma: {
    imageUrl: "/sdk/pharma-authentication-pack.webp",
    imageLightUrl: "/sdk/verticals/light/premium-pharma-agro-light.webp",
    alt: "Envase de medicamento y app de Pharma & Salud con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  perfume: {
    imageUrl: "/sdk/verticals/cosmetics-nfc-qr-tamper.webp",
    imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp",
    alt: "Envase de perfume premium de Belleza & Cosmética con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  wine: {
    imageUrl: "/sdk/verticals/wine-spirits-424-tt.png",
    imageLightUrl: "/sdk/verticals/light/premium-wine-light.webp",
    alt: "Botella premium de Vinos & Spirits con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  bottle: {
    imageUrl: "/sdk/verticals/beverages-bottle-nfc-qr.png",
    imageLightUrl: "/sdk/verticals/light/premium-wine-light.webp",
    alt: "Botella de bebida y refresco con tag NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  luxury: {
    imageUrl: "/sdk/verticals/luxury-nfc-qr-tamper.webp",
    imageLightUrl: "/sdk/verticals/light/premium-beauty-light.webp",
    alt: "Caja y tarjeta premium de Retail & Lujo con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  sneaker: {
    imageUrl: "/sdk/verticals/sneaker-nfc-qr-tamper.png",
    imageLightUrl: "/sdk/verticals/light/premium-sneaker-light.webp",
    alt: "Zapatillas premium de colección con chip NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  logistics: {
    imageUrl: "/sdk/verticals/logistics-uhf-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-logistics-light.webp",
    alt: "Cajas de Logística & Cadena de Frío con tags UHF/NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  electronics: {
    imageUrl: "/sdk/verticals/electronics-warranty-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-electronics-light.webp",
    alt: "Dispositivo electrónico con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  textile: {
    imageUrl: "/sdk/verticals/textile-dpp-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-textile-light.webp",
    alt: "Prenda de vestir y pasaporte digital textil con tag NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
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
  const threeActive: any = active === "pharma" ? "cosmetics" : active;

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
  if (active === "bracelet") return [86, 78, 84];
  if (active === "pharma") return [97, distanceScore, 94];
  if (active === "perfume") return [95, 82, 88];
  if (active === "seeds") return [92, 85, 90];
  if (active === "sneaker") return [96, 84, 93];
  if (active === "logistics") return [89, 79, 87];
  if (active === "electronics") return [94, 80, 89];
  if (active === "textile") return [95, 86, 92];
  return [90, 80, 90];
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
  txt,
  detailCopy,
  stageCopy,
}: {
  active: Vertical;
  data: Scene;
  txt: Pick<(typeof labels)["es-AR"], "assetBank" | "realAsset" | "renderFallback" | "evidenceChart" | "metrics" | "phoneLabel" | "labels">;
  detailCopy: (typeof productModalCopy)["es-AR"];
  stageCopy: (typeof heroStageCopy)["es-AR"];
}) {
  const asset = heroRealAssets[active];
  const recordRows = [
    { label: txt.labels.batch, value: data.batch },
    { label: stageCopy.bottle, value: data.uid },
    { label: stageCopy.productType, value: data.security },
  ];

  return (
    <article className={`hero-identity-card hero-identity-card--${active}`}>
      <span className="hero-identity-card__eyebrow">{stageCopy.identityTitle}</span>
      <div className="hero-identity-card__media">
        {asset ? (
          <img className="hero-real-asset" src={asset.imageUrl} alt={asset.alt} loading="eager" />
        ) : (
          <HeroProductVisual active={active} product={data.product} />
        )}
        <span className="hero-identity-card__chip">
          <strong>nexID</strong>
          <em>{data.profile}</em>
        </span>
        <span className="hero-identity-card__nfc">NFC</span>
      </div>

      <div className="hero-identity-card__body">
        <span>{asset ? txt.realAsset : txt.renderFallback}</span>
        <h3>{data.product}</h3>
        <p>{data.origin.city} - {data.origin.country}</p>
        <div className="hero-identity-card__records">
          {recordRows.map((row) => (
            <span key={row.label}>
              <em>{row.label}</em>
              <strong>{row.value}</strong>
            </span>
          ))}
        </div>
        <span className="hero-identity-card__cta">
          <Maximize2 className="h-4 w-4" />
          <strong>{detailCopy.open}</strong>
          <em>{stageCopy.detailHint}</em>
        </span>
      </div>
    </article>
  );
}

function HeroPhoneEmulator({
  active,
  data,
  distance,
  numberLocale,
  copy,
  model,
  tap,
  stageCopy,
  originLabel,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  copy: (typeof productModalCopy)["es-AR"];
  model: "iphone" | "samsung";
  tap: LocationPoint;
  stageCopy: (typeof heroStageCopy)["es-AR"];
  originLabel: string;
}) {
  const asset = heroRealAssets[active];
  const productOrigin = `${data.origin.city}, ${data.origin.country}`;
  const tapLabel = `${tap.city}, ${tap.country}`;

  return (
    <article className={`hero-consumer-device hero-consumer-device--${model}`}>
      <div className="hero-consumer-device__frame">
        <div className="hero-consumer-device__screen">
          <header className="hero-consumer-device__status">
            <span>9:41</span>
            <strong>nexID</strong>
            <i />
          </header>

          <section className="hero-consumer-verdict" aria-label={copy.trustedTap}>
            <span className="hero-consumer-verdict__shield">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <div>
              <em>{stageCopy.cellularState}</em>
              <strong>{data.result}</strong>
              <small>{data.security}</small>
            </div>
          </section>

          <section className="hero-consumer-product">
            <span>
              {asset ? <img src={asset.imageUrl} alt="" loading="lazy" /> : <HeroProductVisual active={active} product={data.product} />}
            </span>
            <div>
              <strong>{data.product}</strong>
              <em>{productOrigin}</em>
              <small>{distance.toLocaleString(numberLocale)} km</small>
            </div>
          </section>

          <dl className="hero-consumer-specs">
            <div>
              <dt>{copy.productTitle}</dt>
              <dd>{data.product}</dd>
            </div>
            <div>
              <dt>{originLabel}</dt>
              <dd>{productOrigin}</dd>
            </div>
            <div>
              <dt>Lote</dt>
              <dd>{data.batch}</dd>
            </div>
            <div>
              <dt>Tap</dt>
              <dd>{tapLabel}</dd>
            </div>
            <div>
              <dt>{stageCopy.demoEvent}</dt>
              <dd>{data.phoneTag}</dd>
            </div>
          </dl>

          <p className="hero-consumer-note">{copy.phoneNote}</p>
        </div>
      </div>
    </article>
  );
}

function EnterpriseHeroProductCard({
  active,
  data,
  txt,
  detailCopy,
  stageCopy,
}: {
  active: Vertical;
  data: Scene;
  txt: Pick<(typeof labels)["es-AR"], "realAsset" | "renderFallback" | "labels">;
  detailCopy: (typeof productModalCopy)["es-AR"];
  stageCopy: (typeof heroStageCopy)["es-AR"];
}) {
  const asset = heroRealAssets[active];
  const recordRows = [
    { label: txt.labels.batch, value: data.batch },
    { label: stageCopy.bottle, value: data.uid },
    { label: stageCopy.productType, value: data.security },
  ];

  return (
    <article className={`nexid-hero-product-card nexid-hero-product-card--${active}`}>
      <span className="nexid-hero-product-card__eyebrow">{stageCopy.identityTitle}</span>
      <div className="nexid-hero-product-card__media">
        {asset ? (
          <>
            <img className="nexid-hero-product-card__photo nexid-premium-image--dark" src={asset.imageUrl} alt={asset.alt} loading="eager" />
            <img className="nexid-hero-product-card__photo nexid-premium-image--light" src={asset.imageLightUrl} alt={asset.alt} loading="eager" />
            <div className="nexid-hero-product-card__light-render" aria-hidden="true">
              <HeroPrimeProduct active={active} product={data.product} />
            </div>
          </>
        ) : (
          <HeroProductVisual active={active} product={data.product} />
        )}
        <span className="nexid-hero-product-card__chip">
          <strong>nexID</strong>
          <em>{data.profile}</em>
        </span>
      </div>

      <div className="nexid-hero-product-card__body">
        <span>{asset ? txt.realAsset : txt.renderFallback}</span>
        <h3>{data.product}</h3>
        <p>{data.origin.city} · {data.origin.country}</p>
        <div className="nexid-hero-product-card__records">
          {recordRows.map((row) => (
            <span key={row.label}>
              <em>{row.label}</em>
              <strong>{row.value}</strong>
            </span>
          ))}
        </div>
        <span className="nexid-hero-product-card__cta">
          <Maximize2 className="h-4 w-4" />
          <strong>{detailCopy.open}</strong>
          <em>{stageCopy.detailHint}</em>
        </span>
      </div>
    </article>
  );
}

function EnterpriseHeroPhoneDemo({
  active,
  data,
  distance,
  numberLocale,
  copy,
  model,
  tap,
  stageCopy,
  originLabel,
  distanceLabel,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  copy: (typeof productModalCopy)["es-AR"];
  model: "iphone" | "samsung";
  tap: LocationPoint;
  stageCopy: (typeof heroStageCopy)["es-AR"];
  originLabel: string;
  distanceLabel: string;
}) {
  const asset = heroRealAssets[active];
  const productOrigin = `${data.origin.city}, ${data.origin.country}`;
  const tapLabel = `${tap.city}, ${tap.country}`;

  return (
    <aside className="nexid-hero-phone-panel" aria-label={stageCopy.consumerTitle}>
      <div className="nexid-hero-phone-panel__head">
        <span>{stageCopy.consumerTitle}</span>
        <strong>{stageCopy.cellularState}</strong>
      </div>

      <article className={`nexid-hero-phone nexid-hero-phone--${model}`}>
        <div className="nexid-hero-phone__screen">
          <header className="nexid-hero-phone__status">
            <span>9:41</span>
            <strong>nex<span>ID</span></strong>
            <i />
          </header>

          <section className="nexid-hero-phone__verdict">
            <span className="nexid-hero-phone__shield">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <div>
              <em>{stageCopy.cellularState}</em>
              <strong>{data.result}</strong>
              <small>{data.security}</small>
            </div>
          </section>

          <section className="nexid-hero-phone__product">
            <span>
              {asset ? (
                <>
                  <img className="nexid-hero-phone__product-photo nexid-premium-image--dark" src={asset.imageUrl} alt="" loading="lazy" />
                  <img className="nexid-hero-phone__product-photo nexid-premium-image--light" src={asset.imageLightUrl} alt="" loading="lazy" />
                  <span className="nexid-hero-phone__product-light" aria-hidden="true">
                    <HeroPrimeProduct active={active} product={data.product} />
                  </span>
                </>
              ) : (
                <HeroProductVisual active={active} product={data.product} />
              )}
            </span>
            <div>
              <strong>{data.product}</strong>
              <em>{productOrigin}</em>
              <small>{data.batch}</small>
            </div>
          </section>

          <dl className="nexid-hero-phone__specs">
            <div>
              <dt>{copy.productTitle}</dt>
              <dd>{data.product}</dd>
            </div>
            <div>
              <dt>{originLabel}</dt>
              <dd>{productOrigin}</dd>
            </div>
            <div>
              <dt>Tap</dt>
              <dd>{tapLabel}</dd>
            </div>
            <div>
              <dt>{distanceLabel}</dt>
              <dd>{distance.toLocaleString(numberLocale)} km</dd>
            </div>
          </dl>

          <div className="nexid-hero-phone__scan" aria-hidden="true">
            <span />
            <i />
            <em />
          </div>

          <p className="nexid-hero-phone__note">{copy.phoneNote}</p>
        </div>
      </article>
    </aside>
  );
}

function ProductDetailModal({
  active,
  data,
  distance,
  numberLocale,
  proofRows,
  commerceRows,
  copy,
  onClose,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  proofRows: ProductInfoRow[];
  commerceRows: ProductInfoRow[];
  copy: (typeof productModalCopy)["es-AR"];
  onClose: () => void;
}) {
  const asset = heroRealAssets[active];
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="hero-product-modal" role="dialog" aria-modal="true" aria-labelledby="hero-product-modal-title">
      <button className="hero-product-modal__backdrop" type="button" aria-label={copy.close} onClick={onClose} />
      <div className="hero-product-modal__panel">
        <div className="hero-product-modal__header">
          <div>
            <p>{copy.operatorTitle}</p>
            <h3 id="hero-product-modal-title">{copy.title}</h3>
            <span>{copy.subtitle}</span>
          </div>
          <button ref={closeButtonRef} className="hero-product-modal__close" type="button" onClick={onClose} aria-label={copy.close}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="hero-product-modal__grid">
          <section className="hero-product-modal__product" aria-label={copy.consumerTitle}>
            <div className="hero-product-modal__section-head">
              <CheckCircle2 className="h-4 w-4" />
              <span>{copy.consumerTitle}</span>
            </div>
            <div className={`hero-product-modal__asset hero-product-modal__asset--${active}`}>
              {asset ? (
                <>
                  <img className="hero-product-modal__asset-photo nexid-premium-image--dark" src={asset.imageUrl} alt={asset.alt} loading="lazy" />
                  <img className="hero-product-modal__asset-photo nexid-premium-image--light" src={asset.imageLightUrl} alt={asset.alt} loading="lazy" />
                  <div className="hero-product-modal__asset-light-render" aria-hidden="true">
                    <HeroPrimeProduct active={active} product={data.product} />
                  </div>
                </>
              ) : (
                <HeroProductVisual active={active} product={data.product} />
              )}
              <div className="hero-product-modal__asset-caption">
                <span>{data.profile}</span>
                <strong>{data.product}</strong>
                <em>{data.batch}</em>
              </div>
            </div>
            <div className="hero-product-modal__summary">
              <strong>{data.result}</strong>
              <p>{data.action}</p>
              <span>{distance.toLocaleString(numberLocale)} km · {data.origin.city} → {data.nextAction}</span>
            </div>
          </section>

          <section className="hero-product-modal__records">
            <div className="hero-product-modal__state">
              <span>{copy.state}</span>
              <strong>{data.result}</strong>
              <em>{data.profile}</em>
            </div>

            <div className="hero-product-modal__record-block">
              <h4>{copy.proofTitle}</h4>
              <div>
                {proofRows.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>

            <div className="hero-product-modal__record-block">
              <h4>{copy.commerceTitle}</h4>
              <div>
                {commerceRows.map((item) => (
                  <article key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function HeroScene({ locale }: { locale: AppLocale }) {
  const [selectedVertical, setSelectedVertical] = useState<HeroSelectorKey>("wine");
  const [tapIndex, setTapIndex] = useState(0);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const productTriggerRef = useRef<HTMLDivElement>(null);
  const txt = labels[locale] || labels["es-AR"];
  const modalCopy = productModalCopy[locale] || productModalCopy["es-AR"];
  const stageCopy = heroStageCopy[locale] || heroStageCopy["es-AR"];
  const active = selectedVertical;
  const data = useMemo(() => txt.items[active], [txt, active]);
  const tap = tapLocations[tapIndex % tapLocations.length];
  const distance = haversineKm(data.origin, tap);
  const numberLocale = localeName(locale);

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    window.setTimeout(() => productTriggerRef.current?.focus(), 0);
  };

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
      <div className="hero-scene hero-scene--product-proof rounded-2xl border border-white/10 p-4 md:p-5">
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

        <div className="nexid-hero-board mt-4">
          <EnterpriseHeroAtlasPanel origin={data.origin} tap={tap} distance={distance} numberLocale={numberLocale} txt={txt} stageCopy={stageCopy} />
          <div
            suppressHydrationWarning
            ref={productTriggerRef}
            role="button"
            tabIndex={0}
            className="nexid-hero-product-trigger"
            aria-label={`${modalCopy.open}: ${data.product}`}
            onClick={() => setIsProductModalOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setIsProductModalOpen(true);
              }
            }}
          >
            <EnterpriseHeroProductCard
              active={active}
              data={data}
              txt={txt}
              detailCopy={modalCopy}
              stageCopy={stageCopy}
            />
          </div>
          <EnterpriseHeroPhoneDemo
            active={active}
            data={data}
            distance={distance}
            numberLocale={numberLocale}
            copy={modalCopy}
            model={active === "electronics" || active === "logistics" || active === "seeds" ? "samsung" : "iphone"}
            tap={tap}
            stageCopy={stageCopy}
            originLabel={txt.labels.origin}
            distanceLabel={txt.labels.distance}
          />
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
      {isProductModalOpen && typeof document !== "undefined"
        ? createPortal(
            <ProductDetailModal
              active={active}
              data={data}
              distance={distance}
              numberLocale={numberLocale}
              proofRows={proofRows}
              commerceRows={commerceRows}
              copy={modalCopy}
              onClose={closeProductModal}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
