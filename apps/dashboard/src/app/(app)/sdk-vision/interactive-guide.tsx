"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Building2, Terminal, ChevronDown, Check, Copy, Sparkles, QrCode, 
  Wand2, Cpu, Phone, ShieldCheck, Layers, Compass, KeyRound, 
  Activity, Webhook, Info, Globe, RefreshCw, ArrowRight, ArrowLeftRight
} from "lucide-react";

type Role = "business" | "developer";
type ProductType = "wine" | "pharma" | "cosmetic" | "agro" | "event";

interface Step {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  role: Role;
  icon: React.ReactNode;
  badge?: string;
  actionText?: string;
  extraElement?: React.ReactNode;
}

export function InteractiveSdkGuide() {
  const [role, setRole] = useState<Role>("business");
  const [activeStep, setActiveStep] = useState<number>(1);
  const [productType, setProductType] = useState<ProductType>("wine");
  const [customUrl, setCustomUrl] = useState<string>("https://bodegamendoza.com/malbec-reserva");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [simulatorTab, setSimulatorTab] = useState<"before" | "after">("after");

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getProductDetails = () => {
    switch (productType) {
      case "wine":
        return {
          title: "Malbec Reserva 2022",
          subtitle: "Bodega Mendoza S.A. • Cosecha Seleccionada",
          badge: "Vino Original Verificado",
          color: "border-red-500/30 text-red-400 bg-red-500/10",
          accentColor: "bg-red-600",
          icon: <Sparkles className="h-4 w-4 text-red-400" />,
          aiText: "¡Hola! Soy tu Sommelier IA de nexID. Analicé el Malbec Reserva 2022. Cosechado en Valle de Uco, reposado 12 meses en roble francés. ¿Querés saber con qué maridarlo o participar del sorteo mensual?"
        };
      case "pharma":
        return {
          title: "CardioProtec 50mg",
          subtitle: "Laboratorios FarmaVita • Lote 2940B",
          badge: "Fórmula Farmacéutica Auténtica",
          color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
          accentColor: "bg-emerald-600",
          icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
          aiText: "Hola. La ficha de CardioProtec 50mg muestra evidencia valida de lote y vencimiento. Puedo abrir prospecto, trazabilidad o contacto profesional; no reemplazo indicacion medica."
        };
      case "cosmetic":
        return {
          title: "Sérum Anti-Age Hialurónico",
          subtitle: "Cosmética PielDorée • Edición Gold",
          badge: "Cosmetico con evidencia validada",
          color: "border-pink-500/30 text-pink-400 bg-pink-500/10",
          accentColor: "bg-pink-600",
          icon: <Wand2 className="h-4 w-4 text-pink-400" />,
          aiText: "¡Hola! Soy tu Consultor de Estética IA. Este Sérum Hialurónico combate arrugas de expresión y aporta brillo natural. Aplicar 3 gotas sobre rostro limpio. ¿Querés una rutina facial personalizada?"
        };
      case "agro":
        return {
          title: "BioNutriente F10 Max",
          subtitle: "AgroQuímica Verde • Certificación Orgánica",
          badge: "Agroinsumo Genuino Homologado",
          color: "border-amber-500/30 text-amber-400 bg-amber-500/10",
          accentColor: "bg-amber-600",
          icon: <Globe className="h-4 w-4 text-amber-400" />,
          aiText: "Hola. Soy tu Asesor Agronomo IA. Puedo consultar ficha tecnica, lote, dosis cargada por el tenant y recomendaciones autorizadas para tu zona."
        };
      case "event":
        return {
          title: "VIP Access - Main Stage",
          subtitle: "Festival Nova Pass - Sector A",
          badge: "Acceso Original Verificado",
          color: "border-cyan-500/30 text-cyan-400 bg-cyan-500/10",
          accentColor: "bg-cyan-600",
          icon: <Phone className="h-4 w-4 text-cyan-400" />,
          aiText: "Hola, soy tu asistente del evento. Este acceso es valido para Sector A, check-in rapido y beneficios cashless. Puedo mostrar mapa, horarios y puntos VIP disponibles."
        };
    }
  };

  const currentProduct = getProductDetails();

  const businessSteps: Step[] = [
    {
      id: 1,
      title: "Crea tu Cuenta de Marca",
      subtitle: "Tiempo estimado: 30 segundos",
      description: "Registrá tu empresa (Bodega, Laboratorio, Marca de Cosméticos) en nexID de manera gratuita. Nuestro asistente autoconfigura tu espacio en la nube (Tenant) adaptándose a los estándares de tu industria.",
      role: "business",
      icon: <Building2 className="h-5 w-5" />,
      badge: "Sin Costo de Configuración",
      actionText: "Ir a Registro B2B"
    },
    {
      id: 2,
      title: "Configura el Perfil de tu Producto",
      subtitle: "Establece los datos clave para la Inteligencia Artificial",
      description: "Carga la ficha técnica básica de tus productos (ej. notas de cata de un vino, dosificación de un agroinsumo, o componentes de un cosmético). Nuestra IA entrena instantáneamente con estos documentos para poder responderle a los clientes en la calle.",
      role: "business",
      icon: <Sparkles className="h-5 w-5" />,
      badge: "Sommelier IA Autocompletado"
    },
    {
      id: 3,
      title: "Integra el SDK en tus QR existentes",
      subtitle: "Reutiliza tus etiquetas sin volver a imprimir",
      description: "Tus productos en la calle ya tienen un código QR. Solo pídele a tu programador que pegue nuestro fragmento de código de 5 líneas en la página a la que apuntan esos QR. Es tan sencillo como colocar Google Analytics.",
      role: "business",
      icon: <QrCode className="h-5 w-5" />,
      badge: "Hardware Agnostic"
    },
    {
      id: 4,
      title: "Mide y Captura Leads en Tiempo Real",
      subtitle: "Mira cómo crecen tus analíticas geográficas",
      description: "Cada escaneo activa nuestra suite de fidelización. El comprador chatea con tu IA, participa en trivias y sorteos, y tú obtienes su contacto (WhatsApp/Email). Los reportes de consumo se actualizan al instante en el mapa del panel nexID.",
      role: "business",
      icon: <Activity className="h-5 w-5" />,
      badge: "SaaS + Analytics Listo"
    }
  ];

  const developerSteps: Step[] = [
    {
      id: 1,
      title: "Obtén tus credenciales",
      subtitle: "API Keys seguras",
      description: "En tu panel nexID, navega a Configuracion de API. Usa una API Key de servidor solo en backend y tu Tenant Slug como identificador de marca. Nunca pegues llaves privadas en frontend.",
      role: "developer",
      icon: <KeyRound className="h-5 w-5" />,
      badge: "JWT & API Key Authorized"
    },
    {
      id: 2,
      title: "Instala el paquete @nexid/sdk",
      subtitle: "Librería nativa de NPM",
      description: "Agrega nuestro SDK oficial a tu e-commerce o landing page actual. Compatible con Node.js, React, Next.js, Vue y HTML nativo.",
      role: "developer",
      icon: <Terminal className="h-5 w-5" />,
      badge: "npm i @nexid/sdk",
      extraElement: (
        <div className="mt-3 relative rounded-lg bg-black/60 border border-white/5 p-3 font-mono text-xs text-slate-300">
          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
            <span>TERMINAL</span>
            <button 
              onClick={() => handleCopy("npm install @nexid/sdk", "npm")}
              className="hover:text-white transition flex items-center gap-1"
            >
              {copiedCode === "npm" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedCode === "npm" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <code>npm install @nexid/sdk</code>
        </div>
      )
    },
    {
      id: 3,
      title: "Inicializa el cliente y reporta el evento",
      subtitle: "Backend seguro, sin exponer API Keys",
      description: "Importa el cliente de nexID en tu backend, inicialízalo con tu API Key y Tenant Slug, y reporta el scan QR/GS1 o valida el tap NFC seguro con los métodos reales del SDK.",
      role: "developer",
      icon: <Cpu className="h-5 w-5" />,
      badge: "Javascript / TypeScript",
      extraElement: (
        <div className="mt-3 relative rounded-lg bg-black/60 border border-white/5 p-3 font-mono text-[11px] text-slate-300">
          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
            <span>INDEX.JS (SDK EVENT)</span>
            <button 
              onClick={() => handleCopy(`import { NexIdClient } from '@nexid/sdk';\nconst nexid = new NexIdClient({ apiKey: process.env.NEXID_API_KEY, tenantSlug: 'bodega-mendoza' });\nconst event = await nexid.reportEvent({ eventType: 'qr.scan', bid: 'MALBEC-2022-LOT1', source: 'qr_landing' });`, "js")}
              className="hover:text-white transition flex items-center gap-1"
            >
              {copiedCode === "js" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedCode === "js" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap max-h-48 text-[10px]">
{`import { NexIdClient } from '@nexid/sdk';

const nexid = new NexIdClient({
  apiKey: process.env.NEXID_API_KEY,
  tenantSlug: "bodega-mendoza"
});

// QR/GS1 fallback: registra el evento visible sin afirmar anticopia.
const event = await nexid.reportEvent({
  eventType: "qr.scan",
  bid: "MALBEC-2022-LOT1",
  source: "qr_landing"
});

// NFC seguro: usa verifyTap con picc_data, enc y cmac capturados.
const verification = await nexid.verifyTap({
  bid: "MALBEC-2022-LOT1",
  picc_data,
  enc,
  cmac
});`}
          </pre>
        </div>
      )
    },
    {
      id: 4,
      title: "Configura Webhooks de Eventos (Opcional)",
      subtitle: "Automatiza acciones en tiempo real",
      description: "Configura endpoints en tu servidor para reaccionar inmediatamente a eventos físicos capturados por el SDK en la calle, como 'tap.invalid' (alerta de falsificación) o 'seal.broken' (sensor de corcho abierto en chips inteligentes).",
      role: "developer",
      icon: <Webhook className="h-5 w-5" />,
      badge: "Real-time Webhooks",
      extraElement: (
        <div className="mt-3 relative rounded-lg bg-black/60 border border-white/5 p-3 font-mono text-[11px] text-slate-300">
          <div className="flex justify-between items-center text-[10px] text-slate-500 mb-1">
            <span>WEBHOOK EVENT PAYLOAD</span>
            <button 
              onClick={() => handleCopy(`{\n  "event": "tap.invalid",\n  "timestamp": 1781294803,\n  "data": {\n    "tenant": "bodega-mendoza",\n    "productId": "MALBEC-2022-LOT1",\n    "location": "Mendoza, Argentina",\n    "reason": "Invalid signature or copied identifier pattern suspected"\n  }\n}`, "json")}
              className="hover:text-white transition flex items-center gap-1"
            >
              {copiedCode === "json" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copiedCode === "json" ? "Copiado" : "Copiar"}
            </button>
          </div>
          <pre className="overflow-x-auto text-[9px] text-amber-300/90 leading-tight">
{`{
  "event": "tap.invalid",
  "timestamp": 1781294803,
  "data": {
    "tenant": "bodega-mendoza",
    "productId": "MALBEC-2022-LOT1",
    "location": "Mendoza, Argentina",
    "reason": "Copied identifier pattern suspected"
  }
}`}
          </pre>
        </div>
      )
    }
  ];

  const currentSteps = role === "business" ? businessSteps : developerSteps;

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      
      {/* SECCIÓN IZQUIERDA: PASO A PASO ANIMADO CON TIMELINE */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Selector de Roles */}
        <div className="flex items-center justify-between rounded-xl bg-slate-900/60 border border-white/5 p-1.5 max-w-sm">
          <button
            onClick={() => { setRole("business"); setActiveStep(1); }}
            className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all duration-300 ${
              role === "business" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Perfil Negocio</span>
          </button>
          
          <button
            onClick={() => { setRole("developer"); setActiveStep(1); }}
            className={`relative flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition-all duration-300 ${
              role === "developer" 
                ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20" 
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Terminal className="h-4 w-4" />
            <span>Perfil Técnico</span>
          </button>
        </div>

        {/* Guía Interactiva Pasos */}
        <div className="relative pl-6 space-y-4">
          
          {/* Línea de Progreso Vertical */}
          <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-cyan-500 via-indigo-500 to-slate-800" />

          {currentSteps.map((step, idx) => {
            const isCompleted = step.id < activeStep;
            const isActive = step.id === activeStep;

            return (
              <motion.div 
                key={step.id} 
                layout
                className={`relative rounded-xl border p-4 transition-all duration-300 ${
                  isActive 
                    ? "border-cyan-500/30 bg-slate-900/40 shadow-xl" 
                    : isCompleted 
                      ? "border-emerald-500/10 bg-slate-950/20 opacity-90"
                      : "border-white/5 bg-slate-950/40 opacity-50 hover:opacity-75"
                }`}
              >
                {/* Indicador de paso en el timeline */}
                <div 
                  onClick={() => setActiveStep(step.id)}
                  className={`absolute -left-[27px] top-4 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border text-[10px] font-black transition-all duration-300 ${
                    isActive 
                      ? "border-cyan-400 bg-slate-950 text-cyan-400 ring-4 ring-cyan-500/20 scale-110" 
                      : isCompleted 
                        ? "border-emerald-400 bg-emerald-500/10 text-emerald-400"
                        : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3 text-emerald-400" /> : step.id}
                </div>

                {/* Cabecera del Paso */}
                <div 
                  onClick={() => setActiveStep(step.id)}
                  className="flex cursor-pointer items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isActive 
                        ? "bg-cyan-500/10 text-cyan-400" 
                        : "bg-slate-800/40 text-slate-400"
                    }`}>
                      {step.icon}
                    </div>
                    <div>
                      <h4 className={`text-xs font-bold transition ${isActive ? "text-white" : "text-slate-300"}`}>
                        {step.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">{step.subtitle}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {step.badge && (
                      <span className={`hidden sm:inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                        isActive 
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                          : "bg-white/5 text-slate-400"
                      }`}>
                        {step.badge}
                      </span>
                    )}
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${
                      isActive ? "rotate-180 text-cyan-400" : ""
                    }`} />
                  </div>
                </div>

                {/* Contenido Expandible (Framer Motion) */}
                <AnimatePresence initial={false}>
                  {isActive && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 pt-3 border-t border-white/5 text-xs text-slate-300 leading-relaxed space-y-3">
                        <p>{step.description}</p>
                        
                        {/* Renderizar elemento extra si existe (ej. código) */}
                        {step.extraElement}

                        {/* Botones de acción opcionales */}
                        <div className="flex items-center gap-4 pt-1">
                          {step.actionText && (
                            <button className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-cyan-400 transition">
                              {step.actionText}
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          )}
                          
                          {idx < currentSteps.length - 1 ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveStep(step.id + 1);
                              }}
                              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                            >
                              <span>Siguiente paso</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                              <ShieldCheck className="h-4 w-4" />
                              <span>¡Integración completa y lista para producción!</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* SECCIÓN DERECHA: LIVE SIMULATOR (EL TELÉFONO QUE SE TRANSFORMA) */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* Controles del Simulador */}
        <div className="rounded-xl border border-white/5 bg-slate-950/60 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
              <Wand2 className="h-4 w-4 text-cyan-400" />
              Simulador B2B nexID QR
            </h4>
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold text-cyan-400 border border-cyan-500/20">
              Live Demo
            </span>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            Selecciona tu industria para ver cómo nuestro SDK transforma una URL vieja y aburrida de QR en un portal interactivo para tus clientes.
          </p>

          {/* Selector de Industria */}
          <div className="grid grid-cols-5 gap-1.5 bg-slate-900/60 p-1 rounded-lg border border-white/5">
            {(["wine", "pharma", "cosmetic", "agro", "event"] as ProductType[]).map((type) => (
              <button
                key={type}
                onClick={() => setProductType(type)}
                className={`py-1.5 text-[10px] font-black rounded capitalize transition ${
                  productType === type 
                    ? "bg-slate-800 text-cyan-400 border border-cyan-500/20 shadow" 
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {type === "wine" ? "Vino" : type === "pharma" ? "Pharma" : type === "cosmetic" ? "Cosmetica" : type === "agro" ? "Agro" : "Eventos"}
              </button>
            ))}
          </div>

          {/* Input de URL Actual */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">URL actual de tus botellas/productos:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 font-mono focus:outline-none focus:border-cyan-500/40"
              />
              <button 
                onClick={() => {
                  if (productType === "wine") setCustomUrl("https://bodegadeejemplo.com/reserva-malbec");
                  if (productType === "pharma") setCustomUrl("https://farma-vita.com/cardio-50");
                  if (productType === "cosmetic") setCustomUrl("https://cosmeticos-gold.com/serum");
                  if (productType === "agro") setCustomUrl("https://agro-verde.com/f10-max");
                  if (productType === "event") setCustomUrl("https://festivalnova.com/vip-pass-a");
                }}
                className="p-2 bg-slate-900 border border-white/5 rounded-lg text-slate-400 hover:text-white transition"
                title="Reset URL"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* MOCKUP DEL TELÉFONO MÓVIL */}
        <div className="relative mx-auto max-w-[280px] rounded-[36px] border-[8px] border-slate-900 bg-slate-950 shadow-2xl overflow-hidden aspect-[9/18] ring-1 ring-white/10">
          
          {/* Cámara Notch */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-900 rounded-full z-30 flex items-center justify-between px-2.5">
            <div className="w-1.5 h-1.5 bg-slate-800 rounded-full" />
            <div className="w-8 h-1 bg-slate-800 rounded-full" />
          </div>

          {/* Pantalla del Celular */}
          <div className="w-full h-full bg-slate-950 flex flex-col justify-between pt-8 pb-3 relative text-slate-300">
            
            {/* Header del Celular (URL Bar) */}
            <div className="px-3 pb-2 border-b border-white/5 flex items-center gap-1.5 text-[9px] font-mono bg-slate-900/60 z-10 shrink-0">
              <Globe className="h-3 w-3 text-slate-500" />
              <span className="text-slate-400 truncate flex-1">
                {simulatorTab === "before" ? customUrl.replace("https://", "") : "id.nexid.lat/01/gtin/21/serial"}
              </span>
            </div>

            {/* Selector de Pantalla (Antes/Después de nexID) */}
            <div className="px-3 py-1.5 bg-slate-900 border-b border-white/5 flex items-center justify-between gap-1 z-10 shrink-0">
              <button 
                onClick={() => setSimulatorTab("before")}
                className={`flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded text-center transition ${
                  simulatorTab === "before" 
                    ? "bg-slate-800 text-amber-400 border border-amber-500/25" 
                    : "text-slate-400"
                }`}
              >
                Antes (Sin nexID)
              </button>
              <button 
                onClick={() => setSimulatorTab("after")}
                className={`flex-1 py-1 text-[8px] font-black uppercase tracking-wider rounded text-center transition ${
                  simulatorTab === "after" 
                    ? "bg-slate-800 text-cyan-400 border border-cyan-500/25" 
                    : "text-slate-400"
                }`}
              >
                Después (nexID SDK)
              </button>
            </div>

            {/* CONTENIDO PRINCIPAL DE LA PANTALLA */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-4 scrollbar-none relative z-10">
              
              {simulatorTab === "before" ? (
                /* VISTA VIEJA (SIN NEXID) */
                <div className="space-y-4">
                  <div className="h-10 w-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-500">
                    <QrCode className="h-6 w-6" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-800 rounded w-3/4" />
                    <div className="h-3 bg-slate-800 rounded w-1/2" />
                  </div>

                  <div className="p-3 rounded-lg border border-white/5 bg-slate-900/40 text-[9px] text-slate-400 space-y-2 leading-relaxed">
                    <p className="font-bold text-slate-300">Ficha Técnica Oficial (PDF)</p>
                    <p>Esta página web contiene los datos reglamentarios de envasado y procedencia del producto.</p>
                    <div className="h-1.5 bg-slate-800 rounded w-full" />
                    <div className="h-1.5 bg-slate-800 rounded w-5/6" />
                  </div>

                  <div className="pt-6 text-center text-[8px] text-slate-500">
                    🔒 La marca no puede capturar leads ni verificar autenticidad.
                  </div>
                </div>
              ) : (
                /* VISTA NUEVA (CON NEXID SDK) */
                <div className="space-y-3.5">
                  
                  {/* Badge de Verificación Criptográfica */}
                  <div className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-2 ${currentProduct.color}`}>
                    {currentProduct.icon}
                    <div className="flex-1 min-w-0">
                      <p className="text-[8px] font-bold uppercase tracking-wider leading-none">Verificación nexID</p>
                      <p className="text-[9px] font-black truncate mt-0.5">{currentProduct.badge}</p>
                    </div>
                  </div>

                  {/* Ficha de Producto */}
                  <div className="space-y-1">
                    <h5 className="text-[12px] font-black text-white leading-tight">{currentProduct.title}</h5>
                    <p className="text-[8px] text-slate-400 leading-none">{currentProduct.subtitle}</p>
                  </div>

                  {/* Bloque interactivo del Sommelier IA */}
                  <div className="rounded-xl border border-white/5 bg-slate-900/60 p-2.5 space-y-2 relative overflow-hidden">
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-cyan-400">
                      <Sparkles className="h-3 w-3 animate-pulse" />
                      <span>nexID Chatbot IA</span>
                    </div>
                    
                    <div className="rounded bg-black/40 p-2 text-[8px] leading-relaxed text-slate-300 border border-white/5">
                      {currentProduct.aiText}
                    </div>

                    <div className="flex gap-1">
                      <input 
                        type="text" 
                        placeholder="Preguntale algo a la IA..." 
                        disabled
                        className="flex-1 bg-black/60 border border-white/10 rounded px-1.5 py-0.5 text-[8px] text-slate-500 focus:outline-none"
                      />
                      <button className={`p-1 rounded text-slate-950 font-bold text-[8px] ${currentProduct.accentColor}`}>
                        Enviar
                      </button>
                    </div>
                  </div>

                  {/* Módulo de Recompensas y Sorteo */}
                  <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-2.5 text-center space-y-2">
                    <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest leading-none">✨ Premio Disponible</p>
                    <p className="text-[9px] font-bold text-white">¡Participá del Sorteo Mensual!</p>
                    <button className="w-full py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[8px] font-black uppercase transition">
                      Girar la Ruleta
                    </button>
                  </div>

                </div>
              )}
            </div>

            {/* Footer del Celular (Powered by nexID) */}
            <div className="px-3 pt-2 border-t border-white/5 flex items-center justify-between text-[8px] text-slate-500 bg-slate-900/60 shrink-0">
              <span>Powered by nexID</span>
              <span className="flex items-center gap-0.5">
                <ShieldCheck className="h-2.5 w-2.5 text-cyan-500" /> Secure Link
              </span>
            </div>

          </div>

          {/* Botón Home físico en el celular */}
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-800 rounded-full z-30" />
        </div>

        {/* Comparativa Corta */}
        <div className="rounded-xl border border-white/5 bg-slate-950/40 p-4 text-xs text-slate-400 space-y-2 leading-relaxed">
          <p className="font-bold text-white text-xs flex items-center gap-1.5">
            <ArrowLeftRight className="h-4 w-4 text-amber-400" />
            ¿Qué ganaste con el cambio?
          </p>
          <ul className="space-y-1.5 text-[11px] list-disc list-inside">
            <li><strong className="text-white">Captura de leads:</strong> Pasas de 0% de contacto con el cliente final a más de un 15% de conversión en sorteos.</li>
            <li><strong className="text-white">Fidelización directa:</strong> El cliente final compra tu botella y chatea con tu Sommelier IA de inmediato.</li>
            <li><strong className="text-white">Control geográfico:</strong> Si una distribuidora desvía tus botellas de forma ilegal, lo verás en el mapa al instante.</li>
          </ul>
        </div>

      </div>

    </div>
  );
}
