"use client";

import { useEffect, useMemo, useState } from "react";
import type { AppLocale } from "@product/config";

type Vertical = "wine" | "events" | "cosmetics" | "agro";

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
  { city: "Buenos Aires", country: "Argentina", label: "wine club member", lat: -34.6037, lng: -58.3816 },
  { city: "Santiago", country: "Chile", label: "retail buyer", lat: -33.4489, lng: -70.6693 },
  { city: "Sao Paulo", country: "Brazil", label: "reseller demo", lat: -23.5558, lng: -46.6396 },
  { city: "Miami", country: "United States", label: "export distributor", lat: 25.7617, lng: -80.1918 },
  { city: "Zurich", country: "Switzerland", label: "premium collector", lat: 47.3769, lng: 8.5417 },
  { city: "Cordoba", country: "Argentina", label: "event access gate", lat: -31.4201, lng: -64.1888 },
];

const labels: Record<AppLocale, {
  selectorTitle: string;
  microcopy: string;
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
  items: Record<Vertical, Scene>;
}> = {
  "es-AR": {
    selectorTitle: "Elegi vertical",
    microcopy: "Cada tap convierte seguridad en relacion: prueba de origen, club, garantia, puntos, recompra y marketplace contextual para la marca.",
    ctaBands: ["Bodegas", "Eventos", "Cosmetica", "Agro", "Pharma"],
    phoneLabel: "Salida mobile",
    swapTap: "Cambiar tap",
    liveTap: "Tap simulado",
    whatHappened: "Que esta pasando",
    routeTitle: "Ruta de confianza",
    originMap: "Origen",
    tapMap: "Tap",
    openOriginMap: "Ver origen en Maps",
    custody: "Origen, distancia y accion quedan unidos al evento.",
    labels: {
      product: "Producto",
      origin: "Origen",
      tap: "Tap actual",
      distance: "Distancia",
      uid: "UID",
      batch: "Lote",
      security: "Seguridad",
      nextAction: "Siguiente accion",
      marketplace: "Marketplace",
      loyalty: "Loyalty",
      businessValue: "Valor empresa",
    },
    items: {
      wine: {
        label: "Vino",
        profile: "NTAG 424 DNA TT",
        action: "Descorche o sello abierto: la etiqueta tamper cambia estado y el SUN valida el tap.",
        result: "Autentico, sello abierto",
        product: "Gran Reserva Malbec",
        batch: "MZA-2026-0424",
        uid: "04A7****1090",
        origin: { city: "Valle de Uco", country: "Argentina", label: "bodega", lat: -33.6131, lng: -69.2075 },
        security: "SUN dinamico + tamper fisico + anti-replay",
        nextAction: "Club, garantia, ownership o token premium",
        marketplace: "Voucher post-compra + trazabilidad de coleccion",
        loyalty: "320 pts, club de cosecha, voucher y recompra premium",
        businessValue: "CRM post-tap + marketplace + tokenizacion opcional",
        objectClass: "hero-bottle scanning tampered",
        phoneTag: "WINE - AUTH_OK",
        steps: ["Se lee UID fisico", "SUN evita replay", "El sello cambia a OPENED", "Se abre club y marketplace"],
      },
      events: {
        label: "Eventos",
        profile: "NTAG215",
        action: "Pulsera VIP escaneada en puerta: UID serializado y regla server-side.",
        result: "Acceso VIP aprobado",
        product: "Pulsera VIP",
        batch: "EVT-BA-ACCESS-17",
        uid: "0470****8842",
        origin: { city: "Buenos Aires", country: "Argentina", label: "venue", lat: -34.5792, lng: -58.4208 },
        security: "UID + estado de acceso + bloqueo de reingreso",
        nextAction: "Beneficio backstage o upgrade de entrada",
        marketplace: "Promos de barra, merch y reventa controlada",
        loyalty: "Puntos por asistencia, upgrades y merch",
        businessValue: "Control de acceso + datos de audiencia + revenue post-evento",
        objectClass: "wristband-demo scanning",
        phoneTag: "EVENT - ENTRY_OK",
        steps: ["Tap en ingreso", "Backend valida UID", "Marca check-in", "Activa beneficio"],
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
        marketplace: "Cross-sell, muestras y loyalty",
        loyalty: "Garantia, muestras y recompra",
        businessValue: "Antifalsificacion + first-party data + cross-sell",
        objectClass: "cosmetic-demo scanning",
        phoneTag: "COSMETIC - VERIFIED",
        steps: ["Tap en tapa", "SUN verifica autenticidad", "Muestra lote", "Activa garantia"],
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
        steps: ["Scan en campo", "Lote confirmado", "Origen visible", "Soporte activo"],
      },
    },
  },
  "pt-BR": {
    selectorTitle: "Escolha o vertical",
    microcopy: "Cada toque transforma seguranca em relacionamento: prova de origem, clube, garantia, pontos, recompra e marketplace contextual para a marca.",
    ctaBands: ["Vinhos", "Eventos", "Cosmeticos", "Agro", "Pharma"],
    phoneLabel: "Saida mobile",
    swapTap: "Trocar toque",
    liveTap: "Toque simulado",
    whatHappened: "O que acontece",
    routeTitle: "Rota de confianca",
    originMap: "Origem",
    tapMap: "Toque",
    openOriginMap: "Ver origem no Maps",
    custody: "Origem, distancia e acao ficam ligados ao evento.",
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
        nextAction: "Clube, garantia, ownership ou token premium",
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
    },
  },
  en: {
    selectorTitle: "Choose vertical",
    microcopy: "Every tap turns security into relationship: origin proof, club, warranty, points, reorder and a contextual marketplace for the brand.",
    ctaBands: ["Wineries", "Events", "Cosmetics", "Agro", "Pharma"],
    phoneLabel: "Mobile output",
    swapTap: "Change tap",
    liveTap: "Simulated tap",
    whatHappened: "What happens",
    routeTitle: "Trust route",
    originMap: "Origin",
    tapMap: "Tap",
    openOriginMap: "Open origin map",
    custody: "Origin, distance and physical action are attached to the event.",
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

function projectMapPoint(point: LocationPoint) {
  const x = clamp(((point.lng + 90) / 105) * 100, 10, 90);
  const y = clamp((1 - (point.lat + 42) / 92) * 100, 13, 82);
  return { x, y };
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
  const originPoint = projectMapPoint(origin);
  const tapPoint = projectMapPoint(tap);
  const midX = (originPoint.x + tapPoint.x) / 2;
  const controlY = Math.min(originPoint.y, tapPoint.y) - 18;
  const routePath = `M ${originPoint.x} ${originPoint.y} Q ${midX} ${controlY} ${tapPoint.x} ${tapPoint.y}`;

  return (
    <div className="hero-trace-map" aria-label={txt.routeTitle}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <rect className="hero-trace-map__water" x="0" y="0" width="100" height="100" rx="6" />
        <path className="hero-trace-map__land hero-trace-map__land--americas" d="M 16 16 C 25 8 39 11 43 21 C 47 31 40 39 44 48 C 49 60 38 69 35 82 C 27 84 20 78 21 67 C 22 58 15 51 18 41 C 20 33 10 25 16 16 Z" />
        <path className="hero-trace-map__land hero-trace-map__land--europe" d="M 63 22 C 72 13 87 18 90 29 C 83 34 79 40 80 49 C 73 48 66 44 62 37 C 59 31 57 27 63 22 Z" />
        <path className="hero-trace-map__land hero-trace-map__land--africa" d="M 64 46 C 73 42 84 48 87 60 C 82 72 75 82 66 81 C 60 73 59 62 62 53 C 63 50 63 48 64 46 Z" />
        <path className="hero-trace-map__coast" d="M 14 18 C 25 8 39 12 43 22 M 63 22 C 72 13 88 18 91 29 M 64 46 C 74 42 85 49 88 61" />
        <path className="hero-trace-map__grid" d="M 8 24 H 92 M 8 50 H 92 M 8 76 H 92 M 20 10 V 88 M 48 10 V 88 M 76 10 V 88" />
        <path className="hero-trace-map__road" d="M 8 70 C 25 61 34 66 47 58 S 75 49 94 55" />
        <path className="hero-trace-map__road" d="M 14 36 C 29 34 45 42 58 37 S 78 25 92 31" />
        <path className="hero-trace-map__road hero-trace-map__road--secondary" d="M 30 12 C 35 29 34 47 41 65 S 55 80 58 90" />
        <circle className="hero-trace-map__city" cx="30" cy="64" r="1.2" />
        <circle className="hero-trace-map__city" cx="66" cy="37" r="1" />
        <circle className="hero-trace-map__city" cx="78" cy="58" r="1.1" />
        <text className="hero-trace-map__label" x="10" y="89">LATAM</text>
        <text className="hero-trace-map__label" x="62" y="17">GLOBAL</text>
        <path className="hero-trace-map__route-shadow" d={routePath} />
        <path className="hero-trace-map__route" d={routePath} />
        <circle className="hero-trace-map__origin" cx={originPoint.x} cy={originPoint.y} r="2.4" />
        <circle className="hero-trace-map__tap" cx={tapPoint.x} cy={tapPoint.y} r="3" />
      </svg>
      <div className="hero-map-pin hero-map-pin--origin" style={{ left: `${originPoint.x}%`, top: `${originPoint.y}%` }}>
        <span>{txt.originMap}</span>
        <strong>{origin.city}</strong>
      </div>
      <div className="hero-map-pin hero-map-pin--tap" style={{ left: `${tapPoint.x}%`, top: `${tapPoint.y}%` }}>
        <span>{txt.tapMap}</span>
        <strong>{tap.city}</strong>
      </div>
      <div className="hero-trace-caption">
        <p>{txt.routeTitle}</p>
        <strong>{distance.toLocaleString(numberLocale)} km</strong>
        <span>{txt.custody}</span>
      </div>
      <a className="hero-origin-link" href={mapsHref(origin)} target="_blank" rel="noreferrer">
        {txt.openOriginMap}
      </a>
    </div>
  );
}

export function HeroScene({ locale }: { locale: AppLocale }) {
  const [active, setActive] = useState<Vertical>("wine");
  const [tapIndex, setTapIndex] = useState(0);
  const txt = labels[locale] || labels["es-AR"];
  const data = useMemo(() => txt.items[active], [txt, active]);
  const tap = tapLocations[tapIndex % tapLocations.length];
  const distance = haversineKm(data.origin, tap);
  const numberLocale = localeName(locale);

  useEffect(() => {
    setTapIndex(Math.floor(Math.random() * tapLocations.length));
  }, []);

  const outputRows = [
    { label: txt.labels.product, value: data.product },
    { label: txt.labels.origin, value: `${data.origin.city}, ${data.origin.country}` },
    { label: txt.labels.tap, value: `${tap.city}, ${tap.country} - ${tap.label}` },
    { label: txt.labels.distance, value: `${distance.toLocaleString(numberLocale)} km` },
    { label: txt.labels.uid, value: data.uid },
    { label: txt.labels.batch, value: data.batch },
    { label: txt.labels.security, value: data.security },
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
          {(["wine", "events", "cosmetics", "agro"] as const).map((key) => (
            <button suppressHydrationWarning key={key} type="button" onClick={() => setActive(key)} className={`hero-vertical-pill ${active === key ? "hero-vertical-pill--active" : ""}`}>
              {txt.items[key].label}
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
              <div className="hero-object-frame">
                <HeroTraceMap origin={data.origin} tap={tap} distance={distance} numberLocale={numberLocale} txt={txt} />
                <div className={data.objectClass} />
                <div className="hero-cork-pop" />
                <div className="hero-tamper-strip" />
                <div className="hero-nfc-beam" />
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
          </div>

          <div className="hero-scene-result-card rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3">
            <p className="hero-scene-result-label text-[11px] uppercase tracking-[0.14em] text-cyan-200">{txt.phoneLabel}</p>
            <p className="hero-scene-result-state mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-emerald-300">{data.result}</p>
            <div className="hero-output-grid mt-3">
              {outputRows.map((item) => (
                <div key={item.label} className="hero-output-row">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
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
        {txt.ctaBands.map((item) => (
          <span key={item} className="hero-scene-band rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-slate-300">{item}</span>
        ))}
      </div>
    </div>
  );
}
