"use client";

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Download,
  Cpu, 
  ShieldCheck, 
  Award, 
  TrendingUp, 
  Database,
  Smartphone,
  Layers,
  HelpCircle,
  QrCode,
  Lock,
  ArrowRight,
  Bot
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@product/ui";

interface Slide {
  id: number;
  title: string;
  tagline: string;
  content: React.ReactNode;
}

export default function InvestorPitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPrintMode, setIsPrintMode] = useState(false);

  // Keyboard navigation for presentation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlide(prev => Math.max(0, prev - 1));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handlePrint = () => {
    // Show all slides and trigger print
    window.print();
  };

  const slides: Slide[] = [
    // Slide 1: Cover Page
    {
      id: 0,
      title: "nexID",
      tagline: "IDENTIDAD DIGITAL, EVIDENCIA NFC Y EXPERIENCIAS CONECTADAS",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center text-slate-950 font-black text-3xl shadow-[0_0_40px_rgba(168,85,247,0.3)] animate-pulse">
            N
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
            Ecosistema de Evidencia NFC,<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-300">
              Trazabilidad y Experiencias de Marca
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
            Una plataforma multi-tenant que conecta productos físicos con experiencias digitales mediante NFC y QR, validación SUN server-side y evidencia blockchain opcional según la política de cada cliente.
          </p>
          <div className="flex items-center gap-3 pt-4 no-print">
            <span className="text-[10px] bg-slate-900 border border-white/10 px-3 py-1 rounded-full text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Material de inversión · arquitectura actual
            </span>
          </div>
        </div>
      )
    },
    // Slide 2: The Core Problem
    {
      id: 1,
      title: "El Problema de la Industria de Lujo",
      tagline: "EL VACÍO DESPUÉS DE LA VENTA Y LA PÉRDIDA DE VISIBILIDAD",
      content: (
        <div className="grid gap-6 md:grid-cols-3 items-center h-full py-4">
          {[
            {
              title: "Falta de Datos del Comprador",
              desc: "Después de vender por distribuidores, la marca suele perder visibilidad del recorrido y del cliente final. nexID puede abrir un canal directo sólo cuando el consumidor participa y presta el consentimiento correspondiente.",
              icon: Database,
              color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300"
            },
            {
              title: "Riesgo de falsificación",
              desc: "Los códigos QR visibles pueden copiarse. En productos compatibles, SUN dinámico y TagTamper agregan señales server-side contra replay, reutilización del enlace y apertura; no sustituyen controles físicos ni garantizan eliminar el fraude.",
              icon: Lock,
              color: "border-rose-500/20 bg-rose-500/5 text-rose-300"
            },
            {
              title: "Interacción poco contextual",
              desc: "Los canales masivos no siempre conservan contexto de producto, lote o momento de consumo. Una experiencia post-tap permite probar mensajes y beneficios segmentados sin presentar conversión estimada como resultado observado.",
              icon: Bot,
              color: "border-amber-500/20 bg-amber-500/5 text-amber-300"
            }
          ].map((item, idx) => (
            <div key={idx} className={`rounded-2xl border p-5 space-y-3 h-full flex flex-col justify-between ${item.color}`}>
              <div>
                <item.icon className="w-8 h-8 mb-2" />
                <h3 className="text-base font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    // Slide 3: The nexID Architecture Map
    {
      id: 2,
      title: "El Ecosistema nexID",
      tagline: "RUNTIME EN VERCEL, DATOS EN NEON Y EVIDENCIA WEB3 OPCIONAL POR TENANT",
      content: (
        <div className="flex flex-col justify-between h-full py-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { step: "1. Producto serializado", desc: "La marca aplica un NFC o QR asignado al tenant, lote y producto bajo una política de activación definida.", icon: QrCode },
              { step: "2. Tap y validación", desc: "En chips compatibles, el teléfono envía la prueba SUN al backend; tocar no transfiere propiedad automáticamente.", icon: Smartphone },
              { step: "3. Vercel + Neon", desc: "La API en Vercel valida SUN server-side y Neon PostgreSQL conserva la operación con alcance por tenant.", icon: ShieldCheck },
              { step: "4. Evidencia opcional", desc: "Polygon o IOTA se habilitan sólo por tenant y caso de uso. Las demos actuales usan testnet y deben mostrar su recibo público.", icon: Sparkles }
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-white/5 bg-slate-900/30 p-4 text-center relative">
                <item.icon className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                <h4 className="text-xs font-black text-white">{item.step}</h4>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">{item.desc}</p>
                {idx < 3 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 text-purple-500 font-bold z-15">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-4 text-xs text-slate-300 leading-relaxed flex items-center gap-4">
            <span className="p-3 bg-purple-500/20 rounded-xl text-purple-300 font-black">Vercel + Neon</span>
            <p>
              <strong>Arquitectura actual, sin infraestructura ficticia:</strong> el flujo operativo vive en Vercel y Neon. Blockchain no procesa cada lectura NFC: se usa de forma selectiva para anclajes, certificados o reclamos autorizados, con costos y red configurados por tenant.
            </p>
          </div>
        </div>
      )
    },
    // Slide 4: Pilar A - Cryptographic Security
    {
      id: 3,
      title: "Pilar A: Seguridad Criptográfica",
      tagline: "SEÑALES SERVER-SIDE PARA REPLAY, APERTURA Y RIESGO OPERATIVO",
      content: (
        <div className="grid gap-6 md:grid-cols-2 items-center h-full py-4">
          <div className="space-y-4">
            {[
              {
                title: "Firma Dinámica (NFC SUN)",
                desc: "Cada toque en chips compatibles genera datos SUN dinámicos que el backend verifica con la clave y política del lote. Una respuesta válida aporta evidencia de esa lectura; no demuestra por sí sola propiedad, ubicación ni custodia."
              },
              {
                title: "Señales de Riesgo por Lectura",
                desc: "La plataforma puede evaluar ubicación reportada por el teléfono con permiso, IP aproximada, canal y patrones temporales. El NFC no transmite GPS: cada mapa debe distinguir coordenadas reportadas, aproximadas y simuladas."
              },
              {
                title: "Detección de Sello Violado",
                desc: "En carriers TagTamper correctamente instalados, la apertura cambia la señal del tag. El backend interpreta ese estado según configuración; adhesivo, envase y proceso deben validarse en un piloto físico."
              }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-black">✓</span>
                <div>
                  <strong className="text-xs text-white block">{item.title}</strong>
                  <span className="text-[11px] text-slate-400">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 font-mono text-[10px] text-slate-400 space-y-3">
            <div className="flex justify-between items-center text-[9px] bg-slate-900 px-2.5 py-1 rounded text-cyan-300">
              <span>CONTRATO DE EVIDENCIA · EJEMPLO</span>
              <span>ESPERANDO TAP</span>
            </div>
            <p>· Firma SUN: <span className="text-amber-300 font-bold">PENDIENTE DE EVIDENCIA</span></p>
            <p>· Estado de sello: <span className="text-slate-300 font-bold">NO REPORTADO</span></p>
            <p>· Ubicación del evento: <span className="text-slate-300">SIN COORDENADAS REPORTADAS</span></p>
            <p>· Dispositivo: <span className="text-slate-300">NO DETECTADO · SIN FINGERPRINT FIJO</span></p>
          </div>
        </div>
      )
    },
    // Slide 5: Pilar B - Campaign assistant
    {
      id: 4,
      title: "Pilar B: Asistente de Campañas",
      tagline: "COPILOTO CON PROVEEDOR LIVE CONFIRMADO O FALLBACK DETERMINÍSTICO DECLARADO",
      content: (
        <div className="grid gap-6 md:grid-cols-2 items-center h-full py-4">
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tres perfiles de redacción asistida</h3>
            {[
              { title: "Tono Sommelier", desc: "Propone una versión enológica para revisión humana; no inventa atributos del producto que no estén en el brief." },
              { title: "Tono Club Privado", desc: "Adapta el mensaje a membresías y cupos informados por la marca, sujeto a aprobación antes del envío." },
              { title: "Tono Web3 claro", desc: "Explica certificados, reclamos y gemelos digitales sin afirmar escrituras on-chain que no tengan recibo verificable." }
            ].map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-xl border border-white/5 bg-slate-900/30">
                <strong className="text-xs text-purple-300 font-bold block">{item.title}</strong>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{item.desc}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider">Escenario ilustrativo · no es telemetría live</span>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="bg-slate-950/50 p-2 rounded">
                  <span className="text-slate-500 block text-[8px]">PRESTIGIO</span>
                  <strong className="text-amber-400 text-xs font-mono">92% · hipótesis editable</strong>
                </div>
                <div className="bg-slate-950/50 p-2 rounded">
                  <span className="text-slate-500 block text-[8px]">CTR OBJETIVO</span>
                  <strong className="text-purple-400 text-xs font-mono">28% · ejemplo, no observado</strong>
                </div>
              </div>
              <div className="text-[9px] text-slate-400 leading-relaxed pt-1">
                Estos valores muestran cómo presentar una hipótesis de campaña. Un resultado real requiere entrega, impresiones, clics y atribución. La UI sólo declara un modelo live cuando el backend confirma el proveedor; ante cuota o error, identifica el fallback determinístico.
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: Pilar C - Active Loyalty & Gamification
    {
      id: 5,
      title: "Pilar C: Gamificación y Fidelización VIP",
      tagline: "TRANSFORMANDO EL CONSUMO EN UN CLUB DE ESTATUS DIGITAL",
      content: (
        <div className="grid gap-6 md:grid-cols-2 items-center h-full py-4">
          <div className="space-y-4">
            {[
              {
                title: "Cava Digital del Coleccionista",
                desc: "Los clientes pueden visualizar productos reclamados en su portal cuando la política de la marca aprueba el claim. El tap inicial no crea propiedad automáticamente."
              },
              {
                title: "Categorías Metálicas de Estatus",
                desc: "La marca puede configurar niveles y beneficios. Sus reglas, elegibilidad y costos deben publicarse; el deck no asume que más taps equivalen a mayor estatus."
              },
              {
                title: "Asistente y participación opcional",
                desc: "El tenant puede habilitar chat de servicio o encuestas. Una votación sólo se presenta como real cuando existe campaña publicada, participantes y resultados persistidos."
              }
            ].map((item, idx) => (
              <div key={idx} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black">✓</span>
                <div>
                  <strong className="text-xs text-white block">{item.title}</strong>
                  <span className="text-[11px] text-slate-400">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-center space-y-3">
            <span className="text-[8px] bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded font-black text-amber-300 uppercase">
              Ejemplo de encuesta · datos simulados
            </span>
            <h4 className="text-xs font-bold text-white">Hipótesis: diseño de etiqueta para una campaña piloto</h4>
            <div className="space-y-1.5 text-[10px] text-left pt-1">
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-slate-300">Opción A (clásico grabado)</span>
                  <span className="text-amber-400 font-bold">58% ejemplo</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: "58%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-slate-300">Opción B (minimalista)</span>
                  <span className="text-slate-500 font-bold">42% ejemplo</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-slate-700 h-full rounded-full" style={{ width: "42%" }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 7: Commercial capabilities and pilot metrics
    {
      id: 6,
      title: "Capacidades y Métricas de Piloto",
      tagline: "RESULTADOS A MEDIR; NO SE PRESENTAN COMO TRACCIÓN OBSERVADA",
      content: (
        <div className="grid gap-6 md:grid-cols-3 items-center h-full py-4 text-center">
          {[
            {
              title: "Datos Directos de Mercado",
              desc: "Con consentimiento, la marca puede abrir un canal directo y medir opt-in, activación y recurrencia. Sin opt-in no se infiere identidad ni demografía del comprador.",
              metric: "Opt-in",
              label: "KPI a validar"
            },
            {
              title: "Control en Exportación",
              desc: "Las lecturas pueden generar señales por replay, apertura, canal o geografía reportada. Su precisión y respuesta operativa deben medirse con casos etiquetados.",
              metric: "Alertas",
              label: "Precisión a medir"
            },
            {
              title: "Recurrencia e Ingresos",
              desc: "El post-tap puede conducir a membresías, garantía o marketplace cuando el tenant lo habilita. Conversión e ingreso incremental requieren atribución del piloto.",
              metric: "Conversión",
              label: "Hipótesis comercial"
            }
          ].map((item, idx) => (
            <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/40 p-5 space-y-3 h-full flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">{item.title}</h3>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-2">{item.desc}</p>
              </div>
              <div className="pt-2 border-t border-white/5">
                <p className="text-3xl font-black text-white">{item.metric}</p>
                <p className="text-[9px] text-purple-400 uppercase font-bold tracking-wider">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      )
    },
    // Slide 8: Guided demo & next steps
    {
      id: 7,
      title: "Demostración Guiada y Próximos Pasos",
      tagline: "CADA ESTADO DISTINGUE PREVIEW, REGISTRO Y EVIDENCIA VERIFICADA",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Listo para recorrer la prueba de punta a punta
          </h2>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            Con un sample físico disponible se puede ejecutar el tap SUN y revisar su respuesta server-side. Sin sample, la interfaz permanece rotulada como preview. El reclamo de propiedad requiere política, identidad y aprobación; blockchain sólo se confirma con recibo público de testnet.
          </p>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 max-w-2xl w-full pt-2">
            {[
              { title: "NFC / QR", step: "Tap físico o preview rotulado" },
              { title: "Consumer App", step: "Solicitar claim" },
              { title: "Bodega CRM", step: "Revisar fuente y evidencia" },
              { title: "Polygon / IOTA", step: "Testnet opcional por tenant" }
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-white/5 bg-slate-950 p-3 text-center">
                <span className="text-[8px] uppercase text-slate-500 font-bold block">Fase {idx + 1}</span>
                <strong className="text-xs text-white mt-1 block">{item.title}</strong>
                <span className="text-[9px] text-purple-300 mt-0.5 block">{item.step}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 font-mono pt-4">
            nexID · info@nexid.lat · Arquitectura y estados verificables · 2026
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Styles for print output override */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            background-color: #020617 !important;
            color: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .print-slide {
            height: 100vh !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            break-after: page !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 3rem !important;
            background-color: #020617 !important;
            border-bottom: none !important;
          }
          .print-layout {
            display: block !important;
          }
          .interactive-layout {
            display: none !important;
          }
        }
      `}} />

      {/* Header Controls (Only in Screen Mode) */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Pitch Deck Interactivo <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-black uppercase">Presentación</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Presentación interactiva para inversores. Descargá el PDF premium pre-diseñado o imprimí las diapositivas.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handlePrint} 
            variant="secondary"
            className="gap-2 text-xs py-1.5 border border-cyan-500/30 hover:border-cyan-500/60"
          >
            <Printer className="w-3.5 h-3.5 text-cyan-400" />
            Imprimir Diapositivas
          </Button>

          <Button 
            onClick={() => window.open("/nexid_pitch_deck.pdf", "_blank")} 
            variant="primary"
            className="gap-2 text-xs py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold border border-cyan-500/30"
          >
            <Download className="w-3.5 h-3.5 text-white" />
            Descargar PDF
          </Button>
        </div>
      </header>

      {/* Screen Interactive Mode (Single Slide view) */}
      <div className="interactive-layout no-print">
        <div className="relative rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_right,rgba(168,85,247,0.08),transparent_50%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-8 md:p-12 min-h-[500px] flex flex-col justify-between shadow-2xl">
          {/* Active slide header details */}
          <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-white/5 pb-3">
            <span>{slides[currentSlide].title}</span>
            <span>Slide {currentSlide + 1} de {slides.length}</span>
          </div>

          {/* Slide Tagline */}
          <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 mt-4 block">
            {slides[currentSlide].tagline}
          </span>

          {/* Slide Content with animations */}
          <div className="flex-1 flex flex-col justify-center py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {slides[currentSlide].content}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation controls */}
          <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
            <button
              onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
              disabled={currentSlide === 0}
              className="text-xs font-bold text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>

            {/* Pagination dots */}
            <div className="flex gap-2">
              {slides.map((slide, idx) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    currentSlide === idx ? "bg-purple-500" : "bg-white/10 hover:bg-white/20"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
              disabled={currentSlide === slides.length - 1}
              className="text-xs font-bold text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Print Mode Layout (Displays all slides vertically on print output) */}
      <div className="hidden print-layout space-y-8">
        {slides.map((slide, idx) => (
          <div 
            key={slide.id} 
            className="print-slide min-h-screen flex flex-col justify-between p-12 bg-slate-950 border border-white/5 rounded-3xl"
          >
            <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-wider text-slate-500 border-b border-white/5 pb-3 w-full">
              <span>{slide.title}</span>
              <span>Slide {idx + 1} de {slides.length}</span>
            </div>
            
            <div className="w-full text-left mt-6">
              <span className="text-[9px] font-black uppercase tracking-wider text-purple-400 block">
                {slide.tagline}
              </span>
            </div>

            <div className="flex-1 w-full flex flex-col justify-center py-8">
              {slide.content}
            </div>

            <div className="border-t border-white/5 pt-3 w-full text-center text-[9px] text-slate-600 font-mono">
              nexID Presentation System · nexid.lat · Imprimido directamente desde CRM
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
