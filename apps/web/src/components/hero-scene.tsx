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
const featuredHeroVerticals: HeroSelectorKey[] = ["seeds", "pharma", "wine", "sneaker"];

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
    subtitle: "Escenario ilustrativo con producto, lote, recorrido declarado y próxima acción. No prueba el producto físico.",
    consumerTitle: "Ficha de producto",
    operatorTitle: "Registro premium",
    proofTitle: "Información disponible",
    commerceTitle: "Próximas acciones",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "Estado",
    trustedTap: "Consulta segura simulada",
    productTitle: "Producto físico",
    productSubtitle: "Abrí la ficha completa",
    livePhoneTitle: "Vista simulada en celular",
    phoneNote: "La demostración muestra información y reglas configuradas. No confirma por sí sola el contenido, el origen físico, la custodia ni la titularidad.",
  },
  "pt-BR": {
    open: "Ampliar ficha",
    close: "Fechar",
    title: "Ficha completa do produto",
    subtitle: "Cenário ilustrativo com produto, lote e rota declarados, resultado SUN/TT simulado e próxima ação comercial. Não comprova o ativo físico.",
    consumerTitle: "Ficha do produto",
    operatorTitle: "Registro premium",
    proofTitle: "Evidencia tecnica",
    commerceTitle: "Acoes pos-toque",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "Estado",
    trustedTap: "Leitura SUN simulada",
    productTitle: "Ativo fisico",
    productSubtitle: "Clique para abrir ficha completa",
    livePhoneTitle: "Demo mobile simulada",
    phoneNote: "A demo representa uma mensagem SUN e, quando aplicável, um estado TT informado. Não confirma autenticidade física, conteúdo, origem, custódia ou propriedade.",
  },
  en: {
    open: "Open product detail",
    close: "Close",
    title: "Complete product detail",
    subtitle: "Illustrative scenario with declared product, batch and route, simulated SUN/TT result and a commercial next step. It does not prove the physical asset.",
    consumerTitle: "Product record",
    operatorTitle: "Premium record",
    proofTitle: "Technical evidence",
    commerceTitle: "Post-tap actions",
    iphone: "iPhone",
    samsung: "Samsung",
    state: "State",
    trustedTap: "Simulated SUN read",
    productTitle: "Physical asset",
    productSubtitle: "Click to open full detail",
    livePhoneTitle: "Simulated phone demo",
    phoneNote: "The demo represents a SUN message and, when applicable, a reported TT state. It does not confirm physical authenticity, contents, origin, custody or ownership.",
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
    identityTitle: "IDENTIDAD DIGITAL SIMULADA",
    consumerTitle: "CONSULTA DEL PRODUCTO",
    routeTitle: "RECORRIDO ILUSTRATIVO",
    routeSubtitle: "Recorrido ilustrativo; no prueba custodia",
    live: "Simulación",
    custodyTitle: "HITOS DECLARADOS",
    integrity: "Estado de la ruta",
    verified: "simulada",
    events: "Eventos",
    alerts: "Alertas",
    clickHint: "Hacé click para abrir la ficha completa en una vista centrada",
    detailHint: "Ver detalle completo del producto",
    cellularState: "SALIDA CELULAR",
    productType: "Tipo",
    bottle: "Unidad",
    tapFinal: "Consulta final",
    demoEvent: "Consulta ilustrativa",
  },
  "pt-BR": {
    identityTitle: "IDENTIDADE DIGITAL SIMULADA",
    consumerTitle: "TOQUE FINAL (CONSUMIDOR)",
    routeTitle: "ROTA DECLARADA · DEMO",
    routeSubtitle: "Percurso ilustrativo; não comprova custódia",
    live: "Simulação",
    custodyTitle: "MARCOS DECLARADOS",
    integrity: "Estado da rota",
    verified: "simulada",
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
    identityTitle: "SIMULATED DIGITAL IDENTITY",
    consumerTitle: "FINAL TAP (CONSUMER)",
    routeTitle: "DECLARED ROUTE · DEMO",
    routeSubtitle: "Illustrative journey; no custody proof",
    live: "Simulation",
    custodyTitle: "DECLARED MILESTONES",
    integrity: "Route state",
    verified: "simulated",
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
  { city: "Sydney", country: "Australia", label: "consulta de consumidor", lat: -33.8688, lng: 151.2093 },
  { city: "Buenos Aires", country: "Argentina", label: "miembro del club", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", label: "comprador en tienda", lat: -33.4489, lng: -70.6693 },
  { city: "São Paulo", country: "Brasil", label: "distribuidor del escenario", lat: -23.5558, lng: -46.6396 },
  { city: "Miami", country: "Estados Unidos", label: "distribuidor de exportación", lat: 25.7617, lng: -80.1918 },
  { city: "Zúrich", country: "Suiza", label: "comprador del escenario", lat: 47.3769, lng: 8.5417 },
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
    selectorTitle: "Elegí un rubro",
    microcopy: "Escenario ilustrativo: muestra la información disponible y orienta el próximo paso; no prueba por sí solo el producto físico ni su recorrido.",
    commercialRail: "Próximos pasos disponibles después de la consulta",
    valuePills: ["Club", "Puntos", "Garantía", "Aviso al equipo", "Tienda", "Certificado opcional"],
    ctaBands: ["Bodegas", "Eventos", "Cosmética", "Agro", "Moda", "Salud"],
    phoneLabel: "Vista en celular",
    swapTap: "Cambiar consulta",
    liveTap: "Consulta simulada",
    whatHappened: "Qué está pasando",
    routeTitle: "Ruta demo declarada",
    originMap: "Origen declarado",
    tapMap: "Consulta simulada",
    openOriginMap: "Ver punto declarado en Maps",
    custody: "Ruta y distancia simuladas; no constituyen evidencia de custodia.",
    assetBank: "Banco visual",
    realAsset: "Foto de referencia",
    renderFallback: "Render interactivo",
    evidenceChart: "Indicadores simulados",
    labels: {
      product: "Producto",
      origin: "Origen declarado",
      tap: "Consulta simulada",
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
      authenticity: "Información observada",
      traceability: "Ruta simulada",
      commercial: "Próximo paso",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "Código o etiqueta inteligente",
        action: "Escenario de campo: consulta un identificador y datos de lote declarados; no prueba contenido, origen ni custodia.",
        result: "Identificador demo leído",
        product: "Semilla premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "Identificador simulado + historial declarado",
        nextAction: "Ficha técnica, asistencia y consulta",
        marketplace: "Reposición, asesor técnico y cupón rural",
        loyalty: "Asistencia técnica, reposición y beneficios por lote",
        businessValue: "Seguimiento + asistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - ID_DEMO",
        steps: ["Lectura simulada", "Consulta lote declarado", "Muestra ruta demo", "Ofrece soporte"],
      },
      bracelet: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulsera VIP escaneada en puerta: UID serializado y regla del servidor.",
        result: "Regla de acceso simulada",
        product: "Pulsera VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID demo + regla de acceso simulada",
        nextAction: "Beneficio backstage o mejora de entrada",
        marketplace: "Promos de barra, merch y reventa controlada",
        loyalty: "Puntos por asistencia, mejoras y merch",
        businessValue: "Control de acceso + datos de audiencia + ingresos post-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENTO - ACCESS_DEMO",
        steps: ["Toque simulado", "Consulta UID demo", "Representa check-in", "Muestra beneficio posible"],
      },
      pharma: {
        label: "Salud",
        profile: "Envase identificado",
        action: "Escenario farmacéutico: consulta información declarada del lote y avisos aprobados; no valida la composición ni el estado sanitario.",
        result: "Información del envase consultada",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "Consulta segura + información declarada del lote",
        nextAction: "Ver prospecto digital o reporte de lote",
        marketplace: "Canal de farmacia + asistencia",
        loyalty: "Prospecto declarado, soporte y recordatorios configurables",
        businessValue: "Revisión de lote + alertas + canal directo",
        objectClass: "pharma-demo scanning",
        phoneTag: "SALUD - DEMOSTRACIÓN",
        steps: ["Lectura simulada", "Consulta el identificador", "Revisa avisos declarados", "Abre el prospecto"],
      },
      perfume: {
        label: "Cosmética",
        profile: "NTAG 424 DNA",
        action: "Escenario cosmético: representa un mensaje SUN asociado a lote y garantía declarados; no prueba el envase ni su contenido.",
        result: "Mensaje SUN simulado",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "Resultado SUN demo + lote declarado",
        nextAction: "Registro de garantía y recompra",
        marketplace: "Venta cruzada, muestras y beneficios",
        loyalty: "Garantía, muestras y recompra",
        businessValue: "Señales de riesgo + datos propios + venta cruzada",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - SUN_DEMO",
        steps: ["Toque simulado", "Representa mensaje SUN", "Muestra lote declarado", "Ofrece registro de garantía"],
      },
      wine: {
        label: "Vino",
        profile: "Etiqueta inteligente segura",
        action: "Escenario de bodega: consulta la información de la botella y un sello informado como abierto; no prueba el contenido.",
        result: "Consulta válida · sello informado como abierto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "bodega", lat: -33.6131, lng: -69.2075 },
        security: "Consulta segura + estado informado del sello",
        nextAction: "Club, garantía o solicitud de propiedad con evidencia adicional",
        marketplace: "Beneficio posterior a la compra + historial de colección",
        loyalty: "Puntos, club de cosecha, beneficio y recompra premium",
        businessValue: "Canal directo + tienda + certificado opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "VINO - DEMOSTRACIÓN",
        steps: ["Lectura simulada", "Consulta el identificador", "Muestra el estado informado", "Presenta club y tienda"],
      },
      sneaker: {
        label: "Zapatillas",
        profile: "Etiqueta inteligente segura",
        action: "Escenario de edición limitada: consulta identificador, serie y beneficios declarados; la titularidad y la pieza física requieren validación adicional.",
        result: "Identidad digital simulada",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "estudio de diseño", lat: -34.5875, lng: -58.3974 },
        security: "Consulta segura + identificador declarado",
        nextAction: "Solicitar titularidad, garantía o reventa con evidencia",
        marketplace: "Edición exclusiva, reventa controlada y beneficios de comunidad",
        loyalty: "Acceso a lanzamientos, puntos y certificado de colección",
        businessValue: "Señales de riesgo + titularidad digital + canal de reventa",
        objectClass: "sneaker-demo scanning",
        phoneTag: "CALZADO - DEMOSTRACIÓN",
        steps: ["Consulta simulada", "Revisa el identificador", "Muestra la serie declarada", "Ofrece iniciar una solicitud"],
      },
      logistics: {
        label: "Logística",
        profile: "UHF + NFC",
        action: "Escenario logístico: muestra temperatura, lote y ruta simulados; no confirma cadena de frío, entrega ni custodia.",
        result: "Telemetría demo disponible",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logístico", lat: -32.8895, lng: -68.8458 },
        security: "Lecturas IoT simuladas + UID demo",
        nextAction: "Ficha de temperatura y auditoría",
        marketplace: "Servicios logísticos premium + seguros de carga",
        loyalty: "Historial de ruta, temperatura promedio y reporte de conformidad",
        businessValue: "Vista operativa demo + gestión de reclamos + control de calidad",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - SENSOR_DEMO",
        steps: ["Lectura simulada", "Muestra temperatura demo", "Dibuja ruta declarada", "Representa recepción"],
      },
      electronics: {
        label: "Electrónica",
        profile: "NFC + QR",
        action: "Escenario electrónico: consulta número de serie y opciones de garantía; no prueba el dispositivo ni transfiere propiedad.",
        result: "Serie declarada consultada",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID demo + registro digital simulado",
        nextAction: "Soporte oficial, registro o reclamo",
        marketplace: "Accesorios oficiales + extensión de garantía",
        loyalty: "Registro de garantía, soporte prioritario y club de upgrades",
        businessValue: "Señales de riesgo para garantía + registro postventa + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - SERIAL_DEMO",
        steps: ["Toque simulado", "Consulta serie declarada", "Ofrece registrar garantía", "Muestra soporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Escenario DPP: muestra origen, materiales y circularidad declarados; el tap no certifica esas afirmaciones ni la prenda.",
        result: "DPP demo consultado",
        product: "Campera Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "España", label: "fábrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Registro DPP demo + UID NFC simulado",
        nextAction: "Ver circularidad declarada o iniciar claim con evidencia",
        marketplace: "Canal de recompra circular + guía de cuidados",
        loyalty: "Acceso a pre-ventas, club de circularidad y descuento por reciclado",
        businessValue: "Preparación DPP + reventa de marca + engagement circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_DEMO",
        steps: ["Lectura simulada", "Consulta DPP demo", "Muestra datos declarados", "Ofrece opciones circulares"],
      },
      luxury: {
        label: "Lujo",
        profile: "NTAG 424 DNA",
        action: "Escenario de lujo: consulta identidad digital, garantía y claim declarados; no prueba el reloj ni su propiedad.",
        result: "Identidad digital simulada",
        product: "Reloj cronógrafo premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "Resultado SUN demo + flujo de claim",
        nextAction: "Solicitar propiedad, garantía, reventa o token con evidencia",
        marketplace: "Beneficios exclusivos, recompra y club de coleccionistas",
        loyalty: "Registro de garantía, acceso VIP y club de coleccionistas",
        businessValue: "Señales de riesgo + reventa gobernada + CRM directo",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - ID_DEMO",
        steps: ["Toque simulado", "Representa mensaje SUN", "Ofrece claim con evidencia", "Muestra club de valor"],
      },
      bottle: {
        label: "Envases refill",
        profile: "NFC + QR",
        action: "Escenario circular: consulta ciclo y retorno declarados; el tap no prueba procedencia, contenido ni devolución física.",
        result: "Evento de retorno simulado",
        product: "Envase Refill Premium",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta embotelladora", lat: -32.9442, lng: -60.6505 },
        security: "GS1/QR + UID NFC opcional + control de ciclo",
        nextAction: "Registrar retorno, refill o impacto circular",
        marketplace: "Recarga, deposito retornable y cupones verdes",
        loyalty: "Descuento por retorno, refill o compra circular",
        businessValue: "Inventario de envases + incentivos ESG + circularidad medible",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_DEMO",
        steps: ["Lectura simulada", "Consulta retorno declarado", "Muestra incentivo posible", "Representa recepción"],
      },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Cenário simulado: a mensagem SUN/UID e o estado TT informado podem orientar o próximo passo; não comprovam o produto físico nem a rota declarada.",
    commercialRail: "Camada comercial ativada depois do toque",
    valuePills: ["Clube VIP", "Pontos", "Garantia", "CRM lead", "Marketplace", "Token opcional"],
    ctaBands: ["Vinhos", "Eventos", "Cosmeticos", "Agro", "Moda", "Pharma"],
    phoneLabel: "Saida mobile",
    swapTap: "Trocar toque",
    liveTap: "Toque simulado",
    whatHappened: "O que acontece",
    routeTitle: "Rota demo declarada",
    originMap: "Origem declarada",
    tapMap: "Toque simulado",
    openOriginMap: "Ver ponto declarado no Maps",
    custody: "Rota e distância simuladas; não constituem prova de custódia.",
    assetBank: "Banco visual",
    realAsset: "Foto de referência",
    renderFallback: "Render interativo",
    evidenceChart: "Indicadores simulados",
    labels: {
      product: "Produto",
      origin: "Origem declarada",
      tap: "Toque simulado",
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
      authenticity: "Mensagem SUN/UID",
      traceability: "Rota simulada",
      commercial: "Pos-toque",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Cenário de campo: consulta identificador e dados de lote declarados; não comprova conteúdo, origem ou custódia.",
        result: "Identificador demo lido",
        product: "Semente premium",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "planta", lat: -32.9442, lng: -60.6505 },
        security: "QR/NFC UID simulado + histórico declarado",
        nextAction: "Ficha tecnica, suporte e reclamo",
        marketplace: "Reposicao, tecnico e cupom rural",
        loyalty: "Suporte tecnico, reposicao e beneficios por lote",
        businessValue: "Rastreabilidade + assistencia + canal rural",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - ID_DEMO",
        steps: ["Leitura simulada", "Consulta lote declarado", "Mostra rota demo", "Oferece suporte"],
      },
      bracelet: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulseira VIP escaneada na porta: UID serializado e regra server-side.",
        result: "Regra de acesso simulada",
        product: "Pulseira VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID demo + regra de acesso simulada",
        nextAction: "Beneficio backstage ou upgrade",
        marketplace: "Promos, merch e revenda controlada",
        loyalty: "Pontos por presenca, upgrades e merch",
        businessValue: "Controle de acesso + dados de audiencia + receita pos-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ACCESS_DEMO",
        steps: ["Toque simulado", "Consulta UID demo", "Representa check-in", "Mostra benefício possível"],
      },
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Cenário farmacêutico: representa mensagem SUN e consulta lote e recall declarados; não valida composição nem condição sanitária.",
        result: "Mensagem SUN simulada",
        product: "Amoxicilina Premium",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "laboratorio", lat: 4.711, lng: -74.0721 },
        security: "Resultado SUN demo + consulta de recall declarada",
        nextAction: "Ver bula digital ou relatorio de lote",
        marketplace: "Canal farmacia + suporte medico",
        loyalty: "Bula declarada, suporte e lembretes configuráveis",
        businessValue: "Auditoria de lote + alerta recall + first party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - SUN_DEMO",
        steps: ["Leitura simulada", "Representa mensagem SUN", "Consulta recall declarado", "Abre bula demo"],
      },
      perfume: {
        label: "Cosmeticos",
        profile: "NTAG 424 DNA",
        action: "Cenário cosmético: representa mensagem SUN associada a lote e garantia declarados; não comprova a embalagem nem seu conteúdo.",
        result: "Mensagem SUN simulada",
        product: "Serum premium",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "laboratorio", lat: -33.4489, lng: -70.6693 },
        security: "Resultado SUN demo + lote declarado",
        nextAction: "Registro de garantia e recompra",
        marketplace: "Cross-sell, amostras e loyalty",
        loyalty: "Garantia, amostras e recompra",
        businessValue: "Sinais de risco + dados próprios + venda cruzada",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - SUN_DEMO",
        steps: ["Toque simulado", "Representa mensagem SUN", "Mostra lote declarado", "Oferece registro de garantia"],
      },
      wine: {
        label: "Vinho",
        profile: "NTAG 424 DNA TT",
        action: "Cenário SUN/TT: representa mensagem válida e lacre informado como aberto; não comprova a garrafa nem seu conteúdo.",
        result: "SUN demo · TT informa aberto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "vinicola", lat: -33.6131, lng: -69.2075 },
        security: "Resultado SUN demo + estado TT informado",
        nextAction: "Clube, garantia ou solicitação de propriedade com evidência adicional",
        marketplace: "Voucher pos-compra + rastreabilidade de colecao",
        loyalty: "320 pts, clube de safra, voucher e recompra premium",
        businessValue: "CRM pos-toque + marketplace + tokenizacao opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - TT_OPEN_DEMO",
        steps: ["Leitura simulada", "Representa mensagem SUN", "TT informa OPENED", "Mostra clube e marketplace"],
      },
      sneaker: {
        label: "Tenis",
        profile: "NTAG 424 DNA",
        action: "Cenário colecionável: consulta UID, raridade e benefícios declarados; propriedade e peça física exigem validação adicional.",
        result: "Identidade digital simulada",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "Resultado SUN demo + UID declarado",
        nextAction: "Solicitar propriedade, garantia, revenda ou token com evidência",
        marketplace: "Drop exclusivo, revenda controlada e beneficios de comunidade",
        loyalty: "Acesso a drops, pontos e certificado de colecao",
        businessValue: "Sinais anticópia + fluxo de ownership + canal de resale",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - ID_DEMO",
        steps: ["Toque simulado", "Representa mensagem SUN", "Mostra raridade declarada", "Oferece fluxo de claim"],
      },
      logistics: {
        label: "Logistica",
        profile: "UHF + NFC",
        action: "Cenário logístico: mostra temperatura, lote e rota simulados; não confirma cadeia de frio, entrega ou custódia.",
        result: "Telemetria demo disponível",
        product: "Pallet Vacunas Co-19",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "centro logistico", lat: -32.8895, lng: -68.8458 },
        security: "Leituras IoT simuladas + UID demo",
        nextAction: "Ficha de temperatura e auditoria",
        marketplace: "Servicos logisticos premium + seguros de carga",
        loyalty: "Historico de rota, temperatura media e relatorio de conformidade",
        businessValue: "Visão operacional demo + gestão de reclamações + controle de qualidade",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - SENSOR_DEMO",
        steps: ["Leitura simulada", "Mostra temperatura demo", "Desenha rota declarada", "Representa recepção"],
      },
      electronics: {
        label: "Eletronica",
        profile: "NFC + QR",
        action: "Cenário eletrônico: consulta número de série e opções de garantia; não comprova o dispositivo nem transfere propriedade.",
        result: "Série declarada consultada",
        product: "Smartwatch Nex-V",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "UID demo + registro digital simulado",
        nextAction: "Suporte oficial, registro ou reclamacao",
        marketplace: "Acessorios oficiais + extensao de garantia",
        loyalty: "Registro de garantia, suporte prioritário e clube de upgrades",
        businessValue: "Sinais de risco para garantia + registro pos-venda + ofertas de upgrade",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - SERIAL_DEMO",
        steps: ["Toque simulado", "Consulta série declarada", "Oferece registro de garantia", "Mostra suporte"],
      },
      textile: {
        label: "Textil",
        profile: "NFC + QR DPP",
        action: "Cenário DPP: mostra origem, materiais e circularidade declarados; o toque não certifica essas afirmações nem a peça.",
        result: "DPP demo consultado",
        product: "Jaqueta Denim Premium",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Espanha", label: "fabrica textil", lat: 40.4168, lng: -3.7038 },
        security: "Registro DPP demo + UID NFC simulado",
        nextAction: "Ver circularidade declarada ou iniciar claim com evidência",
        marketplace: "Canal de recompra circular + guia de cuidados",
        loyalty: "Acesso a pre-vendas, clube de circularidade e desconto por reciclagem",
        businessValue: "Preparação DPP + revenda de marca + engajamento circular",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_DEMO",
        steps: ["Leitura simulada", "Consulta DPP demo", "Mostra dados declarados", "Oferece opções circulares"],
      },
      luxury: {
        label: "Luxo",
        profile: "NTAG 424 DNA",
        action: "Cenário de luxo: consulta identidade digital, garantia e claim declarados; não comprova o relógio nem sua propriedade.",
        result: "Identidade digital simulada",
        product: "Relogio Cronografo Premium",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "Estados Unidos", label: "distribuidora", lat: 25.7617, lng: -80.1918 },
        security: "Resultado SUN demo + fluxo de claim",
        nextAction: "Solicitar propriedade, garantia, revenda ou token com evidência",
        marketplace: "Beneficios exclusivos, recompra e clube de colecionadores",
        loyalty: "Registro de garantia, acesso VIP e clube de colecionadores",
        businessValue: "Sinais de risco + revenda governada + CRM direto",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - ID_DEMO",
        steps: ["Toque simulado", "Representa mensagem SUN", "Oferece claim com evidência", "Mostra clube de valor"],
      },
      bottle: {
        label: "Embalagens refill",
        profile: "NFC + QR",
        action: "Cenário circular: consulta ciclo e retorno declarados; o toque não comprova procedência, conteúdo ou devolução física.",
        result: "Evento de retorno simulado",
        product: "Embalagem Refill Premium",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "planta de engarrafamento", lat: -32.9442, lng: -60.6505 },
        security: "GS1/QR + UID NFC opcional + controle de ciclo",
        nextAction: "Registrar retorno, refill ou impacto circular",
        marketplace: "Recarga, deposito retornavel e cupons verdes",
        loyalty: "Desconto por retorno, refill ou compra circular",
        businessValue: "Inventario de embalagens + incentivos ESG + circularidade mensuravel",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_DEMO",
        steps: ["Leitura simulada", "Consulta retorno declarado", "Mostra incentivo possível", "Representa recepção"],
      },
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "Simulated scenario: the SUN/UID message and reported TT state can guide the next step; they do not prove the physical product or the declared route.",
    commercialRail: "Commercial layer unlocked after the tap",
    valuePills: ["VIP club", "Points", "Warranty", "CRM lead", "Marketplace", "Optional token"],
    ctaBands: ["Wineries", "Events", "Cosmetics", "Agro", "Fashion", "Pharma"],
    phoneLabel: "Mobile output",
    swapTap: "Change tap",
    liveTap: "Simulated tap",
    whatHappened: "What happens",
    routeTitle: "Declared demo route",
    originMap: "Declared origin",
    tapMap: "Simulated tap",
    openOriginMap: "Open declared point in Maps",
    custody: "Route and distance are simulated; they are not custody evidence.",
    assetBank: "Visual bank",
    realAsset: "Reference photo",
    renderFallback: "Interactive render",
    evidenceChart: "Simulated indicators",
    labels: {
      product: "Product",
      origin: "Declared origin",
      tap: "Simulated tap",
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
      authenticity: "SUN/UID message",
      traceability: "Simulated route",
      commercial: "Post-tap",
    },
    items: {
      seeds: {
        label: "Agro",
        profile: "QR + NFC UID",
        action: "Field scenario: looks up an identifier and declared lot data; it does not prove contents, origin or custody.",
        result: "Demo identifier read",
        product: "Premium seed",
        batch: "AG-903",
        uid: "QRF-903-17",
        origin: { city: "Rosario", country: "Argentina", label: "plant", lat: -32.9442, lng: -60.6505 },
        security: "Simulated QR/NFC UID + declared history",
        nextAction: "Technical sheet, support and claim flow",
        marketplace: "Reorder, agronomist support and rural coupon",
        loyalty: "Technical support, reorder and lot benefits",
        businessValue: "Traceability + support + rural channel",
        objectClass: "agro-demo tampered scanning",
        phoneTag: "AGRO - ID_DEMO",
        steps: ["Simulated read", "Look up declared lot", "Show demo route", "Offer support"],
      },
      bracelet: {
        label: "Events",
        profile: "NTAG215",
        action: "VIP wristband scanned at gate: serialized UID and server-side rule.",
        result: "Simulated access rule",
        product: "VIP wristband",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "Demo UID + simulated access rule",
        nextAction: "Backstage perk or ticket upgrade",
        marketplace: "Bar promos, merch and controlled resale",
        loyalty: "Attendance points, upgrades and merch",
        businessValue: "Access control + audience data + post-event revenue",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ACCESS_DEMO",
        steps: ["Simulated tap", "Look up demo UID", "Represent check-in", "Show possible benefit"],
      },
      pharma: {
        label: "Pharma",
        profile: "NTAG 424 DNA",
        action: "Pharma scenario: represents a SUN message and looks up declared batch and recall data; it does not validate composition or medical condition.",
        result: "Simulated SUN message",
        product: "Premium Amoxicillin",
        batch: "PHA-2026-081",
        uid: "04C3****99A4",
        origin: { city: "Bogota", country: "Colombia", label: "lab", lat: 4.711, lng: -74.0721 },
        security: "Demo SUN result + declared recall lookup",
        nextAction: "View digital leaflet or batch audit trail",
        marketplace: "Pharmacy channel + medical support",
        loyalty: "Declared leaflet, support and configurable reminders",
        businessValue: "Batch audit trail + recall alert + first-party CRM",
        objectClass: "pharma-demo scanning",
        phoneTag: "PHARMA - SUN_DEMO",
        steps: ["Simulated read", "Represent SUN message", "Look up declared recall", "Open demo leaflet"],
      },
      perfume: {
        label: "Cosmetics",
        profile: "NTAG 424 DNA",
        action: "Cosmetics scenario: represents a SUN message linked to declared batch and warranty data; it does not prove the package or its contents.",
        result: "Simulated SUN message",
        product: "Premium serum",
        batch: "COS-CS-442",
        uid: "04B2****72C1",
        origin: { city: "Santiago", country: "Chile", label: "lab", lat: -33.4489, lng: -70.6693 },
        security: "Demo SUN result + declared batch",
        nextAction: "Warranty registration and reorder",
        marketplace: "Cross-sell, samples and loyalty",
        loyalty: "Warranty, samples and reorder",
        businessValue: "Risk signals + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - SUN_DEMO",
        steps: ["Simulated tap", "Represent SUN message", "Show declared batch", "Offer warranty registration"],
      },
      wine: {
        label: "Wine",
        profile: "NTAG 424 DNA TT",
        action: "SUN/TT scenario: represents a valid message and a seal reported as opened; it does not prove the bottle or its contents.",
        result: "SUN demo · TT reports opened",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Uco Valley", country: "Argentina", label: "winery", lat: -33.6131, lng: -69.2075 },
        security: "Demo SUN result + reported TT state",
        nextAction: "Club, warranty or ownership request with additional evidence",
        marketplace: "Post-purchase voucher + collectible provenance",
        loyalty: "320 pts, harvest club, voucher and premium reorder",
        businessValue: "Post-tap CRM + marketplace + optional tokenization",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - TT_OPEN_DEMO",
        steps: ["Simulated read", "Represent SUN message", "TT reports OPENED", "Show club and marketplace"],
      },
      sneaker: {
        label: "Sneakers",
        profile: "NTAG 424 DNA",
        action: "Collectible scenario: looks up declared UID, rarity and benefits; ownership and the physical item require additional validation.",
        result: "Simulated digital identity",
        product: "Drop Runner 37Z",
        batch: "SNK-37Z-055",
        uid: "04F1****37Z9",
        origin: { city: "Buenos Aires", country: "Argentina", label: "drop studio", lat: -34.5875, lng: -58.3974 },
        security: "Demo SUN result + declared UID",
        nextAction: "Request ownership, warranty, resale or token with evidence",
        marketplace: "Exclusive drop, controlled resale and community benefits",
        loyalty: "Drop access, points and collector certificate",
        businessValue: "Tag-message replay signals + digital ownership + resale channel",
        objectClass: "sneaker-demo scanning",
        phoneTag: "SNEAKER - ID_DEMO",
        steps: ["Simulated tap", "Represent SUN message", "Show declared rarity", "Offer claim flow"],
      },
      logistics: {
        label: "Logistics",
        profile: "UHF + NFC",
        action: "Logistics scenario: shows simulated temperature, lot and route; it does not confirm cold chain, delivery or custody.",
        result: "Demo telemetry available",
        product: "Co-19 Vaccine Pallet",
        batch: "LOG-VAC-884",
        uid: "04E9****4820",
        origin: { city: "Mendoza", country: "Argentina", label: "logistics hub", lat: -32.8895, lng: -68.8458 },
        security: "Simulated IoT readings + demo UID",
        nextAction: "Temperature log and audit trail",
        marketplace: "Premium logistics + cargo insurance",
        loyalty: "Route history, average temperature and compliance report",
        businessValue: "Demo operations view + claims workflow + quality control",
        objectClass: "logistics-demo scanning",
        phoneTag: "LOGISTICS - SENSOR_DEMO",
        steps: ["Simulated read", "Show demo temperature", "Draw declared route", "Represent delivery"],
      },
      electronics: {
        label: "Electronics",
        profile: "NFC + QR",
        action: "Electronics scenario: looks up a serial number and warranty options; it does not prove the device or transfer ownership.",
        result: "Declared serial looked up",
        product: "Nex-V Smartwatch",
        batch: "ELE-NX-2026",
        uid: "04D8****1024",
        origin: { city: "Miami", country: "United States", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Demo UID + simulated digital record",
        nextAction: "Official support, register or claim",
        marketplace: "Official accessories + warranty extension",
        loyalty: "Warranty registration, priority support and upgrade club",
        businessValue: "Warranty anti-fraud + registration + upgrade offers",
        objectClass: "electronics-demo scanning",
        phoneTag: "ELECTRONICS - SERIAL_DEMO",
        steps: ["Simulated tap", "Look up declared serial", "Offer warranty registration", "Show support"],
      },
      textile: {
        label: "Textile",
        profile: "NFC + QR DPP",
        action: "DPP scenario: shows declared origin, materials and circularity; the tap does not certify those claims or the garment.",
        result: "Demo DPP looked up",
        product: "Premium Denim Jacket",
        batch: "TEX-DEN-021",
        uid: "048A****3920",
        origin: { city: "Madrid", country: "Spain", label: "textile mill", lat: 40.4168, lng: -3.7038 },
        security: "Demo DPP record + simulated NFC UID",
        nextAction: "View declared circularity or start an evidence-backed claim",
        marketplace: "Circular resale channel + care guide",
        loyalty: "Pre-sales access, circularity club and recycling discounts",
        businessValue: "DPP readiness + branded resale + circular engagement",
        objectClass: "textile-demo scanning",
        phoneTag: "TEXTILE - DPP_DEMO",
        steps: ["Simulated read", "Look up demo DPP", "Show declared data", "Offer circular options"],
      },
      luxury: {
        label: "Luxury",
        profile: "NTAG 424 DNA",
        action: "Luxury scenario: looks up declared digital identity, warranty and claim data; it does not prove the watch or ownership.",
        result: "Simulated digital identity",
        product: "Premium Chronograph Watch",
        batch: "LUX-CH-2026",
        uid: "04C2****99B4",
        origin: { city: "Miami", country: "United States", label: "distributor", lat: 25.7617, lng: -80.1918 },
        security: "Demo SUN result + claim flow",
        nextAction: "Request ownership, warranty, resale or token with evidence",
        marketplace: "Exclusive benefits, resale and collector club",
        loyalty: "Warranty registration, VIP access and collector club",
        businessValue: "Risk signals + governed resale + direct CRM",
        objectClass: "luxury-demo scanning",
        phoneTag: "LUXURY - ID_DEMO",
        steps: ["Simulated tap", "Represent SUN message", "Offer evidence-backed claim", "Show value club"],
      },
      bottle: {
        label: "Refill packaging",
        profile: "NFC + QR",
        action: "Circular scenario: looks up declared cycle and return data; the tap does not prove provenance, contents or physical return.",
        result: "Simulated return event",
        product: "Premium Refill Bottle",
        batch: "BEV-OR-902",
        uid: "048E****2039",
        origin: { city: "Rosario", country: "Argentina", label: "bottling plant", lat: -32.9442, lng: -60.6505 },
        security: "GS1/QR + optional NFC UID + cycle control",
        nextAction: "Register return, refill or circular impact",
        marketplace: "Refill, deposit return and green coupons",
        loyalty: "Discount for return, refill or circular purchase",
        businessValue: "Container inventory + ESG incentives + measurable circularity",
        objectClass: "bottle-demo scanning",
        phoneTag: "BOTTLE - RETURN_DEMO",
        steps: ["Simulated read", "Look up declared return", "Show possible incentive", "Represent reception"],
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

function routeEvidenceSentenceFromTitle(routeTitle: string) {
  if (routeTitle === "Declared demo route") return "Illustrative scenario; no physical tap or custody evidence.";
  if (routeTitle.startsWith("Rota")) return "Cenário ilustrativo; sem evidência de toque físico ou custódia.";
  return "Escenario ilustrativo; sin evidencia de tap físico ni custodia.";
}

function routeEvidenceValueFromTitle(routeTitle: string, distance?: number) {
  if (routeTitle === "Declared demo route") return (distance || 0) > 2500 ? "Illustrative global route" : "Illustrative route";
  if (routeTitle.startsWith("Rota")) return (distance || 0) > 2500 ? "Rota global ilustrativa" : "Rota ilustrativa";
  return (distance || 0) > 2500 ? "Ruta global ilustrativa" : "Ruta ilustrativa";
}

function routeEvidenceValueFromNumberLocale(numberLocale: string, distance?: number) {
  if (numberLocale.startsWith("en")) return (distance || 0) > 2500 ? "Illustrative global route" : "Illustrative route";
  if (numberLocale.startsWith("pt")) return (distance || 0) > 2500 ? "Rota global ilustrativa" : "Rota ilustrativa";
  return (distance || 0) > 2500 ? "Ruta global ilustrativa" : "Ruta ilustrativa";
}

function routeEvidenceLabelFromLocale(locale: AppLocale) {
  if (locale === "en") return "Evidence";
  if (locale === "pt-BR") return "Evidencia";
  return "Evidencia";
}

function routeEvidenceLabelFromNumberLocale(numberLocale: string) {
  if (numberLocale.startsWith("en")) return "Evidence";
  return "Evidencia";
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
const HERO_ATLAS_WORLD_SCALE_Y = 1;

type HeroAtlasCityMarker = {
  id: string;
  label: string;
  country: string;
  lat: number;
  lng: number;
  tier: "primary" | "secondary";
  dx?: number;
  dy?: number;
  anchor?: "start" | "end";
};

type HeroAtlasNetworkLink = {
  id: string;
  from: Pick<HeroAtlasCityMarker, "lat" | "lng">;
  to: Pick<HeroAtlasCityMarker, "lat" | "lng">;
  tone: "corridor" | "handoff";
};

type HeroAtlasMeshMode = "none" | "compact" | "hero";

const HERO_ATLAS_CITY_MARKERS: HeroAtlasCityMarker[] = [
  { id: "buenos-aires", label: "Buenos Aires", country: "ARG", lat: -34.6037, lng: -58.3816, tier: "primary", dx: 12, dy: 22 },
  { id: "santiago", label: "Santiago", country: "CHL", lat: -33.4489, lng: -70.6693, tier: "secondary" },
  { id: "sao-paulo", label: "Sao Paulo", country: "BRA", lat: -23.5505, lng: -46.6333, tier: "secondary" },
  { id: "mexico-city", label: "Mexico City", country: "MEX", lat: 19.4326, lng: -99.1332, tier: "secondary" },
  { id: "miami", label: "Miami", country: "USA", lat: 25.7617, lng: -80.1918, tier: "primary", dx: 12, dy: -20 },
  { id: "new-york", label: "New York", country: "USA", lat: 40.7128, lng: -74.006, tier: "secondary" },
  { id: "london", label: "London", country: "GBR", lat: 51.5072, lng: -0.1276, tier: "secondary" },
  { id: "madrid", label: "Madrid", country: "ESP", lat: 40.4168, lng: -3.7038, tier: "primary", dx: 14, dy: -24 },
  { id: "dubai", label: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, tier: "secondary" },
  { id: "mumbai", label: "Mumbai", country: "IND", lat: 19.076, lng: 72.8777, tier: "secondary" },
  { id: "singapore", label: "Singapore", country: "SGP", lat: 1.3521, lng: 103.8198, tier: "primary", dx: -14, dy: 18, anchor: "end" },
  { id: "shanghai", label: "Shanghai", country: "CHN", lat: 31.2304, lng: 121.4737, tier: "secondary" },
  { id: "tokyo", label: "Tokyo", country: "JPN", lat: 35.6762, lng: 139.6503, tier: "secondary" },
  { id: "sydney", label: "Sydney", country: "AUS", lat: -33.8688, lng: 151.2093, tier: "primary", dx: -14, dy: 22, anchor: "end" },
  { id: "johannesburg", label: "Johannesburg", country: "ZAF", lat: -26.2041, lng: 28.0473, tier: "secondary" },
];

const heroAtlasCityById = new Map(HERO_ATLAS_CITY_MARKERS.map((city) => [city.id, city]));

const HERO_ATLAS_NETWORK_LINKS: HeroAtlasNetworkLink[] = [
  { id: "south-america-us", from: heroAtlasCityById.get("buenos-aires")!, to: heroAtlasCityById.get("miami")!, tone: "handoff" },
  { id: "us-europe", from: heroAtlasCityById.get("miami")!, to: heroAtlasCityById.get("madrid")!, tone: "corridor" },
  { id: "europe-mea", from: heroAtlasCityById.get("madrid")!, to: heroAtlasCityById.get("dubai")!, tone: "corridor" },
  { id: "mea-asia", from: heroAtlasCityById.get("dubai")!, to: heroAtlasCityById.get("singapore")!, tone: "corridor" },
  { id: "asia-oceania", from: heroAtlasCityById.get("singapore")!, to: heroAtlasCityById.get("sydney")!, tone: "handoff" },
  { id: "asia-north", from: heroAtlasCityById.get("singapore")!, to: heroAtlasCityById.get("tokyo")!, tone: "corridor" },
  { id: "latam-network", from: heroAtlasCityById.get("buenos-aires")!, to: heroAtlasCityById.get("sao-paulo")!, tone: "corridor" },
  { id: "africa-europe", from: heroAtlasCityById.get("johannesburg")!, to: heroAtlasCityById.get("madrid")!, tone: "corridor" },
];

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
    "custody-singapore": { dx: -42, dy: -44, anchor: "end" },
    tap: { dx: -56, dy: -78, anchor: "end" },
  };
  const offset = offsets[point.id] || { dx: 18, dy: -34, anchor: "start" as const };
  return {
    x: clamp(projected.x + offset.dx, 28, HERO_ATLAS_WIDTH - 28),
    y: clamp(projected.y + offset.dy, 54, HERO_ATLAS_HEIGHT - 48),
    anchor: offset.anchor,
  };
}

function heroAtlasNetworkPath(link: HeroAtlasNetworkLink) {
  const start = projectHeroAtlasPoint(link.from);
  const end = projectHeroAtlasPoint(link.to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lift = Math.min(120, Math.max(36, Math.abs(dx) * 0.1 + Math.abs(dy) * 0.05));
  return `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${(start.x + dx * 0.36).toFixed(1)} ${(Math.min(start.y, end.y) - lift).toFixed(1)} ${(start.x + dx * 0.72).toFixed(1)} ${(Math.min(start.y, end.y) - lift * 0.74).toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
}

export function HeroTrustAtlasSvg({
  points,
  routes,
  selectedPointId = "tap",
  mesh = "compact",
}: {
  points: VectorMapPoint[];
  routes: VectorMapRoute[];
  selectedPointId?: string;
  mesh?: HeroAtlasMeshMode;
}) {
  const atlasId = useId().replace(/:/g, "");
  const oceanId = `hero-atlas-ocean-${atlasId}`;
  const landId = `hero-atlas-land-${atlasId}`;
  const routeInfoId = `hero-atlas-route-info-${atlasId}`;
  const routeSuccessId = `hero-atlas-route-success-${atlasId}`;
  const nodeGlowId = `hero-atlas-node-glow-${atlasId}`;
  const softGlowId = `hero-atlas-soft-glow-${atlasId}`;
  const gridId = `hero-atlas-grid-${atlasId}`;

  const meshCities = mesh === "hero" ? HERO_ATLAS_CITY_MARKERS : HERO_ATLAS_CITY_MARKERS.filter((city) => city.tier === "primary");
  const showNetworkMesh = mesh !== "none";

  return (
    <svg
      className={`hero-trust-atlas hero-trust-atlas--${mesh}`}
      viewBox={`0 0 ${HERO_ATLAS_WIDTH} ${HERO_ATLAS_HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Atlas demo con nodos y rutas simulados"
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

      {showNetworkMesh ? (
        <g className="hero-trust-atlas__network" aria-hidden="true">
          {HERO_ATLAS_NETWORK_LINKS.map((link, index) => (
            <path
              key={link.id}
              className={`hero-trust-atlas__network-link hero-trust-atlas__network-link--${link.tone}`}
              d={heroAtlasNetworkPath(link)}
              style={{ animationDelay: `${index * -0.42}s` } as CSSProperties}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
      ) : null}

      {mesh !== "none" ? (
        <g className="hero-trust-atlas__cities" aria-hidden="true">
          {meshCities.map((city) => {
          const { x, y } = projectHeroAtlasPoint(city);
          const anchor = city.anchor || "start";
          const labelX = x + (city.dx ?? (anchor === "end" ? -12 : 12));
          const labelY = y + (city.dy ?? -10);
          return (
            <g key={city.id} className={`hero-trust-atlas__city hero-trust-atlas__city--${city.tier}`} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <circle className="hero-trust-atlas__city-halo" r={city.tier === "primary" ? 8 : 5.5} />
              <circle className="hero-trust-atlas__city-dot" r={city.tier === "primary" ? 2.7 : 1.8} />
              {city.tier === "primary" ? (
                <g transform={`translate(${(labelX - x).toFixed(1)} ${(labelY - y).toFixed(1)})`}>
                  <text className="hero-trust-atlas__city-label" textAnchor={anchor}>{city.label}</text>
                  <text className="hero-trust-atlas__city-country" y="10" textAnchor={anchor}>{city.country}</text>
                </g>
              ) : null}
            </g>
          );
          })}
        </g>
      ) : null}

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
                <text textAnchor={label.anchor} className="hero-trust-atlas__label-eyebrow">{point.stageLabel || (point.id === "tap" ? "Tap demo" : "Hito declarado")}</text>
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
        <text x="14" y="31">simulated route + simulated tap</text>
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
  void numberLocale;
  const isEnglish = txt.routeTitle === "Declared demo route";
  const isPortuguese = txt.routeTitle.startsWith("Rota");
  const custodyStage = isEnglish ? "Declared milestone" : isPortuguese ? "Marco declarado" : "Hito declarado";
  const madridCountry = isEnglish ? "Spain" : isPortuguese ? "Espanha" : "Espana";
  const singaporeLabel = isEnglish ? "Singapore" : isPortuguese ? "Singapura" : "Singapur";
  const distributionEvidence = isEnglish ? "Declared distribution stop" : isPortuguese ? "Parada de distribuição declarada" : "Parada de distribución declarada";
  const documentEvidence = isEnglish ? "Declared document stop" : isPortuguese ? "Marco documental declarado" : "Hito documental declarado";
  const exportEvidence = isEnglish ? "Declared export stop" : isPortuguese ? "Marco de exportação declarado" : "Hito de exportación declarado";
  const routeEvidence = routeEvidenceValueFromTitle(txt.routeTitle, distance);
  const evidenceCopy = routeEvidenceSentenceFromTitle(txt.routeTitle);

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
      distanceLabel: isFinal ? routeEvidence : undefined,
      evidence: isFinal ? evidenceCopy : stop.evidence,
    };
  }), [custodyStops, evidenceCopy, routeEvidence]);

  const timelineStops = custodyStops.map((stop, index) => ({
    ...stop,
    title: index === 0 ? txt.originMap : stop.id === "tap" ? stageCopy.tapFinal : stop.stageLabel || custodyStage,
    date: index === 0 ? "12 ENE 08:15" : index === 1 ? "15 ENE 14:22" : index === 2 ? "19 ENE 09:10" : index === 3 ? "22 ENE 12:45" : "24 ENE 18:33",
  }));

  const ledgerItems = [
    { id: "integrity", label: stageCopy.integrity, value: stageCopy.verified },
    { id: "events", label: stageCopy.events, value: `${custodyStops.length}/${custodyStops.length}` },
    { id: "alerts", label: stageCopy.alerts, value: "0" },
  ];
  const countriesLabel = isEnglish ? "Countries" : isPortuguese ? "Paises" : "Paises";
  const citiesLabel = isEnglish ? "Cities" : isPortuguese ? "Cidades" : "Ciudades";
  const routeLabel = isEnglish ? "Demo route" : isPortuguese ? "Rota demo" : "Ruta demo";
  const demoRouteEvidence = isEnglish ? "Simulated case" : isPortuguese ? "Caso simulado" : "Caso simulado";
  const custodyLabel = isEnglish ? "Declared milestones" : isPortuguese ? "Marcos declarados" : "Hitos declarados";
  const atlasOps = [
    { id: "countries", label: countriesLabel, value: String(new Set(HERO_ATLAS_CITY_MARKERS.map((city) => city.country)).size) },
    { id: "cities", label: citiesLabel, value: String(HERO_ATLAS_CITY_MARKERS.length) },
    { id: "route", label: routeLabel, value: demoRouteEvidence },
    { id: "custody", label: custodyLabel, value: `${custodyStops.length} ${stageCopy.events.toLowerCase()}` },
  ];
  const atlasZoomLevels = [1, 1.16, 1.32] as const;
  const [atlasZoomIndex, setAtlasZoomIndex] = useState(0);
  const atlasZoom = atlasZoomLevels[atlasZoomIndex];
  const canZoomOut = atlasZoomIndex > 0;
  const canZoomIn = atlasZoomIndex < atlasZoomLevels.length - 1;
  const zoomGroupLabel = isEnglish ? "Trust atlas zoom controls" : isPortuguese ? "Controles de zoom do atlas de confianca" : "Controles de zoom del atlas de confianza";
  const zoomInLabel = isEnglish ? "Zoom into trust atlas" : isPortuguese ? "Aproximar atlas de confianca" : "Acercar atlas de confianza";
  const zoomOutLabel = isEnglish ? "Zoom out trust atlas" : isPortuguese ? "Afastar atlas de confianca" : "Alejar atlas de confianza";

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
        <div
          className="nexid-hero-atlas-card__viewport"
          data-zoom-level={atlasZoomIndex}
          style={{ "--nexid-hero-atlas-zoom": atlasZoom } as CSSProperties}
        >
          <HeroTrustAtlasSvg points={custodyStops} routes={vectorRoutes} selectedPointId="tap" mesh="hero" />
        </div>
        <div className="nexid-hero-atlas-card__map-controls" role="group" aria-label={zoomGroupLabel}>
          <button
            type="button"
            aria-label={zoomInLabel}
            title={zoomInLabel}
            disabled={!canZoomIn}
            onClick={() => setAtlasZoomIndex((value) => Math.min(value + 1, atlasZoomLevels.length - 1))}
          >
            +
          </button>
          <button
            type="button"
            aria-label={zoomOutLabel}
            title={zoomOutLabel}
            disabled={!canZoomOut}
            onClick={() => setAtlasZoomIndex((value) => Math.max(value - 1, 0))}
          >
            -
          </button>
        </div>
      </div>

      <div className="nexid-hero-atlas-card__ops" aria-hidden="true">
        {atlasOps.map((item) => (
          <span key={item.id}>
            <em>{item.label}</em>
            <strong>{item.value}</strong>
          </span>
        ))}
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
        <div className="nexid-hero-atlas-card__mobile-stops">
          {timelineStops.map((stop, index) => (
            <article key={`${stop.id}-mobile`} className={stop.id === "tap" ? "is-final" : ""}>
              <i>{String(index + 1).padStart(2, "0")}</i>
              <div>
                <span>{stop.title}</span>
                <strong>{stop.label}</strong>
                <em>{stop.sublabel}</em>
              </div>
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
  void numberLocale;
  const routeHeadline = txt.routeTitle === "Declared demo route" ? "Declared demo route" : txt.routeTitle.startsWith("Rota") ? "Rota demo declarada" : "Ruta demo declarada";
  const tapCopy = txt.routeTitle === "Declared demo route" ? "Simulated tap" : txt.routeTitle.startsWith("Rota") ? "Toque simulado" : "Tap simulado";
  const evidenceCopy = routeEvidenceSentenceFromTitle(txt.routeTitle);
  const signedCopy = txt.routeTitle === "Declared demo route" ? "Simulated SUN result" : txt.routeTitle.startsWith("Rota") ? "Resultado SUN simulado" : "Resultado SUN simulado";
  const crmCopy = txt.routeTitle === "Declared demo route" ? "Demo CRM step" : txt.routeTitle.startsWith("Rota") ? "Etapa CRM demo" : "Etapa CRM demo";
  const crmDetailCopy = txt.routeTitle === "Declared demo route"
    ? "possible benefit, warranty and reorder"
    : txt.routeTitle.startsWith("Rota")
      ? "benefício, garantia e recompra possíveis"
      : "beneficio, garantía y recompra posibles";
  const proofSteps: HeroRouteHover[] = [
    { eyebrow: "01", title: txt.originMap, detail: `${origin.city} · ${origin.country}`, tone: "origin" },
    { eyebrow: "02", title: "UID + SUN", detail: signedCopy, tone: "route" },
    { eyebrow: "03", title: tapCopy, detail: `${tap.city} · ${tap.label}`, tone: "tap" },
    { eyebrow: "04", title: crmCopy, detail: crmDetailCopy, tone: "crm" },
  ];

  const [routeHover, setRouteHover] = useState<HeroRouteHover | null>(null);
  const routeDistanceLabel = routeEvidenceValueFromTitle(txt.routeTitle, distance);
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
  void numberLocale;
  const routeEvidence = routeEvidenceValueFromTitle(txt.routeTitle, distance);
  const evidenceCopy = routeEvidenceSentenceFromTitle(txt.routeTitle);
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
        stageLabel: "Hito declarado",
        evidence: "Parada de distribución declarada",
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
        stageLabel: "Hito declarado",
        evidence: "Hito documental declarado",
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
        stageLabel: "Hito declarado",
        evidence: "Hito de exportación declarado",
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
      distanceLabel: isFinal ? routeEvidence : undefined,
      evidence: isFinal ? evidenceCopy : stop.evidence,
    };
  }), [custodyStops, evidenceCopy, routeEvidence]);

  const ledgerItems = useMemo<VectorMapLedgerItem[]>(() => [
    { id: "integrity", label: stageCopy.integrity, value: stageCopy.verified, detail: evidenceCopy, tone: "loyalty" },
    { id: "events", label: stageCopy.events, value: `${custodyStops.length}/${custodyStops.length}`, detail: routeEvidence, tone: "tap" },
    { id: "alerts", label: stageCopy.alerts, value: "0", detail: "Sin alertas en esta lectura demo", tone: "origin" },
  ], [custodyStops.length, evidenceCopy, routeEvidence, stageCopy.alerts, stageCopy.events, stageCopy.integrity, stageCopy.verified]);

  const proofSteps: HeroRouteHover[] = [
    { eyebrow: "01", title: txt.originMap, detail: `${origin.city} - ${origin.country}`, tone: "origin" },
    { eyebrow: "02", title: "SUN / UID", detail: "Evidencia firmada por lectura", tone: "route" },
    { eyebrow: "03", title: stageCopy.tapFinal, detail: `${tap.city} - ${tap.label}`, tone: "tap" },
    { eyebrow: "04", title: "CRM", detail: "Beneficio, garantia y recompra", tone: "crm" },
  ];
  const selectedProof = routeHover || proofSteps[0];
  const timelineStops = custodyStops.map((stop, index) => ({
    ...stop,
    title: index === 0 ? txt.originMap : stop.id === "tap" ? stageCopy.tapFinal : stop.stageLabel || "Hito declarado",
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
  kind: "wine" | "bottle" | "bracelet" | "perfume" | "seeds";
  seal: string;
  detail: string;
  accent: string;
}> = {
  seeds: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#84cc16" },
  bracelet: { kind: "bracelet", seal: "VIP", detail: "UID DEMO", accent: "#2dd4bf" },
  pharma: { kind: "perfume", seal: "SUN DEMO", detail: "LOTE DECL.", accent: "#38bdf8" },
  perfume: { kind: "perfume", seal: "SUN DEMO", detail: "LOTE DECL.", accent: "#a78bfa" },
  wine: { kind: "wine", seal: "NFC TT", detail: "SUN DEMO", accent: "#22d3ee" },
  bottle: { kind: "bottle", seal: "QR NFC", detail: "REFILL", accent: "#38bdf8" },
  luxury: { kind: "bracelet", seal: "LUJO", detail: "CLAIM", accent: "#c084fc" },
  sneaker: { kind: "bracelet", seal: "DROP", detail: "CLAIM", accent: "#a78bfa" },
  logistics: { kind: "seeds", seal: "LOTE", detail: "ORIGEN", accent: "#a3e635" },
  electronics: { kind: "bracelet", seal: "DROP", detail: "CLAIM", accent: "#818cf8" },
  textile: { kind: "bracelet", seal: "DROP", detail: "CLAIM", accent: "#64748b" },
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
    imageLightUrl: "/sdk/verticals/light/premium-events-light-enterprise.webp",
    alt: "Brazalete y app de Eventos & Tickets con tags NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  pharma: {
    imageUrl: "/sdk/pharma-authentication-pack.webp",
    imageLightUrl: "/sdk/verticals/light/premium-pharma-agro-light-enterprise.webp",
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
    imageLightUrl: "/sdk/verticals/light/premium-bottle-light-enterprise.webp",
    alt: "Envase retornable premium con identidad GS1/QR y NFC opcional nexID.",
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
    imageLightUrl: "/sdk/verticals/light/premium-sneaker-light-enterprise.webp",
    alt: "Zapatillas premium de colección con chip NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  logistics: {
    imageUrl: "/sdk/verticals/logistics-uhf-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-logistics-light-enterprise.webp",
    alt: "Cajas de Logística & Cadena de Frío con tags UHF/NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  electronics: {
    imageUrl: "/sdk/verticals/electronics-warranty-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-electronics-light-enterprise.webp",
    alt: "Dispositivo electrónico con tag NFC nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
  textile: {
    imageUrl: "/sdk/verticals/textile-dpp-nfc-qr.webp",
    imageLightUrl: "/sdk/verticals/light/premium-textile-light-enterprise.webp",
    alt: "Prenda de vestir y pasaporte digital textil con tag NFC/QR nexID.",
    bank: "nexID",
    sourceLabel: "nexID secure asset",
    sourceUrl: "#",
  },
};

type HeroTheme = "dark" | "light";

function resolveDocumentTheme(fallback: HeroTheme): HeroTheme {
  if (typeof document === "undefined") return fallback;
  const root = document.documentElement;
  return root.classList.contains("theme-light") || root.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function useHeroTheme(initialTheme: HeroTheme) {
  const [theme, setTheme] = useState<HeroTheme>(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(resolveDocumentTheme(initialTheme));
    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, [initialTheme]);

  return theme;
}

function HeroThemeImage({
  darkSrc,
  lightSrc,
  alt,
  className,
  theme,
  priority = false,
}: {
  darkSrc: string;
  lightSrc: string;
  alt: string;
  className: string;
  theme: HeroTheme;
  priority?: boolean;
}) {
  return (
    <img
      className={`${className} nexid-premium-image--${theme}`}
      src={theme === "light" ? lightSrc : darkSrc}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
    />
  );
}

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

      {spec.kind === "bottle" ? (
        <g filter={`url(#${uid}-shadow)`}>
          <path d="M155 48h50l8 52c2 13 12 23 22 34 12 14 18 31 18 52v128c0 32-21 53-53 53h-40c-32 0-53-21-53-53V186c0-21 6-38 18-52 10-11 20-21 22-34l8-52Z" fill={`url(#${uid}-glass)`} />
          <path d="M151 39h58v34h-58V39Z" fill={`url(#${uid}-metal)`} />
          <path d="M138 94c-32 24-42 73-25 106" fill="none" stroke="#67e8f9" strokeWidth="14" strokeLinecap="round" opacity="0.54" />
          <path d="M211 103c24 17 36 44 36 79v127c0 28-18 46-46 46h-15c18-25 23-72 23-152 0-42 1-74 2-100Z" fill="#0f172a" opacity="0.14" />
          <rect x="124" y="176" width="112" height="124" rx="18" fill="#cffafe" opacity="0.95" />
          <rect x="140" y="195" width="80" height="12" rx="6" fill={`url(#${uid}-holo)`} opacity="0.58" />
          <text x="180" y="232" textAnchor="middle" fill="#0f172a" fontSize="14" fontWeight="900" letterSpacing="2">REFILL</text>
          <text x="180" y="252" textAnchor="middle" fill="#155e75" fontSize="8" fontWeight="900" letterSpacing="1.4">GS1 / QR / NFC</text>
          <path d="M149 72c-10 59-12 151-6 251" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinecap="round" opacity="0.24" />
          <circle cx="180" cy="160" r="18" fill="#f8fafc" stroke={spec.accent} strokeWidth="3" opacity="0.92" />
          <path d="M171 160c7-8 17-8 24 0M175 168c4-4 10-4 14 0" fill="none" stroke="#0e7490" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
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
          <text x="180" y="255" textAnchor="middle" fill="#e0e7ff" fontSize="8" fontWeight="900" letterSpacing="1.2">ORIGEN DECLARADO</text>
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
          <text x="180" y="192" textAnchor="middle" fill="#f0fdf4" fontSize="10" fontWeight="900" letterSpacing="1.6">RUTA DEMO</text>
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
        <strong>{routeEvidenceValueFromNumberLocale(numberLocale, distance)}</strong>
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
        {asset ? <img src={asset.imageUrl} alt="" loading="lazy" /> : <HeroProductVisual active={active} product={data.product} />}
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
            <dt>{routeEvidenceLabelFromNumberLocale(numberLocale)}</dt>
            <dd>{routeEvidenceValueFromNumberLocale(numberLocale, distance)}</dd>
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
          <img className="hero-real-asset" src={asset.imageUrl} alt={asset.alt} loading="lazy" />
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
              <small>{routeEvidenceValueFromNumberLocale(numberLocale, distance)}</small>
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
  theme,
}: {
  active: Vertical;
  data: Scene;
  txt: Pick<(typeof labels)["es-AR"], "realAsset" | "renderFallback" | "labels">;
  detailCopy: (typeof productModalCopy)["es-AR"];
  stageCopy: (typeof heroStageCopy)["es-AR"];
  theme: HeroTheme;
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
            <HeroThemeImage
              darkSrc={asset.imageUrl}
              lightSrc={asset.imageLightUrl}
              alt={asset.alt}
              className="nexid-hero-product-card__photo"
              theme={theme}
              priority
            />
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
  theme,
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
  theme: HeroTheme;
}) {
  const asset = heroRealAssets[active];
  const productOrigin = `${data.origin.city}, ${data.origin.country}`;
  const tapLabel = `${tap.city}, ${tap.country}`;
  const flowSteps = data.steps.slice(0, 4);

  return (
    <aside className="nexid-hero-phone-panel" aria-label={stageCopy.consumerTitle}>
      <div className="nexid-hero-phone-panel__head">
        <span>{stageCopy.consumerTitle}</span>
        <strong>{stageCopy.cellularState}</strong>
      </div>

      <article className={`nexid-hero-phone nexid-hero-phone--${model}`}>
        <span className="nexid-hero-phone__device-label">{model === "iphone" ? copy.iphone : copy.samsung}</span>
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
                  <HeroThemeImage
                    darkSrc={asset.imageUrl}
                    lightSrc={asset.imageLightUrl}
                    alt=""
                    className="nexid-hero-phone__product-photo"
                    theme={theme}
                  />
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

          <section className="nexid-hero-phone__nfc-moment" aria-label={copy.trustedTap}>
            <span className="nexid-hero-phone__nfc-chip" aria-hidden="true">
              <i />
              <em>NFC</em>
            </span>
            <span className="nexid-hero-phone__nfc-wave" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div>
              <em>{copy.livePhoneTitle}</em>
              <strong>{copy.trustedTap}</strong>
              <small>{data.phoneTag}</small>
            </div>
          </section>

          <section className="nexid-hero-phone__tap-demo" aria-label={copy.trustedTap}>
            <span className="nexid-hero-phone__tap-beacon" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <div>
              <em>{copy.trustedTap}</em>
              <strong>{data.phoneTag}</strong>
              <small>{tapLabel}</small>
            </div>
          </section>

          <section className="nexid-hero-phone__flow" aria-label={copy.livePhoneTitle}>
            <i className="nexid-hero-phone__flow-line" aria-hidden="true" />
            {flowSteps.map((step, index) => (
              <span key={`${step}-${index}`} className={index === flowSteps.length - 1 ? "is-final" : ""}>
                <em>{String(index + 1).padStart(2, "0")}</em>
                <strong>{step}</strong>
              </span>
            ))}
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
              <dd>{routeEvidenceValueFromNumberLocale(numberLocale, distance)}</dd>
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
  theme,
}: {
  active: Vertical;
  data: Scene;
  distance: number;
  numberLocale: string;
  proofRows: ProductInfoRow[];
  commerceRows: ProductInfoRow[];
  copy: (typeof productModalCopy)["es-AR"];
  onClose: () => void;
  theme: HeroTheme;
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

        <div className="hero-product-modal__trust-strip" aria-hidden="true">
          <span>
            <em>{copy.productTitle}</em>
            <strong>{data.product}</strong>
          </span>
          <span>
            <em>{copy.state}</em>
            <strong>{data.result}</strong>
          </span>
          <span>
            <em>{copy.trustedTap}</em>
            <strong>{data.phoneTag}</strong>
          </span>
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
                  <HeroThemeImage
                    darkSrc={asset.imageUrl}
                    lightSrc={asset.imageLightUrl}
                    alt={asset.alt}
                    className="hero-product-modal__asset-photo"
                    theme={theme}
                  />
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
              <span>{routeEvidenceValueFromNumberLocale(numberLocale, distance)} · {data.origin.city} → {data.nextAction}</span>
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

export function HeroScene({ locale, initialTheme = "dark" }: { locale: AppLocale; initialTheme?: HeroTheme }) {
  const [selectedVertical, setSelectedVertical] = useState<HeroSelectorKey>("seeds");
  const [tapIndex, setTapIndex] = useState(0);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isRotationPaused, setIsRotationPaused] = useState(false);
  const theme = useHeroTheme(initialTheme);
  const productTriggerRef = useRef<HTMLButtonElement>(null);
  const txt = labels[locale] || labels["es-AR"];
  const modalCopy = productModalCopy[locale] || productModalCopy["es-AR"];
  const stageCopy = heroStageCopy[locale] || heroStageCopy["es-AR"];
  const active = selectedVertical;
  const data = useMemo(() => txt.items[active], [txt, active]);
  const tap = tapLocations[tapIndex % tapLocations.length];
  const distance = haversineKm(data.origin, tap);
  const numberLocale = localeName(locale);

  useEffect(() => {
    if (isRotationPaused || isProductModalOpen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setSelectedVertical((current) => {
        const currentIndex = featuredHeroVerticals.indexOf(current);
        return featuredHeroVerticals[(currentIndex + 1) % featuredHeroVerticals.length];
      });
    }, 7000);
    return () => window.clearInterval(interval);
  }, [isProductModalOpen, isRotationPaused]);

  const closeProductModal = () => {
    setIsProductModalOpen(false);
    window.setTimeout(() => productTriggerRef.current?.focus(), 0);
  };

  const proofRows = [
    { label: txt.labels.product, value: data.product },
    { label: txt.labels.origin, value: `${data.origin.city}, ${data.origin.country}` },
    { label: txt.labels.tap, value: `${tap.city}, ${tap.country} - ${tap.label}` },
    { label: routeEvidenceLabelFromLocale(locale), value: routeEvidenceValueFromNumberLocale(numberLocale, distance) },
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
    <div
      onMouseEnter={() => setIsRotationPaused(true)}
      onMouseLeave={() => setIsRotationPaused(false)}
      onFocusCapture={() => setIsRotationPaused(true)}
      onBlurCapture={() => setIsRotationPaused(false)}
    >
      <div className="hero-scene hero-scene--product-proof rounded-2xl border border-white/10 p-4 md:p-5">
        {/* Removed selectorTitle as per user request to clean UI */}
        <div className="mt-3 flex flex-wrap gap-2">
          {platformVerticals.filter((item) => featuredHeroVerticals.includes(item.demoVertical)).map((item) => (
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
          <div suppressHydrationWarning className="nexid-hero-product-trigger">
            <EnterpriseHeroProductCard
              active={active}
              data={data}
              txt={txt}
              detailCopy={modalCopy}
              stageCopy={stageCopy}
              theme={theme}
            />
            <button
              ref={productTriggerRef}
              type="button"
              className="nexid-hero-product-trigger__button"
              aria-label={`${modalCopy.open}: ${data.product}`}
              onClick={() => setIsProductModalOpen(true)}
            >
              <span>{`${modalCopy.open}: ${data.product}`}</span>
            </button>
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
            distanceLabel={routeEvidenceLabelFromLocale(locale)}
            theme={theme}
          />
        </div>

        <p className="hero-scene-microcopy mt-3 text-xs text-slate-300">{txt.microcopy}</p>
      </div>

      <div className="hero-scene-more mt-4 flex justify-end">
        <a href="#rubros" className="hero-scene-band rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
          {locale === "en" ? "Explore industries" : locale === "pt-BR" ? "Explorar setores" : "Explorar más rubros"}
        </a>
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
              theme={theme}
            />,
            document.body,
          )
        : null}
    </div>
  );
}
