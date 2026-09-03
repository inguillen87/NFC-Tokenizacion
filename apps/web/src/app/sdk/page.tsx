import type { Metadata } from "next";
import { getImageProps } from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import Script from "next/script";
import {
  ArrowRight,
  Boxes,
  Code2,
  Gem,
  Globe2,
  KeyRound,
  PackageCheck,
  Pill,
  PlayCircle,
  Radio,
  ShieldCheck,
  Sprout,
  Store,
  TicketCheck,
  Truck,
  Webhook,
  Zap,
  Sparkles,
  Cpu,
  Shirt,
  Footprints,
  GlassWater,
  ExternalLink,
} from "lucide-react";
import { BrandLockup, buttonClassName, Card, ThemeToggle, type VectorMapPoint, type VectorMapRoute } from "@product/ui";
import { resolveThemePreference, THEME_PREFERENCE_VERSION_COOKIE } from "@product/ui/theme-preference";
import { HeroTrustNetworkDiagram } from "../../components/hero-scene";
import {
  demoLabHrefForVertical,
  platformTrustedBy,
  platformVerticals,
  type PlatformDemoVertical,
  type PlatformIconKey,
  type PlatformVertical,
} from "../../lib/platform-verticals";
import {
  NEXID_SDK_ASYNCAPI_URL,
  NEXID_SDK_EPCIS_CAPTURE_URL,
  NEXID_SDK_OPENAPI_URL,
  NEXID_SDK_VERIFY_URL,
} from "../../lib/sdk-public-contract";

export const metadata: Metadata = {
  title: "SDK y APIs - nexID",
  description: "SDK, APIs, webhooks y flujo POS para validar mensajes NFC/SUN, operar QR y GS1 Digital Link, y activar derechos digitales sin atar a las marcas a proveedores cerrados.",
};
const code = `// app/api/nexid/verify/route.ts - ejecutar solo en servidor
const response = await fetch("${NEXID_SDK_VERIFY_URL}", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "x-nexid-api-key": process.env.NEXID_API_KEY!,
    "x-nexid-tenant-slug": "mi-marca",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    bid: tag.bid,
    picc_data: tag.picc_data,
    enc: tag.enc,
    cmac: tag.cmac,
  }),
});

if (!response.ok) throw new Error("No se pudo verificar el tap");
const verification = await response.json();

if (verification.verdict === "VALID") {
  // Continuar en backend: POS token, claim y webhook por politica.
}`;
const epcisCode = `// ERP/WMS backend - EPCIS capture is never called from a browser
const response = await fetch("${NEXID_SDK_EPCIS_CAPTURE_URL}", {
  method: "POST",
  headers: {
    "content-type": "application/vnd.gs1.epcis+json",
    "accept": "application/vnd.gs1.epcis+json",
    "x-nexid-api-key": process.env.NEXID_API_KEY!,
    "x-nexid-tenant-slug": "mi-marca",
    "Idempotency-Key": shipment.eventId,
  },
  body: JSON.stringify(epcisDocument),
});

if (!response.ok) throw new Error("No se pudo capturar el documento EPCIS");
const receipt = await response.json();
console.log(receipt.captureID, receipt.canonicalProjectionCount);`;
const pillars = [
  {
    icon: Code2,
    title: "API privada para equipos tecnicos",
    body: "El backend del cliente conecta e-commerce, ERP o POS con credenciales por tenant y permisos explicitos. La API key nunca viaja al navegador.",
  },
  {
    icon: ShieldCheck,
    title: "Claim seguro, no scan oportunista",
    body: "Leer una etiqueta en góndola no te hace dueño. El ownership exige identidad, evidencia de compra, una lectura reciente aceptada y la política del tenant; el mensaje NFC no prueba propiedad física.",
  },
  {
    icon: Webhook,
    title: "Webhooks verificables hacia su stack",
    body: "Con un secreto configurado, verificaciones, claims y alertas llegan firmados al CRM o data warehouse del cliente.",
  },
  {
    icon: Radio,
    title: "QR, NFC, GS1 y UHF en una arquitectura",
    body: "QR baja la barrera de entrada; NFC criptografico protege premium; GS1 Digital Link y RAIN/UHF preparan logistica y passport global.",
  },
];

const flow = [
  "1. La marca empieza con QR, NFC existente o lote nuevo de tags nexID.",
  "2. El SDK lee producto, passport, marketplace, beneficios y asistente IA.",
  "3. Si hay compra, el POS emite un token nxpos de un solo uso.",
  "4. El claim evalúa identidad, token POS, lectura reciente y política antes de registrar ownership digital.",
  "5. El CRM recibe analytics y mapa por stream cuando está conectado; los webhooks llegan de forma asíncrona con estado de entrega.",
];

const strategy = [
  { label: "LATAM", text: "Entrada barata con QR/SDK y chips NTAG DNA de menor costo cuando el caso lo justifica." },
  { label: "Europa", text: "Vinos, lujo y productos premium con NTAG 424 DNA, tamper, passport y trazabilidad fuerte." },
  { label: "Global", text: "Interoperabilidad con GS1 Digital Link, integraciones API y tags hibridos NFC/UHF para escala logistica." },
];

const trustSignals = [
  { label: "Evidencia y riesgo", detail: "Validacion del mensaje, anti-replay y senales del servidor.", Icon: ShieldCheck },
  { label: "Implementacion controlada", detail: "API server-side para backend, POS y ERP.", Icon: Zap },
  { label: "Estandares globales", detail: "QR, NFC, UHF y GS1 Digital Link.", Icon: Globe2 },
  { label: "Privacidad por diseno", detail: "Datos minimos y control del usuario.", Icon: KeyRound },
];

const enterpriseContracts = [
  {
    label: "Reintentos seguros",
    detail: "Verify, claim, events y POS aceptan Idempotency-Key; EPCIS capture la exige. El SDK reintenta solo operaciones con contrato durable.",
    Icon: Zap,
  },
  {
    label: "Replay sin duplicados",
    detail: "La misma operación y el mismo payload recuperan la respuesta guardada; reutilizar la clave con otro payload devuelve HTTP 409.",
    Icon: ShieldCheck,
  },
  {
    label: "Estado y reconciliación",
    detail: "Si el resultado queda incierto, el cliente consulta status o solicita reconcile con la misma clave; no inventa una operación nueva.",
    Icon: Code2,
  },
  {
    label: "Webhooks con rotación",
    detail: "La firma v2 incluye versión e identificador de clave para rotación controlada, verificación server-side y auditoría de entregas.",
    Icon: Webhook,
  },
];

const iconByKey: Record<PlatformIconKey, typeof Sprout> = {
  sprout: Sprout,
  ticket: TicketCheck,
  pill: Pill,
  gem: Gem,
  shield: ShieldCheck,
  truck: Truck,
  package: PackageCheck,
  sparkles: Sparkles,
  cpu: Cpu,
  shirt: Shirt,
  bottle: GlassWater,
  sneaker: Footprints,
};

type SdkTheme = "dark" | "light";

type SdkThemeImageProps = {
  alt: string;
  className: string;
  darkSrc: string;
  lightSrc: string;
  priority?: boolean;
  sizes: string;
  theme: SdkTheme;
};

const sdkThemeMediaSyncScript = String.raw`
(() => {
  const root = document.documentElement;

  const syncThemeImages = () => {
    const isLight = root.getAttribute("data-theme") === "light" || root.classList.contains("theme-light");
    const theme = isLight ? "light" : "dark";

    document.querySelectorAll("img[data-sdk-theme-image]").forEach((image) => {
      const nextSrc = image.getAttribute("data-" + theme + "-src");
      const nextSrcSet = image.getAttribute("data-" + theme + "-srcset");
      const nextWidth = image.getAttribute("data-" + theme + "-width");
      const nextHeight = image.getAttribute("data-" + theme + "-height");

      if (nextSrcSet && image.getAttribute("srcset") !== nextSrcSet) image.setAttribute("srcset", nextSrcSet);
      if (nextSrc && image.getAttribute("src") !== nextSrc) image.setAttribute("src", nextSrc);
      if (nextWidth) image.setAttribute("width", nextWidth);
      if (nextHeight) image.setAttribute("height", nextHeight);

      image.classList.toggle("nexid-premium-image--light", isLight);
      image.classList.toggle("nexid-premium-image--dark", !isLight);
    });
  };

  if (window.__nexidSdkThemeMediaSync) {
    window.__nexidSdkThemeMediaSync();
    return;
  }

  window.__nexidSdkThemeMediaSync = syncThemeImages;
  syncThemeImages();

  new MutationObserver(syncThemeImages).observe(root, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  window.addEventListener("pageshow", syncThemeImages);
})();`;

function SdkThemeImage({ alt, className, darkSrc, lightSrc, priority = false, sizes, theme }: SdkThemeImageProps) {
  const dark = getImageProps({
    src: darkSrc,
    alt,
    width: 1200,
    height: 1200,
    sizes,
    quality: 80,
    decoding: "async",
    ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const }),
  }).props;
  const light = getImageProps({
    src: lightSrc,
    alt,
    width: 1280,
    height: 900,
    sizes,
    quality: 80,
    decoding: "async",
    ...(priority ? { loading: "eager" as const, fetchPriority: "high" as const } : { loading: "lazy" as const }),
  }).props;
  const active = theme === "light" ? light : dark;

  return (
    <img
      {...active}
      suppressHydrationWarning
      className={`${className} nexid-premium-image--${theme}`}
      data-sdk-theme-image
      data-dark-src={dark.src}
      data-dark-srcset={dark.srcSet}
      data-dark-width={dark.width}
      data-dark-height={dark.height}
      data-light-src={light.src}
      data-light-srcset={light.srcSet}
      data-light-width={light.width}
      data-light-height={light.height}
    />
  );
}

function SdkTopNav({ theme }: { theme: SdkTheme }) {
  return (
    <header className="sdk-top-nav">
      <div className="sdk-top-nav-inner">
        <Link href="/" aria-label="nexID home" className="sdk-brand-link">
          <BrandLockup size={48} variant="ripple" theme="dark" className="sdk-brand-lockup" />
          <span className="sdk-brand-badge">SDK & APIs</span>
        </Link>
        <nav className="sdk-desktop-nav" aria-label="SDK navigation">
          <Link href="/docs">Docs</Link>
          <Link href="/pricing">Precios</Link>
          <Link href="/stack">Stack</Link>
          <Link href="/audiences">Casos de uso</Link>
          <Link href="/resellers">Partners</Link>
          <Link href="/proof/verify">Proof Verify & Decoder</Link>
        </nav>
        <Link href="/?contact=sales&intent=sdk_access&source=sdk&return_to=%2Fsdk#contact-modal" className="sdk-mobile-primary-action" aria-label="Solicitar acceso a la API nexID">
          Solicitar acceso <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <div className="sdk-theme-toggle">
          <ThemeToggle initialTheme={theme} />
        </div>
        <div className="sdk-nav-actions">
          <span className="sdk-api-status">API de produccion</span>
          <Link href="https://app.nexid.lat/login" className={buttonClassName("secondary")}>
            Iniciar sesion
          </Link>
          <Link href="/?contact=sales&intent=sdk_access&source=sdk&return_to=%2Fsdk#contact-modal" className={buttonClassName()}>
            Solicitar acceso
          </Link>
        </div>
      </div>
    </header>
  );
}

type SdkGeoPoint = {
  city: string;
  sublabel: string;
  lat: number;
  lng: number;
};

type SdkVerticalProfile = {
  origin: SdkGeoPoint;
  hub: SdkGeoPoint;
  integration: SdkGeoPoint;
  tap: SdkGeoPoint;
  verdict: string;
  proof: string;
  mobileBody: string;
};

const sdkVerticalProfiles: Record<PlatformDemoVertical, SdkVerticalProfile> = {
  seeds: {
    origin: { city: "Pergamino", sublabel: "Lote campo", lat: -33.8895, lng: -60.5736 },
    hub: { city: "Sao Paulo", sublabel: "Canal agro", lat: -23.5558, lng: -46.6396 },
    integration: { city: "Miami", sublabel: "ERP / GS1", lat: 25.7617, lng: -80.1918 },
    tap: { city: "Bogota", sublabel: "Operador rural", lat: 4.711, lng: -74.0721 },
    verdict: "LOT_AUTHORIZED",
    proof: "424 DNA + canal",
    mobileBody: "Lote, origen y uso responsable quedan listos para sincronizar con el canal.",
  },
  bracelet: {
    origin: { city: "Buenos Aires", sublabel: "Emisor", lat: -34.6037, lng: -58.3816 },
    hub: { city: "Miami", sublabel: "Partner", lat: 25.7617, lng: -80.1918 },
    integration: { city: "Madrid", sublabel: "POS / SDK", lat: 40.4168, lng: -3.7038 },
    tap: { city: "Lisboa", sublabel: "Acceso VIP", lat: 38.7223, lng: -9.1393 },
    verdict: "ACCESS_VALID",
    proof: "NFC + QR + POS",
    mobileBody: "Ingreso, zona VIP y consumo quedan validados sin habilitar reuso de copia.",
  },
  pharma: {
    origin: { city: "Basel", sublabel: "Laboratorio", lat: 47.5596, lng: 7.5886 },
    hub: { city: "Madrid", sublabel: "Distribuidor", lat: 40.4168, lng: -3.7038 },
    integration: { city: "Bogota", sublabel: "Recall API", lat: 4.711, lng: -74.0721 },
    tap: { city: "Lima", sublabel: "Farmacia", lat: -12.0464, lng: -77.0428 },
    verdict: "BATCH_VERIFIED",
    proof: "QR + NFC + recall",
    mobileBody: "Prospecto, lote y recall por unidad se muestran sin prometer sello fisico.",
  },
  perfume: {
    origin: { city: "Grasse", sublabel: "Origen", lat: 43.6584, lng: 6.9253 },
    hub: { city: "Paris", sublabel: "Retail", lat: 48.8566, lng: 2.3522 },
    integration: { city: "New York", sublabel: "CRM", lat: 40.7128, lng: -74.006 },
    tap: { city: "Miami", sublabel: "Cliente", lat: 25.7617, lng: -80.1918 },
    verdict: "VALID",
    proof: "NFC + tamper",
    mobileBody: "Producto, tapa, lote y politica de refill quedan visibles para postventa.",
  },
  wine: {
    origin: { city: "Mendoza", sublabel: "Origen demo", lat: -32.8895, lng: -68.8458 },
    hub: { city: "Miami", sublabel: "Canal retail", lat: 25.7617, lng: -80.1918 },
    integration: { city: "Madrid", sublabel: "DPP / SDK", lat: 40.4168, lng: -3.7038 },
    tap: { city: "Zurich", sublabel: "Tap consumidor", lat: 47.3769, lng: 8.5417 },
    verdict: "VALID",
    proof: "NTAG 424 DNA TT",
    mobileBody: "Origen, lote, UID hasheado, garantia y claim seguro.",
  },
  bottle: {
    origin: { city: "Cordoba", sublabel: "Planta", lat: -31.4201, lng: -64.1888 },
    hub: { city: "Santiago", sublabel: "Distribucion", lat: -33.4489, lng: -70.6693 },
    integration: { city: "Lima", sublabel: "GS1 resolver", lat: -12.0464, lng: -77.0428 },
    tap: { city: "Quito", sublabel: "Retorno", lat: -0.1807, lng: -78.4678 },
    verdict: "GS1_RESOLVED",
    proof: "QR / GS1 + NFC opcional",
    mobileBody: "Identidad y retorno resueltos; NFC queda como capa fuerte opcional.",
  },
  luxury: {
    origin: { city: "Milano", sublabel: "Atelier", lat: 45.4642, lng: 9.19 },
    hub: { city: "Paris", sublabel: "Retail", lat: 48.8566, lng: 2.3522 },
    integration: { city: "Dubai", sublabel: "Certificado", lat: 25.2048, lng: 55.2708 },
    tap: { city: "Singapore", sublabel: "Cliente", lat: 1.3521, lng: 103.8198 },
    verdict: "CERT_READY",
    proof: "NFC + QR + certificado",
    mobileBody: "Garantia, certificado y reventa se activan solo con evidencia de compra, identidad y politica aprobadas.",
  },
  sneaker: {
    origin: { city: "Portland", sublabel: "Drop", lat: 45.5152, lng: -122.6784 },
    hub: { city: "Los Angeles", sublabel: "Retail", lat: 34.0522, lng: -118.2437 },
    integration: { city: "Tokyo", sublabel: "Marketplace", lat: 35.6762, lng: 139.6503 },
    tap: { city: "Seoul", sublabel: "Claim", lat: 37.5665, lng: 126.978 },
    verdict: "DROP_VERIFIED",
    proof: "424 DNA + ownership",
    mobileBody: "Drop, propiedad y reventa quedan conectados sin depender de una foto del ticket.",
  },
  logistics: {
    origin: { city: "Antofagasta", sublabel: "Planta", lat: -23.6509, lng: -70.3975 },
    hub: { city: "Panama", sublabel: "Hub", lat: 8.9824, lng: -79.5199 },
    integration: { city: "Houston", sublabel: "Sensor API", lat: 29.7604, lng: -95.3698 },
    tap: { city: "Toronto", sublabel: "Recepcion", lat: 43.6532, lng: -79.3832 },
    verdict: "TRACE_SYNCED",
    proof: "UHF + NFC + sensor",
    mobileBody: "Pallet, temperatura y recepcion quedan auditados con blockchain opcional por hito relevante.",
  },
  electronics: {
    origin: { city: "Shenzhen", sublabel: "Serie", lat: 22.5431, lng: 114.0579 },
    hub: { city: "Los Angeles", sublabel: "Importador", lat: 34.0522, lng: -118.2437 },
    integration: { city: "Mexico City", sublabel: "Soporte", lat: 19.4326, lng: -99.1332 },
    tap: { city: "Bogota", sublabel: "Garantia", lat: 4.711, lng: -74.0721 },
    verdict: "WARRANTY_READY",
    proof: "QR + NFC + DPP",
    mobileBody: "Serie, garantia y soporte por unidad quedan listos para postventa.",
  },
  textile: {
    origin: { city: "Porto", sublabel: "Origen textil", lat: 41.1579, lng: -8.6291 },
    hub: { city: "Barcelona", sublabel: "Retail", lat: 41.3874, lng: 2.1686 },
    integration: { city: "Berlin", sublabel: "EU DPP", lat: 52.52, lng: 13.405 },
    tap: { city: "Copenhagen", sublabel: "Reventa", lat: 55.6761, lng: 12.5683 },
    verdict: "DPP_READY",
    proof: "QR + NFC + EU DPP",
    mobileBody: "Composicion, cuidado, origen y reventa se muestran como passport verificable.",
  },
};

function normalizeSdkVertical(value: string | string[] | undefined): PlatformVertical {
  const vertical = Array.isArray(value) ? value[0] : value;
  return platformVerticals.find((item) => item.demoVertical === vertical) || platformVerticals.find((item) => item.demoVertical === "wine") || platformVerticals[0];
}

function sdkAtlasForProfile(profile: SdkVerticalProfile): { points: VectorMapPoint[]; routes: VectorMapRoute[] } {
  const points: VectorMapPoint[] = [
    { id: "origin", label: profile.origin.city, sublabel: profile.origin.sublabel, lat: profile.origin.lat, lng: profile.origin.lng, scans: 1, risk: 0, tone: "origin", stageLabel: "Origen", evidence: "Lote demo" },
    { id: "custody-miami", label: profile.hub.city, sublabel: profile.hub.sublabel, lat: profile.hub.lat, lng: profile.hub.lng, scans: 1, risk: 0, tone: "hub", stageLabel: "Custodia", evidence: "Canal demo" },
    { id: "custody-madrid", label: profile.integration.city, sublabel: profile.integration.sublabel, lat: profile.integration.lat, lng: profile.integration.lng, scans: 1, risk: 0, tone: "hub", stageLabel: "Integracion", evidence: "API + GS1" },
    { id: "tap", label: profile.tap.city, sublabel: profile.tap.sublabel, lat: profile.tap.lat, lng: profile.tap.lng, scans: 1, risk: 0, tone: "tap", stageLabel: "Tap final", evidence: profile.verdict },
  ];

  const routes: VectorMapRoute[] = [
    { id: "sdk-route-origin-hub", fromLat: profile.origin.lat, fromLng: profile.origin.lng, toLat: profile.hub.lat, toLng: profile.hub.lng, label: `${profile.origin.city} -> ${profile.hub.city}`, tone: "info", evidence: "Custodia demo" },
    { id: "sdk-route-hub-integration", fromLat: profile.hub.lat, fromLng: profile.hub.lng, toLat: profile.integration.lat, toLng: profile.integration.lng, label: `${profile.hub.city} -> ${profile.integration.city}`, tone: "info", evidence: "SDK / DPP" },
    { id: "sdk-route-integration-tap", fromLat: profile.integration.lat, fromLng: profile.integration.lng, toLat: profile.tap.lat, toLng: profile.tap.lng, label: `${profile.integration.city} -> ${profile.tap.city}`, tone: "success", evidence: "Tap simulado" },
  ];

  return { points, routes };
}

function SdkGlobalHeroScene({ activeVertical, theme }: { activeVertical: PlatformVertical; theme: SdkTheme }) {
  const profile = sdkVerticalProfiles[activeVertical.demoVertical] || sdkVerticalProfiles.wine;
  const atlas = sdkAtlasForProfile(profile);

  return (
    <div className="sdk-proof-hero-system">
      <div className="sdk-global-hero-globe sdk-global-hero-atlas" data-diagram-truth="simulated-sdk-flow" data-geographic="false">
        <HeroTrustNetworkDiagram points={atlas.points} routes={atlas.routes} selectedPointId="tap" />
        <div className="sdk-global-hero-atlas__caption">
          <span>Escenario SDK ilustrativo</span>
          <strong>{activeVertical.shortTitle}: señales, políticas y acciones simuladas para explicar la integración.</strong>
          <small>Diagrama no geográfico: sin coordenadas, telemetría productiva ni recorrido físico.</small>
        </div>
      </div>
      <div className="sdk-proof-live-card">
        <div className="sdk-proof-product-shot">
          <SdkThemeImage
            alt={`${activeVertical.title} con nexID`}
            className="sdk-proof-product-image"
            darkSrc={activeVertical.image}
            lightSrc={activeVertical.imageLight}
            priority
            sizes="(max-width: 760px) 38vw, (max-width: 1100px) 22vw, 14vw"
            theme={theme}
          />
          <span>{profile.proof}</span>
        </div>
        <div className="sdk-proof-phone">
          <div className="sdk-proof-phone__chrome" aria-hidden="true">
            <strong>nexID</strong>
            <em>9:41</em>
          </div>
          <div className="sdk-proof-phone__verdict">
            <span>Salida celular</span>
            <strong>{profile.verdict}</strong>
            <p>{activeVertical.title}</p>
            <small>{profile.mobileBody}</small>
          </div>
          <div className="sdk-proof-phone__checks" aria-hidden="true">
            <span><em>{activeVertical.tags[0]}</em><strong>OK</strong></span>
            <span><em>{activeVertical.tags[1]}</em><strong>Activo</strong></span>
            <span><em>Webhook</em><strong>Firmado</strong></span>
          </div>
          <Link href={demoLabHrefForVertical(activeVertical.demoVertical)}>
            Ver salida mobile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function SdkIndustryShowcase({ activeVertical, theme }: { activeVertical: PlatformVertical; theme: SdkTheme }) {
  return (
    <section className="sdk-industry-showcase">
      {platformVerticals.map((item) => {
        const Icon = iconByKey[item.icon];
        const isActive = item.demoVertical === activeVertical.demoVertical;
        return (
          <article key={item.title} className={`sdk-industry-card sdk-industry-card--${item.tone}${isActive ? " is-active" : ""}`}>
            <div className="sdk-industry-image-wrap">
              <SdkThemeImage
                alt={`${item.title} conectado a nexID`}
                className="sdk-industry-image"
                darkSrc={item.image}
                lightSrc={item.imageLight}
                sizes="(max-width: 760px) 100vw, (max-width: 1380px) 50vw, 17vw"
                theme={theme}
              />
              <span>{item.metric}</span>
            </div>
            <div className="sdk-industry-content">
              <Icon className="h-6 w-6" />
              <h2>{item.title}</h2>
              <p>{item.body}</p>
              <div className="sdk-industry-tags">
                {item.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
              <Link href={`/sdk?vertical=${item.demoVertical}#sdk-proof-hero`} aria-current={isActive ? "true" : undefined}>
                {isActive ? "Activo en escena" : "Ver en escena"} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        );
      })}
    </section>
  );
}

type SdkPageProps = {
  searchParams?: Promise<{ vertical?: string | string[] }> | { vertical?: string | string[] };
};

export default async function SdkPage({ searchParams }: SdkPageProps) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const theme: SdkTheme = resolveThemePreference(
    cookieStore.get("theme")?.value,
    cookieStore.get(THEME_PREFERENCE_VERSION_COOKIE)?.value,
  );
  const activeVertical = normalizeSdkVertical(params?.vertical);

  return (
    <main className="knowledge-page-surface public-page-shell sdk-page-shell">
      <Script id="sdk-theme-media-sync" strategy="afterInteractive">
        {sdkThemeMediaSyncScript}
      </Script>
      <SdkTopNav theme={theme} />

      <div className="container-shell space-y-10 pb-16">
        <section id="sdk-proof-hero" className="sdk-premium-hero">
          <div className="sdk-premium-copy">
            <p className="sdk-hero-eyebrow">Mensaje NFC/SUN - Evidencia - Derechos digitales</p>
            <h1 className="brand-editorial-gradient">
              Infraestructura de identidad{" "}
              <br />
              para todo lo que creas,{" "}
              <br />
              <span>mueves y vendes.</span>
            </h1>
            <p>
              Las APIs nexID y el acceso SDK privado asocian una referencia declarada de producto, empaque, evento o activo con una identidad digital y evidencia del mensaje NFC/SUN. La integracion se ejecuta desde el servidor del cliente, con credenciales por tenant y cambios controlados; no autentica por si sola el objeto fisico.
            </p>
            <div className="sdk-hero-actions">
              <Link href="/docs" className={buttonClassName()}>
                <Code2 className="mr-2 h-4 w-4" />Explorar documentacion
              </Link>
              <a href={NEXID_SDK_OPENAPI_URL} target="_blank" rel="noreferrer" className={buttonClassName("secondary")}>
                <ExternalLink className="mr-2 h-4 w-4" />OpenAPI v1
              </a>
              <a href={NEXID_SDK_ASYNCAPI_URL} target="_blank" rel="noreferrer" className={buttonClassName("secondary")}>
                <Webhook className="mr-2 h-4 w-4" />AsyncAPI webhooks v1
              </a>
              <Link href={demoLabHrefForVertical(activeVertical.demoVertical)} className={buttonClassName("secondary")}>
                <PlayCircle className="mr-2 h-4 w-4" />Ver demo interactiva
              </Link>
              <Link href="/proof/verify" className={buttonClassName("secondary")}>
                <ShieldCheck className="mr-2 h-4 w-4" />Proof Verify & Decoder
              </Link>
            </div>
            <div className="sdk-trust-rail">
              {trustSignals.map((item) => {
                const Icon = item.Icon;
                return (
                  <div key={item.label}>
                    <Icon className="h-5 w-5" />
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <SdkGlobalHeroScene activeVertical={activeVertical} theme={theme} />
        </section>

        <SdkIndustryShowcase activeVertical={activeVertical} theme={theme} />

        <div className="sdk-trusted-rail">
          <span>Verticales objetivo</span>
          {platformTrustedBy.map((item) => <strong key={item}>{item}</strong>)}
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-cyan-300/25 bg-cyan-500/10 text-cyan-200">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.body}</p>
              </Card>
            );
          })}
        </section>

        <section aria-labelledby="sdk-delivery-contracts" className="space-y-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Contrato de entrega</p>
            <h2 id="sdk-delivery-contracts" className="mt-3 text-2xl font-black tracking-tight text-white">Integraciones que se recuperan sin duplicar operaciones</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              Los timeouts existen. nexID conserva una identidad de operación durable para que el backend del cliente pueda reintentar, consultar y reconciliar sin convertir una caída de red en dos claims, dos eventos o dos activaciones POS.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {enterpriseContracts.map((item) => {
              const Icon = item.Icon;
              return (
                <Card key={item.label} className="p-5">
                  <Icon className="h-5 w-5 text-cyan-300" />
                  <h3 className="mt-4 text-base font-semibold text-white">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.detail}</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="sdk-epcis-contract" className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">ERP, WMS y supply chain</p>
            <h2 id="sdk-epcis-contract" className="mt-3 text-2xl font-black tracking-tight text-white">EPCIS 2.0 sin formato propietario obligatorio</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Capture, consulta y exportacion usan un perfil JSON/JSON-LD acotado, identidades GS1 registradas por tenant, scopes separados de lectura y escritura, paginacion por cursor y proyeccion atomica al outbox de webhooks.
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Hasta 512 KiB, 100 eventos y 100 proyecciones canonicas por captura.</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">Un retry conserva el mismo Idempotency-Key y nunca duplica el documento aceptado.</div>
              <div className="rounded-lg border border-amber-300/20 bg-amber-500/10 p-3 text-sm text-amber-50">Un evento EPCIS declara un hecho de negocio: no reemplaza ni simula la verificacion criptografica SUN del tag NFC.</div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">Fundacion interoperable; no se presenta como certificacion GS1 ni como implementacion completa de todas las extensiones EPCIS/CBV.</p>
          </Card>
          <Card className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Captura server-side</p>
              <h3 className="mt-2 text-xl font-semibold text-white">Un recibo auditable para cada documento</h3>
            </div>
            <pre role="region" tabIndex={0} aria-label="Ejemplo EPCIS 2.0 en JSON" className="overflow-x-auto bg-slate-950 p-5 text-xs leading-6 text-cyan-50"><code>{epcisCode}</code></pre>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Por que lo construimos</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Para integrar sin quedar atrapado en contratos caros</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Muchos competidores venden plataformas potentes, pero la adopcion suele depender de procesos cerrados, integraciones a medida y pricing poco flexible. nexID debe ganar por velocidad de implementacion, costo de entrada, seguridad por politica y experiencia clara para consumidor, marca e inversor.
            </p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">QR no promete anti-copia criptografica: sirve para passport, leads, marketplace y analytics de bajo costo.</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">NFC seguro y SUN aportan evidencia criptográfica del tag y controles anti-replay; por sí solos no autentican el producto físico ni eliminan toda clonación.</div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-slate-200">POS + PIN separan lectura, compra y propiedad para no regalar ownership al curioso de gondola.</div>
            </div>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b border-white/10 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Contrato server-side</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Una llamada auditable, sin secretos en el navegador</h2>
            </div>
            <pre role="region" tabIndex={0} aria-label="Ejemplo de integracion server-side" className="overflow-x-auto bg-slate-950 p-5 text-xs leading-6 text-cyan-50"><code>{code}</code></pre>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Flujo end-to-end</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Del primer tap a un CRM que sirve para vender</h2>
            <div className="mt-5 grid gap-3">
              {flow.map((item) => (
                <div key={item} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">{item}</div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Expansion</p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Una plataforma para LATAM, Europa y escala global</h2>
            <div className="mt-5 space-y-3">
              {strategy.map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-white"><Boxes className="h-4 w-4 text-cyan-300" />{item.label}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.text}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-6">
          <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200"><KeyRound className="h-4 w-4" />Implementacion comercial</p>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">La empresa no compra solo tags: compra una capa operativa</h2>
              <p className="mt-4 text-sm leading-7 text-slate-300">Con SDK y APIs, nexID puede vender membresia, uso, integraciones, soporte, analytics y marketplace incluso cuando el cliente ya tiene QR, etiquetas o codigos de barra.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="sdk-commercial-benefit sdk-commercial-benefit--emerald rounded-lg border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm text-emerald-50"><Store className="mb-3 h-5 w-5" />POS/caja valida compra antes de ownership.</div>
              <div className="sdk-commercial-benefit sdk-commercial-benefit--cyan rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-4 text-sm text-cyan-50"><Code2 className="mb-3 h-5 w-5" />SDK reduce friccion para programadores.</div>
              <div className="sdk-commercial-benefit sdk-commercial-benefit--violet rounded-lg border border-violet-300/20 bg-violet-500/10 p-4 text-sm text-violet-50"><Webhook className="mb-3 h-5 w-5" />Webhooks alimentan procesos existentes.</div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
