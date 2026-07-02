import type { Metadata } from "next";
import Link from "next/link";
import { getWebI18n } from "../../../lib/locale";
import { DemoLabClient } from "./demo-lab-client";
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
    subtitle: "Hitos logísticos inmutables para exportaciones, IoT y DPP",
    context:
      "Cada evento clave de la cadena de suministro — embolsado en planta, salida del depósito, traslado en frío, llegada al distribuidor, ingreso al comercio — genera un hash registrado en IOTA. Es un historial público, inalterable y sin costo de transacción.",
    value:
      "Cumplí normativas de exportación (SENASA, FDA, DPP europeo) con evidencia blockchain. Tus clientes B2B y auditores pueden verificar toda la cadena de custodia sin depender de tu servidor.",
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
      "Demostrá a tus clientes que la cadena de frío se mantuvo intacta. Reducí disputas de entrega y cumplí normativas de exportación con evidencia inalterable.",
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
    border: "hover:border-violet-500/50",
    shadow: "hover:shadow-violet-500/10",
    accent: "bg-violet-500/20 text-violet-300",
    title: "Propiedad Digital (Polygon)",
    body: "El comprador reclama propiedad, activa garantía digital transferible y puede revender con certificado NFT verificado.",
  },
  {
    id: "iota-proof",
    icon: Network,
    color: "from-emerald-400 to-teal-500",
    border: "hover:border-emerald-500/50",
    shadow: "hover:shadow-emerald-500/10",
    accent: "bg-emerald-500/20 text-emerald-300",
    title: "Auditoría de Cadena de Suministro (IOTA)",
    body: "Registra hitos de cadena de suministro (embolsado, traslado, llegada) en blockchain feeless para exportaciones y DPP europeo.",
  },
  {
    id: "offline-verifier",
    icon: CloudOff,
    color: "from-blue-400 to-cyan-500",
    border: "hover:border-blue-500/50",
    shadow: "hover:shadow-blue-500/10",
    accent: "bg-blue-500/20 text-blue-300",
    title: "Verificación Offline",
    body: "Validación criptográfica local para galpones, agro, cavas e industria sin señal.",
  },
  {
    id: "qr-gs1",
    icon: QrCode,
    color: "from-amber-400 to-orange-500",
    border: "hover:border-amber-500/50",
    shadow: "hover:shadow-amber-500/10",
    accent: "bg-amber-500/20 text-amber-300",
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

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
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
        {/* ── Top infobar ─────────────────────────────────────────────────── */}
        <header className="demo-lab-infobar">
          <div className="demo-lab-infobar__inner">
            {/* Left: back + title */}
            <div className="demo-lab-infobar__left">
              <Link href="/demo-lab" className="demo-lab-infobar__back">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Hub</span>
              </Link>
              <div className="demo-lab-infobar__divider" />
              <div className={`demo-lab-infobar__icon ${panel.color}`}>
                <PanelIcon className="w-4 h-4" />
              </div>
              <div className="demo-lab-infobar__title-block">
                <span className="demo-lab-infobar__eyebrow">nexID Demo Lab</span>
                <strong className="demo-lab-infobar__title">{panel.title}</strong>
              </div>
            </div>

            {/* Right: context pills + CTA */}
            <div className="demo-lab-infobar__right">
              <span className="demo-lab-infobar__context-pill">
                <Smartphone className="w-3 h-3" />
                {panel.subtitle}
              </span>
              <Link
                href="/?contact=demo#contact-modal"
                className="demo-lab-infobar__cta"
              >
                Agendar demo
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Context strip — collapsible details */}
          <details className="demo-lab-context-strip">
            <summary className="demo-lab-context-strip__trigger">
              <Info className="w-3.5 h-3.5" />
              <span>¿Cómo funciona este escenario?</span>
              <ArrowRight className="w-3 h-3 demo-lab-context-strip__chevron" />
            </summary>
            <div className="demo-lab-context-strip__body">
              <div className="demo-lab-context-strip__card">
                <div className={`demo-lab-context-strip__card-icon ${panel.color}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <p className="demo-lab-context-strip__card-label">¿Cómo funciona?</p>
                  <p className="demo-lab-context-strip__card-text">{panel.context}</p>
                </div>
              </div>
              <div className="demo-lab-context-strip__card">
                <div className="demo-lab-context-strip__card-icon text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <p className="demo-lab-context-strip__card-label">Valor para tu negocio</p>
                  <p className="demo-lab-context-strip__card-text">{panel.value}</p>
                </div>
              </div>
              <div className="demo-lab-context-strip__actions">
                <Link href={panel.doc.href} className="demo-lab-context-strip__doc-link">
                  {panel.doc.label}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/?contact=demo#contact-modal"
                  className="demo-lab-context-strip__demo-btn"
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
    <div className="min-h-screen bg-[#03070f] text-white font-sans relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[8%] left-[18%] w-[600px] h-[600px] bg-violet-700/12 rounded-full blur-[130px]" />
        <div className="absolute bottom-[8%] right-[18%] w-[700px] h-[700px] bg-cyan-600/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-blue-900/8 rounded-full blur-[120px]" />
      </div>

      {/* Top nav bar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between gap-4 px-5 h-13 border-b border-white/[0.06] bg-[#03070f]/90 backdrop-blur-xl" style={{ height: "3.25rem" }}>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>nexID</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-xs font-black uppercase tracking-[0.18em] text-slate-600">
            Demo Lab
          </span>
          <span className="hidden sm:inline w-px h-4 bg-white/10" />
          <Link
            href="/?contact=demo#contact-modal"
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/90 to-teal-500/90 text-slate-950 text-xs font-black tracking-wide hover:brightness-110 transition-all"
          >
            Agendar demo
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6 relative">
            <div className="absolute inset-0 bg-cyan-500/15 rounded-2xl blur-md" />
            <Fingerprint className="w-8 h-8 text-cyan-300 relative z-10" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 mb-3">
            nexID Platform
          </p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-5">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-violet-400">
              Demo Lab
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Seleccioná una capa de confianza o tu industria para simular la
            experiencia completa end-to-end.
          </p>
        </div>

        {/* Scenarios Grid */}
        <div className="mb-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-600 mb-4">
            Capas de confianza
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HUB_SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.id}
                  href={`/demo-lab?scenario=${s.id}`}
                  className={`group relative p-6 rounded-3xl bg-white/[0.025] border border-white/[0.07] ${s.border} backdrop-blur-md transition-all duration-300 overflow-hidden hover:bg-white/[0.05] hover:shadow-lg ${s.shadow}`}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${s.color} opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${s.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white group-hover:text-slate-100 transition-colors mb-1">
                        {s.title}
                      </h3>
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {s.body}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors shrink-0 mt-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Verticals Grid */}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-600 mb-4">
            Por industria
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {HUB_VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <Link
                  key={v.vertical}
                  href={`/demo-lab?vertical=${v.vertical}`}
                  className={`group flex items-center gap-3 px-4 py-3.5 rounded-2xl border bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200 ${v.color}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-bold text-white/90">
                    {v.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
          <Link
            href="/"
            className="inline-flex items-center gap-2 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a nexID
          </Link>
          <Link
            href="/docs"
            className="hover:text-slate-300 transition-colors"
          >
            Documentación técnica
          </Link>
          <Link
            href="/?contact=demo#contact-modal"
            className="hover:text-slate-300 transition-colors"
          >
            Agendar demo
          </Link>
        </div>
      </div>
    </div>
  );
}
