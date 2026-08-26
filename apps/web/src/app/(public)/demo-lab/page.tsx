import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import type { ComponentType } from "react";
import type { AppLocale } from "@product/config";
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
  Database,
  Factory,
} from "lucide-react";
import {
  DEMO_LAB_MODE_ORDER,
  DEMO_LAB_SCENARIO_CATALOG,
  getDemoLabModeCopy,
  getDemoLabScenarioStatus,
  isDemoLabScenarioId,
  type DemoLabScenarioId,
} from "./demo-lab-scenario-catalog";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getWebI18n();
  return {
    title: "Demo Lab · nexID — Probá la plataforma",
    description:
      "Simulá validación de mensajes NFC/QR, trazabilidad declarada por lote, decisión offline provisional, ownership tokenizado y eventos logísticos reportados.",
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

const PROOF_VERIFY_HANDOFF_SCENARIOS: ReadonlySet<string> = new Set([
  "qr-gs1",
  "nfc-424",
  "offline-verifier",
  "polygon-ownership",
  "iota-proof",
  "dual-proof",
  "sensor-evidence",
  "authorized-network",
]);

function buildProofVerifierHandoffHref(scenario?: string) {
  const requestedScenario = String(scenario || "").trim().toLowerCase();
  const safeScenario = PROOF_VERIFY_HANDOFF_SCENARIOS.has(requestedScenario)
    ? requestedScenario
    : "hub";
  if (safeScenario === "polygon-ownership") return "/proof/ownership";

  const returnTo = safeScenario === "hub"
    ? "/demo-lab"
    : `/demo-lab?scenario=${encodeURIComponent(safeScenario)}`;
  const query = new URLSearchParams({
    scenario: safeScenario,
    return_to: returnTo,
  });
  const routesToIota = safeScenario === "iota-proof"
    || safeScenario === "dual-proof"
    || safeScenario === "sensor-evidence";
  if (routesToIota) query.set("layer", "iota");

  return `/proof/verify?${query.toString()}${routesToIota ? "#iota-proof" : ""}`;
}

function resolveDemoLabLocale(value: string | string[] | undefined): AppLocale | null {
  const raw = firstParam(value)?.trim().toLowerCase();
  if (!raw) return null;
  if (raw === "en") return "en";
  if (raw === "pt" || raw === "pt-br") return "pt-BR";
  if (raw === "es" || raw === "es-ar") return "es-AR";
  return null;
}

function buildDemoLabReturnTo(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (key === "theme" || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
      return;
    }
    query.set(key, value);
  });
  const search = query.toString();
  return search ? `/demo-lab?${search}` : "/demo-lab";
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
    ? ["Read the tag", "Validate message evidence", "Review reported events and context", "Unlock the permitted outcome"]
    : isBr
      ? ["Ler o tag", "Validar evidência da mensagem", "Revisar eventos reportados e contexto", "Liberar resultado permitido"]
      : ["Leer el tag", "Validar evidencia del mensaje", "Revisar eventos reportados y contexto", "Activar resultado permitido"];

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
    title: "Polygon Ownership Demo",
    subtitle: "El comprador inicia una solicitud; el certificado confirma el mint testnet solo si pasan los checks actuales",
    context:
      "Cuando el comprador toca el producto, puede solicitar ownership en Polygon después de validar el mensaje NFC, la evidencia disponible y la política tenant. El demo conecta con un certificado público que muestra el estado actual de sus consultas de owner, mint y metadata HTTPS.",
    value:
      "Cada ownership aprobado puede habilitar garantia, reventa y club sin exponer identidad ni factura on-chain. La transaccion prueba el mint; nexID conserva contexto, permisos y datos privados.",
    doc: { label: "Abrir certificado Polygon", href: "/proof/ownership" },
  },
  "iota-proof": {
    icon: Network,
    color: "text-emerald-400",
    gradientFrom: "from-emerald-500/20",
    title: "IOTA Proof Layer Demo",
    subtitle: "Evidencia logística anclable para exportaciones, IoT y DPP",
    context:
      "Cada evento clave de la cadena de suministro genera evidencia privada en nexID. Cuando la política lo exige, se anclan hashes o Merkle roots en IOTA; no se publican datos privados ni cada lectura individual.",
    value:
      "Prepará evidencia auditable para procesos de exportación, IoT o DPP cuando existan eventos de fuente trazable y revisión legal o regulatoria aplicable. Clientes B2B y auditores pueden verificar recibos hash-only sin exponer los datos privados seleccionados; nexID no garantiza cumplimiento ni certificación por sí solo.",
    doc: { label: "Ver capa de auditoría", href: "/docs#trust-layers" },
  },
  "offline-verifier": {
    icon: CloudOff,
    color: "text-blue-400",
    gradientFrom: "from-blue-500/20",
    title: "Offline Field Scan Demo",
    subtitle: "Para galpones, agro, cavas e industria sin internet",
    context:
      "El celular o lector recibe un paquete de permisos y se puede usar en zonas sin señal. Registra cada verificación localmente. Al volver a conectarse, sincroniza todo con el servidor.",
    value:
      "Validá localmente el mensaje y la política disponible para operar en campo, cava o planta. Es una decisión provisional; el resultado oficial llega al sincronizar y no autentica por sí solo el producto físico.",
    doc: { label: "Ver arquitectura offline", href: "/docs#trust-layers" },
  },
  "dual-proof": {
    icon: FileText,
    color: "text-teal-300",
    gradientFrom: "from-teal-500/20",
    title: "Dual Proof DPP",
    subtitle: "Pasaporte, ownership opcional y evidencia hash-only sin mezclar responsabilidades",
    context:
      "Este recorrido ilustra como QR/GS1 resuelve identidad declarada, NFC aporta evidencia del mensaje del tag, Polygon puede representar ownership aprobado e IOTA puede anclar hashes seleccionados. No escribe cada tap on-chain y ninguna capa prueba por si sola el objeto fisico.",
    value:
      "Permite explicar una arquitectura DPP enterprise manteniendo PII, documentos y reglas del tenant fuera de la cadena. Las pruebas de red se confirman solo en sus verificadores runtime.",
    doc: { label: "Ver modelo DPP", href: "/docs#trust-layers" },
  },
  "sensor-evidence": {
    icon: Cpu,
    color: "text-lime-300",
    gradientFrom: "from-lime-500/20",
    title: "Sensor Evidence Demo",
    subtitle: "Hitos reportados por UHF, IoT o sensores con cobertura y fuente visibles",
    context:
      "El escenario usa mediciones ilustrativas y declaradas para mostrar como un hito de pallet, temperatura o custodia puede convertirse en evidencia auditable. Los intervalos sin datos permanecen desconocidos y no se inventa una ruta fisica.",
    value:
      "Operaciones puede conservar el stream privado y publicar solo el hash de hitos seleccionados cuando la politica lo exige, sin exponer datos industriales sensibles.",
    doc: { label: "Ver flujo de evidencia", href: "/docs#trust-layers" },
  },
  "authorized-network": {
    icon: ShieldCheck,
    color: "text-sky-300",
    gradientFrom: "from-sky-500/20",
    title: "Authorized Network Demo",
    subtitle: "Roles acotados para supplier, reseller, integrador y tenant",
    context:
      "Este recorrido RBAC es ilustrativo: cada actor ve solo el pedido, batch o tarea que su rol permite. No afirma una relacion de partner y no entrega claves NFC crudas, secretos de infraestructura ni acceso a la base de datos.",
    value:
      "Escala la red operativa con permisos por tenant, trazabilidad de acciones y separacion de custodia, manteniendo la exportacion segura bajo control autorizado.",
    doc: { label: "Ver modelo de acceso", href: "/docs#trust-layers" },
  },
  "supplier-batch-factory": {
    icon: Factory,
    color: "text-orange-300",
    gradientFrom: "from-orange-500/20",
    title: "Supplier Batch Factory Demo",
    subtitle: "Orden, sub-batches, perfiles, QA y activacion en un plan controlado",
    context:
      "La fabrica muestra un plan simulado: tenant, pedido, cantidad, batches, sub-batches, perfil NFC, version de clave y gates de QA. No crea un pedido real, no programa tags y no exporta material de custodia.",
    value:
      "Ventas, operaciones y el proveedor pueden revisar cantidades y criterios de aceptacion antes de autorizar un pack seguro, reduciendo errores sin revelar secretos NFC.",
    doc: { label: "Ver arquitectura de lotes", href: "/docs" },
  },
  "qr-gs1": {
    icon: QrCode,
    color: "text-amber-400",
    gradientFrom: "from-amber-500/20",
    title: "Experiencia Core (QR / GS1)",
    subtitle: "Flujo completo de producto para pymes",
    context:
      "El cliente escanea el QR y consulta identidad digital, origen y lote declarados, política del resolver y beneficios disponibles. Un QR no autentica por sí solo el producto físico.",
    value:
      "Arrancar con QR es la forma más económica de digitalizar tu producto. Podés sumar capas NFC y blockchain cuando lo necesites.",
    doc: { label: "Ver docs de integración", href: "/docs" },
  },
  "nfc-424": {
    icon: ShieldCheck,
    color: "text-cyan-400",
    gradientFrom: "from-cyan-500/20",
    title: "NFC 424 DNA — Toque criptográfico",
    subtitle: "SUN dinámico + UID + control anti-replay",
    context:
      "El usuario acerca el celular a un NTAG 424 DNA. nexID evalúa SUN/CMAC, UID, contador y política del tenant antes de habilitar garantía, rewards, soporte o reclamo.",
    value:
      "La capa NFC vincula una interacción digital con el identificador del tag y permite detectar mensajes repetidos, copiados o reproducidos según contador y política, sin exponer secretos del tag ni claves del KMS al navegador.",
    doc: { label: "Ver capa NFC", href: "/docs#trust-layers" },
  },
  seeds: {
    icon: Leaf,
    color: "text-emerald-400",
    gradientFrom: "from-emerald-500/20",
    title: "Agro — Semillas y Fitosanitarios",
    subtitle: "Trazabilidad de lote + canal seguro + soporte al aplicador",
    context:
      "El productor escanea el NFC/QR del envase antes de aplicar. nexID valida el mensaje y la evidencia digital asociada, consulta el lote declarado y muestra instrucciones de uso responsable. La autenticidad física requiere controles adicionales del fabricante y la cadena de suministro. Los eventos recibidos quedan disponibles para el CRM cuando la integración POS, API o webhook está configurada; no se infiere una venta ni una ubicación no reportada.",
    value:
      "Aumentá la visibilidad del canal, detectá desvíos y reducí la exposición al mercado gris mientras conectás con el productor final para asesoramiento técnico post-venta.",
    doc: { label: "Ver vertical Agro", href: "/docs" },
  },
  pharma: {
    icon: Pill,
    color: "text-sky-400",
    gradientFrom: "from-sky-500/20",
    title: "Pharma — Medicamentos y Cadena Fría",
    subtitle: "Recall por unidad, prospecto digital y cadena de frío",
    context:
      "El paciente o farmacéutico escanea la unidad. nexID valida el mensaje del tag y el registro de lote, muestra el prospecto digital y permite activar un recall por unidad según la política.",
    value:
      "Consultá qué unidades están registradas y cuáles reportaron eventos durante un recall. La evidencia digital no demuestra por sí sola el contenido, la autenticidad física ni la ubicación actual.",
    doc: { label: "Ver vertical Pharma", href: "/docs" },
  },
  wine: {
    icon: Wine,
    color: "text-cyan-400",
    gradientFrom: "from-cyan-500/20",
    title: "Vinos y Spirits Premium",
    subtitle: "NFC 424 TT + sello de apertura + ownership digital",
    context:
      "El coleccionista lee el tag con el celular. nexID valida el mensaje dinámico, muestra origen y cosecha declarados, y presenta el estado TT reportado antes de evaluar beneficios del club.",
    value:
      "Sumá evidencia digital y una señal TT al control del mercado gris. Su significado físico depende de la integración con el packaging; no prueba por sí sola contenido, origen o autenticidad de la botella.",
    doc: { label: "Ver vertical Vinos", href: "/docs" },
  },
  luxury: {
    icon: Sparkles,
    color: "text-violet-400",
    gradientFrom: "from-violet-500/20",
    title: "Lujo y Retail Premium",
    subtitle: "Gemelos digitales + garantía + experiencias exclusivas",
    context:
      "El comprador valida el mensaje NFC y puede solicitar un certificado digital, garantía o acceso al portal según identidad, compra y política de la marca. El certificado no autentica por sí solo el objeto físico.",
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
      "Los pallets y bultos pueden asociarse a tags UHF o QR. Cada lectura o integración de sensor reporta, cuando está disponible, temperatura, ubicación, responsable y cobertura temporal; los intervalos sin evidencia quedan visibles.",
    value:
      "Mostrá las mediciones recibidas, su fuente y cobertura para reducir disputas de entrega. La evidencia no afirma continuidad de frío fuera de los intervalos observados ni reemplaza certificaciones regulatorias.",
    doc: { label: "Ver vertical Logística", href: "/docs" },
  },
  bracelet: {
    icon: Fingerprint,
    color: "text-amber-400",
    gradientFrom: "from-amber-500/20",
    title: "Eventos y Control de Acceso",
    subtitle: "Pulseras NFC + cashless + zonas VIP",
    context:
      "Las pulseras NFC permiten acceso a zonas, consumo cashless y validación de credenciales. Cada lectura evalúa mensaje, contador y política para detectar o rechazar replays; esos controles no vuelven imposible copiar el soporte físico.",
    value:
      "Agilizá el ingreso, monitoreá los eventos reportados por zona y analizá patrones de consumo para optimizar la operación.",
    doc: { label: "Ver vertical Eventos", href: "/docs" },
  },
  electronics: {
    icon: Cpu,
    color: "text-blue-400",
    gradientFrom: "from-blue-500/20",
    title: "Electrónica y Garantía",
    subtitle: "Serialización + propiedad digital + soporte post-venta",
    context:
      "El comprador escanea el dispositivo y solicita registrarlo a su nombre. La activación y cualquier transferencia de la garantía dependen de identidad, evidencia de compra y política de la marca; el tap no reemplaza por sí solo la factura ni autoriza una transferencia on-chain.",
    value:
      "Con serialización e integración POS/eventos, las unidades reportadas pueden vincularse con la venta, el canal y la evidencia disponible. Esas señales ayudan a investigar posibles desvíos —no atribuyen por sí solas el origen de una filtración— y permiten solicitar soporte sujeto a identidad, compra, política de marca y revisión legal aplicable.",
    doc: { label: "Ver vertical Electrónica", href: "/docs" },
  },
  textile: {
    icon: FileText,
    color: "text-slate-400",
    gradientFrom: "from-slate-500/20",
    title: "Textil y Pasaporte Digital (DPP)",
    subtitle: "Origen, composición y circularidad",
    context:
      "El tag abre un pasaporte digital configurable. El consumidor puede consultar los datos declarados sobre materiales, impacto, cuidado, reventa o reciclaje; el alcance regulatorio depende del producto, mercado, datos fuente y validación legal del fabricante.",
    value:
      "Prepará una base trazable para los requisitos DPP aplicables y diferenciá tu marca con información verificable. La configuración debe revisarse contra la normativa vigente y no constituye por sí sola certificación ni asesoramiento legal.",
    doc: { label: "Ver vertical Textil", href: "/docs" },
  },
  perfume: {
    icon: Sparkles,
    color: "text-rose-400",
    gradientFrom: "from-rose-500/20",
    title: "Belleza y Cosméticos",
    subtitle: "Sello NFC + señal anti-refill + fidelización",
    context:
      "El cliente escanea el perfume o producto de skincare y consulta el estado reportado por el chip o circuito de sello: cerrado, abierto o alterado. Esa señal no verifica la composición ni demuestra por sí sola que el envase nunca fue rellenado.",
    value:
      "Sumá una señal operativa frente al refill fraudulento y el mercado gris, combinada con controles físicos, lote y canal. Conectá con tu cliente post-compra para ofrecer recarga, kit complementario y fidelización.",
    doc: { label: "Ver vertical Belleza", href: "/docs" },
  },
  sneaker: {
    icon: Cpu,
    color: "text-indigo-400",
    gradientFrom: "from-indigo-500/20",
    title: "Zapatillas y Calzado",
    subtitle: "Drop conectado + registro de propiedad + controles anti-fraude",
    context:
      "El comprador valida el mensaje dinámico del tag al comprar. Si la política del tenant lo permite, puede solicitar un registro digital de propiedad y acceso al club. Esa evidencia no autentica por sí sola el calzado físico.",
    value:
      "Controlá la reventa con evidencia del tag y datos de canal declarados. Cada interacción del drop conectado aporta señales para revisar el canal y entender el comportamiento del comprador.",
    doc: { label: "Ver vertical Calzado", href: "/docs" },
  },
  bottle: {
    icon: QrCode,
    color: "text-sky-400",
    gradientFrom: "from-sky-500/20",
    title: "Envases y Refill Circular",
    subtitle: "Retorno + refill + circularidad con QR/NFC",
    context:
      "El envase retornable tiene un QR o NFC que identifica cada unidad. Un operador puede registrar retorno y refill bajo política; el tap aislado no demuestra limpieza, composición ni que la recarga física ocurrió.",
    value:
      "Medí retornos y recargas registrados para operar la circularidad del packaging. Las métricas describen eventos persistidos, no certifican por sí solas el estado físico o el contenido del envase.",
    doc: { label: "Ver vertical Envases", href: "/docs" },
  },
};

// Hub scenarios
type HubScenario = {
  id: DemoLabScenarioId;
  icon: ComponentType<{ className?: string }>;
  color: string;
  border: string;
  shadow: string;
  accent: string;
  accentGlow: string;
  title: string;
  body: string;
};

const HUB_SCENARIOS: HubScenario[] = [
  {
    id: "polygon-ownership",
    icon: Box,
    color: "from-violet-400 to-purple-500",
    border: "hover:border-violet-400/50",
    shadow: "hover:shadow-violet-500/20",
    accent: "bg-violet-500/30 text-violet-200",
    accentGlow: "group-hover:shadow-violet-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["polygon-ownership"].title,
    body: "El comprador inicia ownership y abre el certificado testnet. Solo aparece confirmado cuando los checks runtime de contrato, mint, owner y metadata coinciden.",
  },
  {
    id: "iota-proof",
    icon: Network,
    color: "from-emerald-400 to-teal-500",
    border: "hover:border-emerald-400/50",
    shadow: "hover:shadow-emerald-500/20",
    accent: "bg-emerald-500/30 text-emerald-200",
    accentGlow: "group-hover:shadow-emerald-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["iota-proof"].title,
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
    title: DEMO_LAB_SCENARIO_CATALOG["offline-verifier"].title,
    body: "Captura local y veredicto provisional para campo, galpones o industria; el backend decide al sincronizar.",
  },
  {
    id: "qr-gs1",
    icon: QrCode,
    color: "from-amber-400 to-orange-500",
    border: "hover:border-amber-400/50",
    shadow: "hover:shadow-amber-500/20",
    accent: "bg-amber-500/30 text-amber-200",
    accentGlow: "group-hover:shadow-amber-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["qr-gs1"].title,
    body: "Flujo de identidad digital: origen y lote declarados, resolver, portal y fidelización.",
  },
  {
    id: "nfc-424",
    icon: ShieldCheck,
    color: "from-cyan-400 to-sky-500",
    border: "hover:border-cyan-400/50",
    shadow: "hover:shadow-cyan-500/20",
    accent: "bg-cyan-500/30 text-cyan-100",
    accentGlow: "group-hover:shadow-cyan-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["nfc-424"].title,
    body: "Mensaje dinámico para validar evidencia del tag y detectar replay. El objeto físico requiere controles adicionales; garantía, rewards o soporte dependen de la política.",
  },
  {
    id: "dual-proof",
    icon: FileText,
    color: "from-teal-300 to-indigo-500",
    border: "hover:border-teal-300/50",
    shadow: "hover:shadow-teal-500/20",
    accent: "bg-teal-500/24 text-teal-100",
    accentGlow: "group-hover:shadow-teal-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["dual-proof"].title,
    body: "Historia enterprise completa: identidad de producto, ownership opcional y evidencia hash-only para revisión de compliance o auditoría externa.",
  },
  {
    id: "sensor-evidence",
    icon: Cpu,
    color: "from-lime-300 to-emerald-500",
    border: "hover:border-lime-300/50",
    shadow: "hover:shadow-lime-500/20",
    accent: "bg-lime-500/24 text-lime-100",
    accentGlow: "group-hover:shadow-lime-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["sensor-evidence"].title,
    body: "Convierte pallets, cajas, temperatura y eventos industriales en hitos auditables sin exponer streams ni datos operativos sensibles.",
  },
  {
    id: "authorized-network",
    icon: Database,
    color: "from-slate-300 to-cyan-500",
    border: "hover:border-slate-300/50",
    shadow: "hover:shadow-cyan-500/16",
    accent: "bg-slate-500/24 text-slate-100",
    accentGlow: "group-hover:shadow-slate-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["authorized-network"].title,
    body: "Controla impresores, integradores, resellers y proveedores para que cada emisión o auditoría respete roles, tenant y política.",
  },
  {
    id: "supplier-batch-factory",
    icon: Factory,
    color: "from-orange-300 to-amber-500",
    border: "hover:border-orange-300/50",
    shadow: "hover:shadow-orange-500/16",
    accent: "bg-orange-500/24 text-orange-100",
    accentGlow: "group-hover:shadow-orange-500/20",
    title: DEMO_LAB_SCENARIO_CATALOG["supplier-batch-factory"].title,
    body: "Planifica pedido, batches, sub-batches, perfil NFC y gates de QA sin crear una orden ni revelar material de custodia.",
  },
];

const HUB_SCENARIO_ORDER: DemoLabScenarioId[] = [
  "qr-gs1",
  "nfc-424",
  "offline-verifier",
  "supplier-batch-factory",
  "authorized-network",
  "sensor-evidence",
  "polygon-ownership",
  "iota-proof",
  "dual-proof",
];
const HUB_SCENARIOS_BY_ID = new Map(HUB_SCENARIOS.map((scenario) => [scenario.id, scenario]));
const HUB_ORDERED_SCENARIOS = HUB_SCENARIO_ORDER
  .map((id) => HUB_SCENARIOS_BY_ID.get(id))
  .filter((scenario): scenario is HubScenario => Boolean(scenario));
const HUB_QUICK_LAUNCH_SCENARIOS = HUB_ORDERED_SCENARIOS.slice(0, 4);

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
    body: "El tag abre una lectura digital para cliente, canal o auditor.",
  },
  {
    icon: ShieldCheck,
    label: "2. Validó tag",
    body: "nexID valida el mensaje y muestra el estado TT reportado y la política del tenant.",
  },
  {
    icon: Network,
    label: "3. Trazó",
    body: "Muestra eventos e hitos reportados, hash-only proof y anchors cuando aplica; no prueba recorrido físico.",
  },
  {
    icon: ArrowRight,
    label: "4. Ganó",
    body: "Habilita garantía, reclamo, beneficio, CRM o salida enterprise.",
  },
];

const HUB_EXECUTIVE_PATHS = [
  {
    icon: Smartphone,
    eyebrow: "Demo en 60s",
    title: "Probá el flujo completo",
    body: "Tocá, validá el tag, revisá la evidencia y activá un resultado comercial sin perderte en pantallas técnicas.",
    href: "/demo-lab?scenario=qr-gs1",
    cta: "Abrir wizard",
  },
  {
    icon: Network,
    eyebrow: "IOTA / hash-only",
    title: "Verificá evidencia pública",
    body: "Un auditor pega un hash y comprueba inclusión sin ver clientes, rutas ni documentos privados.",
    href: buildProofVerifierHandoffHref(),
    cta: "Abrir Proof Verify",
  },
  {
    icon: Box,
    eyebrow: "Polygon opcional - confirmar RPC",
    title: "Mostrá ownership y garantía",
    body: "Después de validar el mensaje, la identidad, la compra y la política, el cliente puede solicitar ownership, garantía o reventa registrada.",
    href: "/demo-lab?scenario=polygon-ownership",
    cta: "Ver ownership",
  },
  {
    icon: Database,
    eyebrow: "API / webhooks",
    title: "Conecta el resultado",
    body: "Con una integración configurada, CRM, recall, garantía, loyalty o webhooks pueden recibir la decisión y su evidencia disponible.",
    href: "/sdk",
    cta: "Ver SDK/API",
  },
];

const HUB_PROOF_STACK = [
  {
    label: "nexID Core",
    title: "Dato privado + reglas de negocio",
    body: "UID, tenant, lote, permisos, estado del producto, CRM y documentos sensibles quedan bajo control de la empresa.",
    status: "Privado",
  },
  {
    label: "IOTA",
    title: "Recibo público hash-only",
    body: "Publica hashes o Merkle roots para auditoría externa cuando hay que probar que una evidencia existía y no cambió.",
    status: "Audit-ready",
  },
  {
    label: "Polygon",
    title: "Propiedad, garantía y reventa",
    body: "Se usa cuando el comprador solicita ownership, certificado NFT, garantía transferible o un beneficio comercial verificable.",
    status: "Opcional",
  },
  {
    label: "API / SDK",
    title: "Conexión con ERP, CRM y portal",
    body: "El mismo flujo entra por QR, NFC, app de campo o API; cada canal recibe una salida clara para operar.",
    status: "Integrable",
  },
];

export default async function DemoLabPage({ searchParams }: DemoLabPageProps) {
  const params = searchParams ? await searchParams : {};
  const cookieStore = await cookies();
  const locale =
    resolveDemoLabLocale(params.locale || params.lang) ??
    resolveDemoLabLocale(cookieStore.get("locale")?.value) ??
    "es-AR";
  const structuredData = demoLabStructuredData(locale);
  const initialVertical = firstParam(
    params.vertical || params.rubro || params.industry || params.useCase
  );
  const initialScenario = firstParam(
    params.scenario || params.proof || params.layer
  );
  const requestedThemeParam = firstParam(params.theme);
  const cookieTheme = cookieStore.get("theme")?.value;
  const requestedTheme =
    requestedThemeParam === "light" || requestedThemeParam === "dark"
      ? requestedThemeParam
      : cookieTheme === "dark"
        ? "dark"
        : "light";
  const demoLabReturnTo = buildDemoLabReturnTo(params);
  const proofVerifierHref = buildProofVerifierHandoffHref(initialScenario);
  const demoThemeClass = requestedTheme === "light" ? "demo-lab-fullscreen-root--light" : "";

  // ── FULL-SCREEN SIMULATOR MODE ───────────────────────────────────────────
  if (initialScenario || initialVertical) {
    const panelKey = initialScenario ?? initialVertical ?? "qr-gs1";
    const panel = PANEL_CONTENT[panelKey] ?? PANEL_CONTENT["qr-gs1"];
    const PanelIcon = panel.icon;
    const panelStatus = isDemoLabScenarioId(panelKey)
      ? getDemoLabScenarioStatus(panelKey, locale)
      : null;

    return (
      <div className={`demo-lab-fullscreen-root ${demoThemeClass}`}>
        {structuredData.map((schema) => (
          <JsonLd key={schema["@type"]} data={schema} />
        ))}
        {/* ── Top infobar ─────────────────────────────────────────────────── */}
        <header
          className="demo-lab-infobar z-40 border-b border-white/10 bg-slate-950/90 px-4 py-3 text-slate-100 backdrop-blur-xl"
          style={{ position: "relative", top: "auto" }}
        >
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
              {panelStatus ? (
                <span
                  className="demo-lab-scenario-mode"
                  data-demo-mode={panelStatus.mode}
                  title={panelStatus.detail}
                >
                  {panelStatus.label}
                </span>
              ) : null}
              <DemoLabThemeToggle initialTheme={requestedTheme} initialReturnTo={demoLabReturnTo} />
              <Link
                href="/?contact=demo#contact-modal"
                className="demo-lab-infobar__cta inline-flex h-9 items-center gap-2 rounded-full bg-cyan-300 px-4 text-xs font-black uppercase tracking-wider text-slate-950"
              >
                <span className="demo-lab-cta-full">Agendar demo</span>
                <span className="demo-lab-cta-short">Agendar</span>
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
                  <Link href={proofVerifierHref} className="demo-lab-context-strip__doc-link inline-flex h-9 items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-500/10 px-3 text-xs font-bold text-cyan-100">
                    Abrir recibo IOTA y decoder
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
            initialTheme={requestedTheme}
            initialReturnTo={demoLabReturnTo}
          />
        </div>
      </div>
    );
  }

  // ── HUB MODE ────────────────────────────────────────────────────────────
  const hubThemeClass = requestedTheme === "light" ? "demo-lab-hub-root--light" : "";

  return (
    <div className={`demo-lab-hub-root ${hubThemeClass} min-h-screen bg-[#03070f] text-white font-sans relative overflow-hidden`}>
      {structuredData.map((schema) => (
        <JsonLd key={schema["@type"]} data={schema} />
      ))}
      <div className="demo-lab-hub-bg absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="demo-lab-hub-bg__grid" />
        <div className="demo-lab-hub-bg__scan" />
      </div>

      {/* Top nav bar */}
      <nav className="demo-lab-hub-nav demo-lab-hub-nav--mobile-safe sticky top-0 z-50 grid min-h-[3.75rem] grid-cols-1 items-start justify-between gap-3 border-b border-white/[0.06] bg-[#03070f]/90 px-4 py-2 backdrop-blur-xl sm:grid-cols-[auto_minmax(0,1fr)] md:flex md:items-center">
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
          <DemoLabThemeToggle initialTheme={requestedTheme} initialReturnTo={demoLabReturnTo} />
          <Link
            href={proofVerifierHref}
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
            <span className="demo-lab-hub-title-gradient text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-violet-400">
              Demo Lab
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
            Seleccioná una capa de confianza o tu industria para simular la
            experiencia completa end-to-end.
          </p>
        </div>

        <section className="demo-lab-hub-quick-launch mb-8" aria-label="Abrir un escenario de Demo Lab">
          <div className="demo-lab-hub-quick-launch__head">
            <span>Accesos rápidos</span>
            <strong>Entrar directo sin recorrer todo el hub.</strong>
            <p>Para ventas, inversores o C-level: elegi una capa, tocala y volve al hub cuando quieras.</p>
          </div>
          <div className="demo-lab-hub-quick-launch__grid">
            {HUB_QUICK_LAUNCH_SCENARIOS.map((s, index) => {
              const Icon = s.icon;
              const scenarioStatus = getDemoLabScenarioStatus(s.id, locale);
              return (
                <Link
                  key={s.id}
                  href={`/demo-lab?scenario=${s.id}`}
                  className={`demo-lab-hub-quick-launch__card group ${s.border} ${s.shadow}`}
                  aria-label={`Abrir prueba rápida ${s.title}`}
                >
                  <span className="demo-lab-hub-quick-launch__step">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`demo-lab-hub-quick-launch__icon bg-gradient-to-br ${s.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="demo-lab-scenario-mode" data-demo-mode={scenarioStatus.mode}>{scenarioStatus.label}</span>
                  <strong>{s.title}</strong>
                  <small>Probar ahora <ArrowRight className="h-3.5 w-3.5" /></small>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="demo-lab-hub-executive-path mb-10" aria-label="Ruta ejecutiva Demo Lab">
          <div className="demo-lab-hub-executive-path__copy">
            <span>Ruta enterprise</span>
            <strong>Del producto físico a una prueba verificable en tres clics.</strong>
            <p>
              Pensado para ventas, inversores y equipos C-level: primero se entiende el flujo,
              después se valida el hash y finalmente se ve dónde entran IOTA, Polygon y API.
            </p>
            <small className="demo-lab-hub-executive-path__note">
              Abrís una demo, volvés al Hub desde la barra superior y podés saltar a Docs, SDK o Proof Verify.
            </small>
            <Link
              href="/demo-lab/chains"
              className="mt-3 inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-cyan-200 bg-cyan-300 px-4 text-xs font-black uppercase tracking-[0.1em] text-slate-950 transition-colors hover:bg-cyan-200"
            >
              Abrir Chain Lab IOTA + Polygon
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="demo-lab-hub-executive-path__grid">
            {HUB_EXECUTIVE_PATHS.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="demo-lab-hub-executive-path__card">
                  <span className="demo-lab-hub-executive-path__icon">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="demo-lab-hub-executive-path__eyebrow">{item.eyebrow}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <em>
                    {item.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </em>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="demo-lab-hub-proof-stack mb-10" aria-label="Capas de prueba nexID">
          <div className="demo-lab-hub-proof-stack__head">
            <div className="demo-lab-hub-proof-stack__icon">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <span>Qué se prueba realmente</span>
              <strong>La demo separa negocio, privacidad y blockchain.</strong>
              <p>
                Para un cliente no técnico: nexID opera la identidad del producto, IOTA demuestra evidencia pública
                hash-only y Polygon aparece sólo cuando hay propiedad, garantía o reventa que certificar.
              </p>
            </div>
          </div>
          <div className="demo-lab-hub-proof-stack__grid">
            {HUB_PROOF_STACK.map((item) => (
              <article key={item.label} className="demo-lab-hub-proof-stack__card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <em>{item.status}</em>
              </article>
            ))}
          </div>
        </section>

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

        <section className="demo-lab-mode-legend mb-8" aria-labelledby="demo-lab-mode-legend-title">
          <div>
            <span>Estado verificable</span>
            <strong id="demo-lab-mode-legend-title">Demo no significa live.</strong>
            <p>Cada escenario declara su alcance. “Live” queda reservado para evidencia devuelta y verificada por una fuente runtime, nunca por marketing.</p>
          </div>
          <ul>
            {DEMO_LAB_MODE_ORDER.map((mode) => {
              const modeCopy = getDemoLabModeCopy(mode, locale);
              return (
                <li key={mode} data-demo-mode={mode}>
                  <b>{modeCopy.label}</b>
                  <span>{modeCopy.explanation}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Scenarios Grid */}
        <div className="mb-12">
          <p className="demo-lab-hub-section-label mb-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
            Capas de confianza
          </p>
          <div className="demo-lab-hub-card-grid grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HUB_ORDERED_SCENARIOS.map((s) => {
              const Icon = s.icon;
              const scenarioStatus = getDemoLabScenarioStatus(s.id, locale);
              return (
                <Link
                  key={s.id}
                  href={`/demo-lab?scenario=${s.id}`}
                  className={`demo-lab-hub-card group relative flex min-h-[10.5rem] flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-white/[0.1] bg-slate-950/70 p-5 backdrop-blur-md transition-all duration-300 hover:border-cyan-300/40 hover:bg-slate-900/88 ${s.border} ${s.shadow}`}
                  aria-label={`Abrir demo ${s.title}`}
                >
                  {/* Left accent bar — subtle at rest, vivid on hover */}
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b ${s.color} opacity-75 transition-opacity duration-300 group-hover:opacity-100`}
                  />
                  <div className="flex items-start gap-4">
                    <div
                      className={`demo-lab-hub-card__icon flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all duration-200 ${s.accentGlow} ${s.accent}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <span className="demo-lab-scenario-mode" data-demo-mode={scenarioStatus.mode}>
                        {scenarioStatus.label}
                      </span>
                      <h3 className="mb-1 text-base font-black text-slate-50 transition-colors">
                        {s.title}
                      </h3>
                      <p className="text-sm leading-6 text-slate-300">
                        {s.body}
                      </p>
                      <small className="demo-lab-hub-card__status-detail">{scenarioStatus.detail}</small>
                    </div>
                  </div>
                  <span className="demo-lab-hub-card__cta inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
                    Abrir demo <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Verticals Grid */}
        <div>
          <p className="demo-lab-hub-section-label mb-4 text-xs font-black uppercase tracking-[0.22em] text-slate-400">
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
                  <div className={`demo-lab-hub-pill__icon flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${v.color}`}>
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
        <div className="demo-lab-hub-footer-links mt-14 flex flex-wrap items-center justify-center gap-6 text-sm font-bold text-slate-400">
          <Link
            href="/"
            className="demo-lab-hub-footer-link inline-flex items-center gap-2 transition-colors hover:text-cyan-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Volver a nexID
          </Link>
          <Link
            href="/docs"
            className="demo-lab-hub-footer-link transition-colors hover:text-cyan-200"
          >
            Documentación técnica
          </Link>
          <Link
            href="/?contact=demo#contact-modal"
            className="demo-lab-hub-footer-link transition-colors hover:text-cyan-200"
          >
            Agendar demo
          </Link>
        </div>
      </div>
    </div>
  );
}
