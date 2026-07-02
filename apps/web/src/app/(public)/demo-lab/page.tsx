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
} from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID — Probá la plataforma",
    description: "Simulá autenticidad NFC/QR, trazabilidad por lote, verificación offline, propiedad tokenizada y auditoría logística. Casos reales por industria.",
    openGraph: {
      title: "Demo Lab · nexID",
      images: [{ url: `/opengraph-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Demo Lab · nexID",
      images: [`/twitter-image?surface=demo-lab&campaign=investor&locale=${encodeURIComponent(locale)}`],
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
const PANEL_CONTENT: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
  context: string;
  value: string;
  doc: { label: string; href: string };
}> = {
  "polygon-ownership": {
    icon: Box,
    color: "text-violet-400",
    title: "Propiedad Tokenizada (Polygon)",
    subtitle: "Registro digital de propiedad para productos premium",
    context: "Al abrir el producto, el comprador activa su gemelo digital en Polygon. Esto registra la transferencia de propiedad y habilita garantía, reventa y beneficios de marca exclusivos.",
    value: "Eliminá el fraude de garantía y conectá directamente con el comprador real. Cada reventa del producto queda verificada y trazada sin intermediarios.",
    doc: { label: "Ver arquitectura Polygon", href: "/docs#trust-layers" },
  },
  "iota-proof": {
    icon: Network,
    color: "text-emerald-400",
    title: "Auditoría Logística (IOTA)",
    subtitle: "Historial inalterable para cadena de custodia",
    context: "Cada evento clave del producto (fabricación, despacho, llegada, apertura) genera un hash que se registra en la red IOTA. Es un historial público e inalterable.",
    value: "Cumplí normativas de exportación, demo DPP europeo y auditá cualquier lote en tiempo real sin depender de un servidor centralizado.",
    doc: { label: "Ver capa de auditoría", href: "/docs#trust-layers" },
  },
  "offline-verifier": {
    icon: CloudOff,
    color: "text-blue-400",
    title: "Verificación Offline en Campo",
    subtitle: "Para galpones, agro, cavas e industria sin internet",
    context: "El celular o lector recibe un paquete de permisos y se puede usar en zonas sin señal. Registra cada verificación localmente. Al volver a conectarse, sincroniza todo con el servidor.",
    value: "Controlá la autenticidad de tus productos en el campo, en la cava o en la planta sin depender de conectividad. El resultado oficial llega al sincronizar.",
    doc: { label: "Ver arquitectura offline", href: "/docs#trust-layers" },
  },
  "qr-gs1": {
    icon: QrCode,
    color: "text-amber-400",
    title: "Experiencia Core (QR / GS1)",
    subtitle: "Flujo completo de producto para pymes",
    context: "El cliente escanea el QR, ve la autenticidad, el origen del producto, el lote y puede activar beneficios de fidelización. Todo sin app, directo desde el celular.",
    value: "Arrancar con QR es la forma más económica de digitalizar tu producto. Podés sumar capas NFC y blockchain cuando lo necesites.",
    doc: { label: "Ver docs de integración", href: "/docs" },
  },
  // Vertical-specific panels
  seeds: {
    icon: Leaf,
    color: "text-emerald-400",
    title: "Agro — Semillas y Fitosanitarios",
    subtitle: "Trazabilidad de lote + canal seguro + soporte al aplicador",
    context: "El productor escanea el NFC/QR del envase antes de aplicar. nexID valida si el producto es original, verifica el lote y muestra instrucciones de uso responsable. Todo queda registrado en el CRM.",
    value: "Controlá el canal de distribución, eliminá el mercado gris y conectá con el productor final para asesoramiento técnico post-venta.",
    doc: { label: "Ver vertical Agro", href: "/docs" },
  },
  pharma: {
    icon: Pill,
    color: "text-sky-400",
    title: "Pharma — Medicamentos y Cadena Fría",
    subtitle: "Recall por unidad, prospecto digital y cadena de frío",
    context: "El paciente o farmacéutico escanea el medicamento. nexID verifica la autenticidad del lote, muestra el prospecto digital y permite activar el recall de forma inmediata por unidad.",
    value: "Asegurate de que cada unidad vendida sea genuina. Ante un recall, identificás exactamente qué unidades están en circulación y dónde.",
    doc: { label: "Ver vertical Pharma", href: "/docs" },
  },
  wine: {
    icon: Wine,
    color: "text-cyan-400",
    title: "Vinos y Spirits Premium",
    subtitle: "NFC 424 TT + sello de apertura + ownership digital",
    context: "El coleccionista toca la botella con el celular. nexID verifica la autenticidad criptográfica, muestra el origen de la cosecha, registra si fue abierta y activa beneficios exclusivos del club.",
    value: "Diferenciá tus botellas premium en el mercado gris. El sello cambia de estado al abrir, probando integridad y activando la experiencia post-apertura.",
    doc: { label: "Ver vertical Vinos", href: "/docs" },
  },
  luxury: {
    icon: Sparkles,
    color: "text-violet-400",
    title: "Lujo y Retail Premium",
    subtitle: "Gemelos digitales + garantía + experiencias exclusivas",
    context: "El comprador activa su producto con un tap NFC. Recibe el certificado de autenticidad, la garantía digital transferible y acceso al portal de experiencias exclusivas de la marca.",
    value: "Recuperá el control sobre el canal de reventa y construí una relación directa con el comprador final. Cada producto se convierte en un punto de contacto permanente.",
    doc: { label: "Ver vertical Lujo", href: "/docs" },
  },
  logistics: {
    icon: Truck,
    color: "text-lime-400",
    title: "Logística y Cadena de Frío",
    subtitle: "UHF + NFC + IoT para rutas y temperatura",
    context: "Los pallets y bultos llevan tags UHF o QR. En cada punto de la cadena se registra la temperatura, la ubicación y el responsable. Todo queda en el historial de cadena de custodia.",
    value: "Demostrá a tus clientes que la cadena de frío se mantuvo intacta. Reducí disputas de entrega y cumplí normativas de exportación con evidencia inalterable.",
    doc: { label: "Ver vertical Logística", href: "/docs" },
  },
  bracelet: {
    icon: Fingerprint,
    color: "text-amber-400",
    title: "Eventos y Control de Acceso",
    subtitle: "Pulseras NFC + cashless + zonas VIP",
    context: "Las pulseras NFC permiten acceso a zonas, consumo cashless y validación de identidad. Cada toque es único y no se puede copiar ni reutilizar.",
    value: "Eliminá la cola de ingreso, controlá zonas VIP en tiempo real y conocé el patrón de consumo de cada asistente para optimizar la operación.",
    doc: { label: "Ver vertical Eventos", href: "/docs" },
  },
  electronics: {
    icon: Cpu,
    color: "text-blue-400",
    title: "Electrónica y Garantía",
    subtitle: "Serialización + propiedad digital + soporte post-venta",
    context: "El comprador escanea el dispositivo y lo registra a su nombre. Desde ese momento, la garantía es digital, transferible y activable en cualquier momento sin factura.",
    value: "Cada unidad vendida queda registrada. Si el producto aparece en el mercado gris, podés rastrear el origen de la filtración. El soporte post-venta se activa con un tap.",
    doc: { label: "Ver vertical Electrónica", href: "/docs" },
  },
  textile: {
    icon: FileText,
    color: "text-slate-400",
    title: "Textil y Pasaporte Digital (DPP)",
    subtitle: "Origen, composición y circularidad",
    context: "El tag del producto abre su pasaporte digital europeo (DPP). El consumidor ve el origen de los materiales, el impacto ambiental, las instrucciones de cuidado y cómo revender o reciclar.",
    value: "Cumplí la normativa DPP de la UE anticipadamente y diferenciá tu marca con transparencia. El pasaporte digital abre una relación directa con el cliente más allá de la venta.",
    doc: { label: "Ver vertical Textil", href: "/docs" },
  },
  perfume: {
    icon: Sparkles,
    color: "text-rose-400",
    title: "Belleza y Cosméticos",
    subtitle: "Sello NFC + protección anti-refill + fidelización",
    context: "El cliente escanea el perfume o producto de skincare y verifica que el envase no fue rellenado. El tag cambia de estado al ser abierto por primera vez, garantizando la integridad del contenido.",
    value: "Protegete del refill fraudulento y el mercado gris. Conectá con tu cliente post-compra para ofrecer recarga, kit complementario y programa de fidelización.",
    doc: { label: "Ver vertical Belleza", href: "/docs" },
  },
  sneaker: {
    icon: Cpu,
    color: "text-indigo-400",
    title: "Zapatillas y Calzado",
    subtitle: "Drop verificado + certificado de propiedad + anti-fraude",
    context: "El comprador verifica la autenticidad de su par en el momento de la compra. Recibe el certificado digital de propiedad y acceso al club exclusivo de la marca.",
    value: "Controlá el mercado de reventa y distinguí productos originales de réplicas. Cada drop verificado genera datos de canal y comportamiento del comprador.",
    doc: { label: "Ver vertical Calzado", href: "/docs" },
  },
  bottle: {
    icon: QrCode,
    color: "text-sky-400",
    title: "Envases y Refill Circular",
    subtitle: "Retorno + refill + circularidad con QR/NFC",
    context: "El envase retornable tiene un QR o NFC que identifica cada unidad. El cliente lo devuelve y el sistema registra el retorno, acredita el beneficio y habilita el refill verificado.",
    value: "Monetizá la circularidad de tu packaging. Conocé exactamente cuántas veces se reutilizó cada envase y cuántos clientes participan del programa de retorno.",
    doc: { label: "Ver vertical Envases", href: "/docs" },
  },
};

// Hub items
const HUB_SCENARIOS = [
  {
    id: "polygon-ownership",
    icon: Box,
    color: "from-violet-400 to-purple-500",
    border: "hover:border-violet-500/50",
    shadow: "hover:shadow-violet-500/10",
    accent: "bg-violet-500/20 text-violet-300",
    title: "Propiedad Digital (Polygon)",
    body: "Gemelos digitales y transferencia de propiedad tokenizada para productos premium.",
  },
  {
    id: "iota-proof",
    icon: Network,
    color: "from-emerald-400 to-teal-500",
    border: "hover:border-emerald-500/50",
    shadow: "hover:shadow-emerald-500/10",
    accent: "bg-emerald-500/20 text-emerald-300",
    title: "Auditoría Logística (IOTA)",
    body: "Historial público e inalterable para exportaciones, cadena de custodia y DPP.",
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
  { vertical: "seeds", icon: Leaf, color: "bg-emerald-500/15 text-emerald-400 border-emerald-400/20", label: "Agro" },
  { vertical: "pharma", icon: Pill, color: "bg-sky-500/15 text-sky-400 border-sky-400/20", label: "Salud" },
  { vertical: "wine", icon: Wine, color: "bg-cyan-500/15 text-cyan-400 border-cyan-400/20", label: "Vinos" },
  { vertical: "luxury", icon: Sparkles, color: "bg-violet-500/15 text-violet-400 border-violet-400/20", label: "Lujo" },
  { vertical: "logistics", icon: Truck, color: "bg-lime-500/15 text-lime-400 border-lime-400/20", label: "Logística" },
  { vertical: "bracelet", icon: Fingerprint, color: "bg-amber-500/15 text-amber-400 border-amber-400/20", label: "Eventos" },
  { vertical: "electronics", icon: Cpu, color: "bg-blue-500/15 text-blue-400 border-blue-400/20", label: "Electrónica" },
  { vertical: "perfume", icon: Sparkles, color: "bg-rose-500/15 text-rose-400 border-rose-400/20", label: "Belleza" },
  { vertical: "sneaker", icon: Cpu, color: "bg-indigo-500/15 text-indigo-400 border-indigo-400/20", label: "Calzado" },
  { vertical: "textile", icon: FileText, color: "bg-slate-500/15 text-slate-300 border-slate-400/20", label: "Textil" },
  { vertical: "bottle", icon: QrCode, color: "bg-sky-500/15 text-sky-400 border-sky-400/20", label: "Envases" },
];

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const { locale } = await getWebI18n();
  const params = searchParams ? await searchParams : {};
  const initialVertical = firstParam(params.vertical || params.rubro || params.industry || params.useCase);
  const initialScenario = firstParam(params.scenario || params.proof || params.layer);

  // ── SPLIT-SCREEN MODE ────────────────────────────────────────────────────
  if (initialScenario || initialVertical) {
    const panelKey = initialScenario ?? initialVertical ?? "qr-gs1";
    const panel = PANEL_CONTENT[panelKey] ?? PANEL_CONTENT["qr-gs1"];
    const PanelIcon = panel.icon;

    return (
      <div className="flex flex-col xl:flex-row min-h-screen bg-slate-950 text-slate-200">
        {/* ── Left Pane: Business Context ─────────────────────────────────── */}
        <div className="w-full xl:w-[500px] p-8 md:p-12 xl:p-16 flex flex-col border-b xl:border-b-0 xl:border-r border-white/10 bg-[#03070f] z-20 xl:h-screen xl:overflow-y-auto">
          <Link
            href="/demo-lab"
            className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Volver al Hub
          </Link>

          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${panel.color}`}>
              <PanelIcon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">nexID Demo Lab</p>
              <h1 className="text-xl font-extrabold text-white leading-tight">{panel.title}</h1>
            </div>
          </div>
          <p className="text-sm text-slate-400 mb-10 leading-relaxed">{panel.subtitle}</p>

          {/* Cards */}
          <div className="space-y-4 flex-1">
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl bg-white/5 ${panel.color}`}>
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">¿Cómo funciona?</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{panel.context}</p>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-sm">Valor para tu negocio</h3>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{panel.value}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/8 flex flex-col gap-3">
            <Link
              href={panel.doc.href}
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <ArrowRight className="w-4 h-4" /> {panel.doc.label}
            </Link>
            <Link
              href="/?contact=demo#contact-modal"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500/15 border border-cyan-400/20 text-cyan-300 font-bold px-4 py-2.5 text-sm hover:bg-cyan-500/25 transition-colors"
            >
              Agendar demo con asesor
            </Link>
          </div>
        </div>

        {/* ── Right Pane: Interactive Simulator ───────────────────────────── */}
        <div className="flex-1 relative bg-[#050509] xl:h-screen xl:overflow-y-auto">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-cyan-600/8 rounded-full blur-[120px]" />
            <div className="absolute bottom-[10%] right-[20%] w-[600px] h-[600px] bg-violet-500/8 rounded-full blur-[150px]" />
          </div>
          <div className="relative z-10 w-full h-full">
            <DemoLabClient locale={locale} initialVertical={initialVertical} initialScenario={initialScenario} />
          </div>
        </div>
      </div>
    );
  }

  // ── HUB MODE ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#03070f] text-white font-sans relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[8%] left-[18%] w-[600px] h-[600px] bg-violet-700/12 rounded-full blur-[130px]" />
        <div className="absolute bottom-[8%] right-[18%] w-[700px] h-[700px] bg-cyan-600/10 rounded-full blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-blue-900/8 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 py-16 md:py-24">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/5 border border-white/10 mb-6 relative">
            <div className="absolute inset-0 bg-cyan-500/15 rounded-2xl blur-md" />
            <Fingerprint className="w-8 h-8 text-cyan-300 relative z-10" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 mb-3">nexID Platform</p>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-5">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-violet-400">
              Demo Lab
            </span>
          </h1>
          <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
            Seleccioná una capa de confianza o tu industria para simular la experiencia completa end-to-end.
          </p>
        </div>

        {/* Scenarios Grid */}
        <div className="mb-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-600 mb-4">Capas de confianza</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HUB_SCENARIOS.map((s) => {
              const Icon = s.icon;
              return (
                <Link
                  key={s.id}
                  href={`/demo-lab?scenario=${s.id}`}
                  className={`group relative p-6 rounded-3xl bg-white/[0.025] border border-white/[0.07] ${s.border} backdrop-blur-md transition-all duration-300 overflow-hidden hover:bg-white/[0.05] hover:shadow-lg ${s.shadow}`}
                >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${s.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="flex items-start gap-4">
                    <div className={`w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${s.accent}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-white group-hover:text-slate-100 transition-colors mb-1">{s.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed">{s.body}</p>
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
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-600 mb-4">Por industria</p>
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
                  <span className="text-sm font-bold text-white/90">{v.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
          <Link href="/" className="inline-flex items-center gap-2 hover:text-slate-300 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a nexID
          </Link>
          <Link href="/docs" className="hover:text-slate-300 transition-colors">Documentación técnica</Link>
          <Link href="/?contact=demo#contact-modal" className="hover:text-slate-300 transition-colors">Agendar demo</Link>
        </div>
      </div>
    </div>
  );
}
