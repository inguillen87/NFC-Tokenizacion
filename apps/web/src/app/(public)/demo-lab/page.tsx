import type { Metadata } from "next";
import Link from "next/link";
import { getWebI18n } from "../../../lib/locale";
import { JsonLd } from "../../../components/json-ld";
import { DemoLabClient } from "./demo-lab-client";
import { DemoLabThemeToggle } from "./demo-lab-hub-theme";
import {
  Box,
  Network,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Fingerprint,
  Leaf,
  Pill,
  Sparkles,
  Truck,
  Wine,
  Cpu,
  QrCode,
  CloudOff,
  FileText,
  Info,
  X,
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID — Probá la plataforma",
    description:
      "Simulá autenticidad NFC/QR, trazabilidad por lote, verificación offline, propiedad tokenizada y auditoría logística. Casos reales por industria.",
    openGraph: {
      title: "Demo Lab · nexID",
      images: [
        {
          url: `/opengraph-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Demo Lab · nexID",
      images: [
        `/twitter-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`,
      ],
    },
  };
}

type DemoLabPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function demoLabStructuredData(locale: string) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const title = isEn
    ? "nexID Demo Lab"
    : isBr
      ? "nexID Demo Lab"
      : "nexID Demo Lab";
  const description = isEn
    ? "Interactive product identity lab for NFC/QR verification, traceability, risk state and post-sale actions."
    : isBr
      ? "Laboratorio interativo de identidade de produto para NFC/QR, rastreabilidade, risco e pos-venda."
      : "Laboratorio interactivo de identidad de producto para NFC/QR, trazabilidad, riesgo y postventa.";
  const steps = isEn
    ? ["Tap the product", "Verify authenticity", "Trace route and context", "Unlock the business outcome"]
    : isBr
      ? ["Tocar o produto", "Verificar autenticidade", "Rastrear rota e contexto", "Liberar resultado comercial"]
      : ["Tocar el producto", "Verificar autenticidad", "Trazar ruta y contexto", "Activar resultado comercial"];

  return [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: title,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://nexid.lat/demo-lab",
      description,
      offers: {
        "@type": "Offer",
        category: "Enterprise pilot",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: title,
      description,
      step: steps.map((name, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name,
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "nexID",
          item: "https://nexid.lat/",
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Demo Lab",
          item: "https://nexid.lat/demo-lab",
        },
      ],
    },
  ];
}

// ─── Panel Content by Scenario / Vertical ───────────────────────────────────
const PANEL_CONTENT: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    gradientFrom: string;
    title: string;
    subtitle: string;
    context: string;
    value: string;
    doc: { label: string; href: string };
  }
> = {
  "polygon-ownership": {
    icon: Box,
    color: "text-violet-400",
    gradientFrom: "from-violet-500/20",
    title: "Propiedad Digital (Polygon)",
    subtitle: "El comprador reclama el producto como suyo con certificado NFT",
    context:
      "Cuando el comprador toca el producto, puede reclamar su propiedad digital en Polygon. Esto crea un gemelo digital único vinculado al producto físico: activa garantía transferible, beneficios de club exclusivos y la posibilidad de revender con certificado verificado.",
    value:
      "Cada reventa queda registrada y verificada. Eliminá el fraude de garantía y construí una relación directa y permanente con el dueño real del producto, no solo con el primer comprador.",
    doc: { label: "Ver arquitectura Polygon", href: "/docs#trust-layers" },
  },
  "iota-proof": {
    icon: Network,
    color: "text-emerald-400",
    gradientFrom: "from-emerald-500/20",
    title: "Auditoría de Cadena de Suministro (IOTA)",
    subtitle: "Evidencia logística anclable para exportaciones, IoT y DPP",
    context:
      "Cada evento clave de la cadena de suministro genera evidencia privada en nexID. Cuando la política lo exige, se anclan hashes o Merkle roots en IOTA; no se publican datos privados ni cada lectura individual.",
    value:
      "Cumplí normativas de exportación (SENASA, FDA, DPP europeo) con evidencia auditable. Clientes B2B y auditores pueden verificar pruebas sin exponer datos sensibles.",
    doc: { label: "Ver capa de auditoría", href: "/docs#trust-layers" },
  },
  "offline-verifier": {
    icon: CloudOff,
    color: "text-blue-400",
    gradientFrom: "from-blue-500/20",
    title: "Verificación Offline en Campo",
    subtitle: "Para galpones, agro, cavas e industria sin internet",
    context:
      "El celular o lector recibe un paquete de permisos y se puede usar en zonas sin señal. Registra cada verificación localmente. Al volver a conectarse, sincroniza todo con el servidor.",
    value:
      "Controlá la autenticidad de tus productos en el campo, en la cava o en la planta sin depender de conectividad. El resultado oficial llega al sincronizar.",
    doc: { label: "Ver arquitectura offline", href: "/docs#trust-layers" },
  },
  "qr-gs1": {
    icon: QrCode,
    color: "text-amber-400",
    gradientFrom: "from-amber-500/20",
    title: "Experiencia Core (QR / GS1)",
    subtitle: "Flujo completo de producto para pymes",
    context:
      "El cliente escanea el QR, ve la autenticidad, el origen del producto, el lote y puede activar beneficios de fidelización. Todo sin app, directo desde el celular.",
    value:
      "Arrancar con QR es la forma más económica de digitalizar tu producto. Podés sumar capas NFC y blockchain cuando lo necesites.",
    doc: { label: "Ver docs de integración", href: "/docs" },
  },
  seeds: {
    icon: Leaf,
    color: "text-emerald-400",
    gradientFrom: "from-emerald-500/20",
    title: "Agro — Semillas y Fitosanitarios",
    subtitle: "Trazabilidad de lote + canal seguro + soporte al aplicador",
    context:
      "El productor escanea el NFC/QR del envase antes de aplicar. nexID valida si el producto es original, verifica el lote y muestra instrucciones de uso responsable. Todo queda registrado en el CRM.",
    value:
      "Controlá el canal de distribución, eliminá el mercado gris y conectá con el productor final para asesoramiento técnico post-venta.",
    doc: { label: "Ver vertical Agro", href: "/docs" },
  },
  pharma: {
    icon: Pill,
    color: "text-sky-400",
    gradientFrom: "from-sky-500/20",
    title: "Pharma — Medicamentos y Cadena Fría",
    subtitle: "Recall por unidad, prospecto digital y cadena de frío",
    context:
      "El paciente o farmacéutico escanea el medicamento. nexID verifica la autenticidad del lote, muestra el prospecto digital y permite activar el recall de forma inmediata por unidad.",
    value:
      "Asegurate de que cada unidad vendida sea genuina. Ante un recall, identificás exactamente qué unidades están en circulación y dónde.",
    doc: { label: "Ver vertical Pharma", href: "/docs" },
  },
  wine: {
    icon: Wine,
    color: "text-cyan-400",
    gradientFrom: "from-cyan-500/20",
    title: "Vinos y Spirits Premium",
    subtitle: "NFC 424 TT + sello de apertura + ownership digital",
    context:
      "El coleccionista toca la botella con el celular. nexID verifica la autenticidad criptográfica, muestra el origen de la cosecha, registra si fue abierta y activa beneficios exclusivos del club.",
    value:
      "Diferenciá tus botellas premium en el mercado gris. El sello cambia de estado al abrir, probando integridad y activando la experiencia post-apertura.",
    doc: { label: "Ver vertical Vinos", href: "/docs" },
  },
  luxury: {
    icon: Sparkles,
    color: "text-violet-400",
    gradientFrom: "from-violet-500/20",
    title: "Lujo y Retail Premium",
    subtitle: "Gemelos digitales + garantía + experiencias exclusivas",
    context:
      "El comprador activa su producto con un tap NFC. Recibe el certificado de autenticidad, la garantía digital transferible y acceso al portal de experiencias exclusivas de la marca.",
    value:
      "Recuperá el control sobre el canal de reventa y construí una relación directa con el comprador final. Cada producto se convierte en un punto de contacto permanente.",
    doc: { label: "Ver vertical Lujo", href: "/docs" },
  },
  logistics: {
    icon: Truck,
    color: "text-lime-400",
    gradientFrom: "from-lime-500/20",
    title: "Logística y Cadena de Frío",
    subtitle: "UHF + NFC + IoT para rutas y temperatura",
    context:
      "Los pallets y bultos llevan tags UHF o QR. En cada punto de la cadena se registra la temperatura, la ubicación y el responsable. Todo queda en el historial de cadena de custodia.",
    value:
      "Demostrá a tus clientes que la cadena de frío se mantuvo intacta. Reducí disputas de entrega y cumplí normativas de exportación con evidencia auditable.",
    doc: { label: "Ver vertical Logística", href: "/docs" },
  },
  bracelet: {
    icon: Fingerprint,
    color: "text-amber-400",
    gradientFrom: "from-amber-500/20",
    title: "Eventos y Control de Acceso",
    subtitle: "Pulseras NFC + cashless + zonas VIP",
    context:
      "Las pulseras NFC permiten acceso a zonas, consumo cashless y validación de identidad. Cada toque es único y no se puede copiar ni reutilizar.",
    value:
      "Eliminá la cola de ingreso, controlá zonas VIP en tiempo real y conocé el patrón de consumo de cada asistente para optimizar la operación.",
    doc: { label: "Ver vertical Eventos", href: "/docs" },
  },
  electronics: {
    icon: Cpu,
    color: "text-blue-400",
    gradientFrom: "from-blue-500/20",
    title: "Electrónica y Garantía",
    subtitle: "Serialización + propiedad digital + soporte post-venta",
    context:
      "El comprador escanea el dispositivo y lo registra a su nombre. Desde ese momento, la garantía es digital, transferible y activable en cualquier momento sin factura.",
    value:
      "Cada unidad vendida queda registrada. Si el producto aparece en el mercado gris, podés rastrear el origen de la filtración. El soporte post-venta se activa con un tap.",
    doc: { label: "Ver vertical Electrónica", href: "/docs" },
  },
  textile: {
    icon: FileText,
    color: "text-slate-400",
    gradientFrom: "from-slate-500/20",
    title: "Textil y Pasaporte Digital (DPP)",
    subtitle: "Origen, composición y circularidad",
    context:
      "El tag del producto abre su pasaporte digital europeo (DPP). El consumidor ve el origen de los materiales, el impacto ambiental, las instrucciones de cuidado y cómo revender o reciclar.",
    value:
      "Cumplí la normativa DPP de la UE anticipadamente y diferenciá tu marca con transparencia. El pasaporte digital abre una relación directa con el cliente más allá de la venta.",
    doc: { label: "Ver vertical Textil", href: "/docs" },
  },
  perfume: {
    icon: Sparkles,
    color: "text-rose-400",
    gradientFrom: "from-rose-500/20",
    title: "Belleza y Cosméticos",
    subtitle: "Sello NFC + protección anti-refill + fidelización",
    context:
      "El cliente escanea el perfume o producto de skincare y verifica que el envase no fue rellenado. El tag cambia de estado al ser abierto por primera vez, garantizando la integridad del contenido.",
    value:
      "Protegete del refill fraudulento y el mercado gris. Conectá con tu cliente post-compra para ofrecer recarga, kit complementario y programa de fidelización.",
    doc: { label: "Ver vertical Belleza", href: "/docs" },
  },
  sneaker: {
    icon: Cpu,
    color: "text-indigo-400",
    gradientFrom: "from-indigo-500/20",
    title: "Zapatillas y Calzado",
    subtitle: "Drop verificado + certificado de propiedad + anti-fraude",
    context:
      "El comprador verifica la autenticidad de su par en el momento de la compra. Recibe el certificado digital de propiedad y acceso al club exclusivo de la marca.",
    value:
      "Controlá el mercado de reventa y distinguí productos originales de réplicas. Cada drop verificado genera datos de canal y comportamiento del comprador.",
    doc: { label: "Ver vertical Calzado", href: "/docs" },
  },
  bottle: {
    icon: QrCode,
    color: "text-sky-400",
    gradientFrom: "from-sky-500/20",
    title: "Envases y Refill Circular",
    subtitle: "Retorno + refill + circularidad con QR/NFC",
    context:
      "El envase retornable tiene un QR o NFC que identifica cada unidad. El cliente lo devuelve y el sistema registra el retorno, acredita el beneficio y habilita el refill verificado.",
    value:
      "Monetizá la circularidad de tu packaging. Conocé exactamente cuántas veces se reutilizó cada envase y cuántos clientes participan del programa de retorno.",
    doc: { label: "Ver vertical Envases", href: "/docs" },
  },
};

// Hub scenarios
const HUB_SCENARIOS = [
  {
    id: "polygon-ownership",
    icon: Box,
    color: "from-violet-400 to-purple-500",
    border: "hover:border-violet-400/50",
    shadow: "hover:shadow-violet-500/20",
    accent: "bg-violet-500/30 text-violet-200",
    accentGlow: "group-hover:shadow-violet-500/20",
    title: "Propiedad Digital (Polygon)",
    body: "El comprador reclama propiedad, activa garantía digital transferible y puede revender con certificado NFT verificado.",
  },
  {
    id: "iota-proof",
    icon: Network,
    color: "from-emerald-400 to-teal-500",
    border: "hover:border-emerald-400/50",
    shadow: "hover:shadow-emerald-500/20",
    accent: "bg-emerald-500/30 text-emerald-200",
    accentGlow: "group-hover:shadow-emerald-500/20",
    title: "Auditoría de Cadena de Suministro (IOTA)",
    body: "Ancla hashes o Merkle roots de hitos logísticos cuando la política de auditoría lo exige; no publica datos privados ni cada tap.",
  },
  {
    id: "offline-verifier",
    icon: CloudOff,
    color: "from-blue-400 to-cyan-500",
    border: "hover:border-blue-400/50",
    shadow: "hover:shadow-blue-500/20",
    accent: "bg-blue-500/30 text-blue-200",
    accentGlow: "group-hover:shadow-blue-500/20",
    title: "Verificación Offline",
    body: "Validación criptográfica local para galpones, agro, cavas e industria sin señal.",
  },
  {
    id: "qr-gs1",
    icon: QrCode,
    color: "from-amber-400 to-orange-500",
    border: "hover:border-amber-400/50",
    shadow: "hover:shadow-amber-500/20",
    accent: "bg-amber-500/30 text-amber-200",
    accentGlow: "group-hover:shadow-amber-500/20",
    title: "Experiencia Core (QR / GS1)",
    body: "Flujo completo de producto: origen, autenticidad, portal y fidelización del cliente.",
  },
];

const HUB_VERTICALS = [
  {
    vertical: "seeds",
    icon: Leaf,
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20",
    label: "Agro",
  },
  {
    vertical: "pharma",
    icon: Pill,
    color: "bg-sky-500/15 text-sky-400 border-sky-400/20",
    label: "Salud",
  },
  {
    vertical: "wine",
    icon: Wine,
    color: "bg-cyan-500/15 text-cyan-400 border-cyan-400/20",
    label: "Vinos",
  },
  {
    vertical: "luxury",
    icon: Sparkles,
    color: "bg-violet-500/15 text-violet-400 border-violet-400/20",
    label: "Lujo",
  },
  {
    vertical: "logistics",
    icon: Truck,
    color: "bg-lime-500/15 text-lime-400 border-lime-400/20",
    label: "Logística",
  },
  {
    vertical: "bracelet",
    icon: Fingerprint,
    color: "bg-amber-500/15 text-amber-400 border-amber-400/20",
    label: "Eventos",
  },
  {
    vertical: "electronics",
    icon: Cpu,
    color: "bg-blue-500/15 text-blue-400 border-blue-400/20",
    label: "Electrónica",
  },
  {
    vertical: "perfume",
    icon: Sparkles,
    color: "bg-rose-500/15 text-rose-400 border-rose-400/20",
    label: "Belleza",
  },
  {
    vertical: "sneaker",
    icon: Cpu,
    color: "bg-indigo-500/15 text-indigo-400 border-indigo-400/20",
    label: "Calzado",
  },
  {
    vertical: "textile",
    icon: FileText,
    color: "bg-slate-500/15 text-slate-300 border-slate-400/20",
    label: "Textil",
  },
  {
    vertical: "bottle",
    icon: QrCode,
    color: "bg-sky-500/15 text-sky-400 border-sky-400/20",
    label: "Envases",
  },
];

const HUB_STEPS = [
  {
    icon: Smartphone,
    label: "1. Toca",
    body: "El producto abre una lectura verificable para cliente, canal o auditor.",
  },
  {
    icon: ShieldCheck,
    label: "2. Verificó",
    body: "nexID resuelve autenticidad, estado fisico y politica del tenant.",
  },
  {
    icon: Network,
    label: "3. Trazó",
    body: "Muestra ruta, hitos, hash-only proof y anchors cuando aplica.",
  },
  {
    icon: ArrowRight,
    label: "4. Ganó",
    body: "Habilita garantia, reclamo, beneficio, CRM o salida enterprise.",
  },
];

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
  const structuredData = demoLabStructuredData(locale);
  const params = searchParams ? await searchParams : {};
  const initialVertical = firstParam(
    params.vertical || params.rubro || params.industry || params.useCase
  );
  const initialScenario = firstParam(
    params.scenario || params.proof || params.layer
  );

  // ── FULL-SCREEN SIMULATOR MODE ───────────────────────────────────────────
  if (initialScenario || initialVertical) {
    const panelKey = initialScenario ?? initialVertical ?? "qr-gs1";
    const panel = PANEL_CONTENT[panelKey] ?? PANEL_CONTENT["qr-gs1"];
    const PanelIcon = panel.icon;

    return (
      <div className="demo-lab-fullscreen-root">
        {structuredData.map((schema) => (
          <JsonLd key={schema["@type"]} data={schema} />
        ))}
        {/* ── Top infobar ─────────────────────────────────────────────────── */}
        <header className="demo-lab-infobar sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 px-4 py-3 text-slate-100 backdrop-blur-xl">
          <div className="demo-lab-infobar__inner mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Left: back + title */}
            <div className="demo-lab-infobar__left flex min-w-0 items-center gap-3">
              <Link href="/demo-lab" className="demo-lab-infobar__back inline-flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-black uppercase tracking-wider text-slate-200">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Hub</span>
              </Link>
              <div className="demo-lab-infobar__divider hidden h-8 w-px bg-white/10 md:block" />
              <div className={`demo-lab-infobar__icon grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/5 ${panel.color}`}>
                <PanelIcon className="w-4 h-4" />
              </div>
              <div className="demo-lab-infobar__title-block min-w-0">
                <span className="demo-lab-infobar__eyebrow block text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">nexID Demo Lab</span>
                <h1 className="demo-lab-infobar__title block truncate text-sm font-black text-white md:text-base">{panel.title}</h1>
              </div>
            </div>

            {/* Right: context pills + CTA */}
            <div className="demo-lab-infobar__right flex flex-wrap items-center gap-2">
              <span className="demo-lab-infobar__context-pill inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 text-xs font-bold text-slate-300">
                <Smartphone className="w-3 h-3" />
                {panel.subtitle}
              </span>
              <DemoLabThemeToggle />
              <Link
                href="/?contact=demo#contact-modal"
                className="demo-lab-infobar__cta inline-flex h-9 items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950"
              >
                Agendar demo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Context strip — collapsible details */}
          <details className="demo-lab-context-strip mx-auto mt-3 max-w-7xl rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
            <summary className="demo-lab-context-strip__trigger flex cursor-pointer items-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-200">
              <Info className="w-3.5 h-3.5" />
              <span>¿Cómo funciona este escenario?</span>
              <ArrowRight className="w-3 h-3 demo-lab-context-strip__chevron" />
            </summary>
            <div className="demo-lab-context-strip__body mt-3 grid gap-3 md:grid-cols-2">
              <div className="demo-lab-context-strip__card flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <div className={`demo-lab-context-strip__card-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 ${panel.color}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="demo-lab-context-strip__card-label text-xs font-black uppercase tracking-wider text-white">¿Cómo funciona?</p>
                  <p className="demo-lab-context-strip__card-text mt-1 text-xs leading-5 text-slate-400">{panel.context}</p>
                </div>
              </div>
              <div className="demo-lab-context-strip__card flex gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
                <div className="demo-lab-context-strip__card-icon grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/5 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="demo-lab-context-strip__card-label text-xs font-black uppercase tracking-wider text-white">Valor para tu negocio</p>
                  <p className="demo-lab-context-strip__card-text mt-1 text-xs leading-5 text-slate-400">{panel.value}</p>
                </div>
              </div>
              <div className="demo-lab-context-strip__actions flex flex-wrap gap-2 md:col-span-2">
                <Link href={panel.doc.href} className="demo-lab-context-strip__doc-link inline-flex h-9 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-bold text-slate-200">
                  {panel.doc.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                {panelKey === "iota-proof" || panelKey === "dual-proof" ? (
                  <Link href="/proof/verify" className="demo-lab-context-strip__doc-link inline-flex h-9 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-100">
                    Abrir Proof Verify & Decoder
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                ) : null}
                <Link
                  href="/?contact=demo#contact-modal"
                  className="demo-lab-context-strip__demo-btn inline-flex h-9 items-center rounded-full bg-cyan-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950"
                >
                  Agendar demo con asesor
                </Link>
              </div>
            </div>
          </details>
        </header>

        {/* ── Full-width simulator ─────────────────────────────────────────── */}
        <div className="demo-lab-fullscreen-stage">
          <div className="demo-lab-fullscreen-bg" aria-hidden />
          <DemoLabClient
            locale={locale}
            initialVertical={initialVertical}
            initialScenario={initialScenario}
          />
        </div>
      </div>
    );
  }

  // ── HUB MODE ────────────────────────────────────────────────────────────
  return (
    <div className="demo-lab-hub-root min-h-screen bg-[#03070f] text-white font-sans relative overflow-hidden">
      {structuredData.map((schema) => (
        <JsonLd key={schema["@type"]} data={schema} />
      ))}
      <div className="demo-lab-hub-bg absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="demo-lab-hub-bg__grid" />
        <div className="demo-lab-hub-bg__scan" />
      </div>

      {/* Top nav bar */}
      <nav className="demo-lab-hub-nav sticky top-0 z-50 grid min-h-[3.75rem] grid-cols-[auto_minmax(0,1fr)] items-start justify-between gap-3 border-b border-white/[0.06] bg-[#03070f]/90 px-4 py-2 backdrop-blur-xl md:flex md:items-center">
        <Link
          href="/"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-slate-300 transition-colors hover:border-cyan-300/40 hover:text-cyan-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>nexID</span>
        </Link>
        <div className="grid w-full min-w-0 justify-self-end grid-cols-[44px_auto] items-center justify-end gap-2 md:flex md:w-auto md:flex-wrap">
          <span className="hidden text-xs font-black uppercase tracking-[0.18em] text-slate-400 md:inline">
            Demo Lab
          </span>
          <span className="hidden h-4 w-px bg-white/10 md:inline" />
          {/* Theme toggle — reads localStorage "theme" key on mount */}
          <DemoLabThemeToggle />
          <Link
            href="/proof/verify"
            className="inline-flex min-h-10 items-center justify-self-end rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 text-xs font-black text-cyan-100 transition-colors hover:border-cyan-200/50 hover:bg-cyan-300/16 md:gap-2"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Proof Verify & Decoder</span>
            <span className="sm:hidden">Proof</span>
          </Link>
          <Link
            href="/?contact=demo#contact-modal"
            className="col-span-2 inline-flex min-h-10 items-center justify-self-end gap-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-teal-400 px-4 text-xs font-black tracking-wide text-slate-950 transition-all hover:brightness-110 md:col-span-1"
          >
            Agendar demo
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        {/* Header */}
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-12">
          <div className="relative mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200/18 bg-slate-950/70">
            <Fingerprint className="relative z-10 h-8 w-8 text-cyan-300" />
          </div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">
            nexID Platform
          </p>
          <h1 className="mb-5 text-4xl font-extrabold tracking-tight md:text-6xl">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-violet-400">
              Demo Lab
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Seleccioná una capa de confianza o tu industria para simular la
            experiencia completa end-to-end.
          </p>
        </div>

        <div className="demo-lab-hub-signal-grid mb-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HUB_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="demo-lab-hub-signal-card">
                <div className="demo-lab-hub-signal-card__icon">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <strong>{step.label}</strong>
                  <p>{step.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scenarios Grid */}
        <div className="mb-12">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Capas de confianza
          </p>
          <div className="demo-lab-hub-card-grid grid grid-cols-1 gap-4 md:grid-cols-2">
            {HUB_SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.id}
                  href={`/demo-lab?scenario=${s.id}`}
                  className={`demo-lab-hub-card group relative flex min-h-[10.5rem] flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-white/[0.1] bg-slate-950/70 p-5 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/40 hover:bg-slate-900/88 ${s.border} ${s.shadow}`}
                >
                  {/* Left accent bar — subtle at rest, vivid on hover */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${s.color} opacity-75 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${s.accentGlow} ${s.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="mb-1 text-base font-black text-slate-50 transition-colors">
                        {s.title}
                      </h3>
                      <p className="text-sm leading-6 text-slate-300">
                        {s.body}
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                    Abrir demo <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Verticals Grid */}
        <div>
          <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Por industria
          </p>
          <div className="demo-lab-hub-vertical-grid grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {HUB_VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.vertical}
                  href={`/demo-lab?vertical=${v.vertical}`}
                  className={`demo-lab-hub-pill group flex min-h-14 items-center gap-2.5 rounded-2xl border bg-slate-950/58 px-4 py-3 transition-all duration-200 hover:border-cyan-300/32 hover:bg-slate-900/82 ${v.color}`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${v.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="min-w-0 text-sm font-black text-slate-100">
                    {v.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-slate-400">
          <Link
            href="/"
            className="inline-flex items-center gap-2 transition-colors hover:text-cyan-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a nexID
          </Link>
          <Link
            href="/docs"
            className="transition-colors hover:text-cyan-200"
          >
            Documentación técnica
          </Link>
          <Link
            href="/?contact=demo#contact-modal"
            className="transition-colors hover:text-cyan-200"
          >
            Agendar demo
          </Link>
        </div>
      </div>
    </div>
  );
}
