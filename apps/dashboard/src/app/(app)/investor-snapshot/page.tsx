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
      tagline: "LA REVOLUCIÓN DE LA PROPIEDAD FÍSICA Y EL LUJO INTELIGENTE",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-cyan-400 to-purple-600 flex items-center justify-center text-slate-950 font-black text-3xl shadow-[0_0_40px_rgba(168,85,247,0.3)] animate-pulse">
            N
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight uppercase">
            Ecosistema de Autenticidad Física,<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-300">
              Gamificación y Marketing Cognitivo
            </span>
          </h1>
          <p className="text-sm text-slate-400 max-w-xl leading-relaxed">
            Una plataforma Web3 que conecta botellas de alta gama y productos premium con el mundo digital mediante microchips NFC, asegurando procedencia criptográfica y fidelización interactiva.
          </p>
          <div className="flex items-center gap-3 pt-4 no-print">
            <span className="text-[10px] bg-slate-900 border border-white/10 px-3 py-1 rounded-full text-slate-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Material de Inversión VIP
            </span>
          </div>
        </div>
      )
    },
    // Slide 2: The Core Problem
    {
      id: 1,
      title: "El Problema de la Industria de Lujo",
      tagline: "EL 'VACÍO' DESPUÉS DE LA VENTA Y LA PÉRDIDA DE CONTROL",
      content: (
        <div className="grid gap-6 md:grid-cols-3 items-center h-full py-4">
          {[
            {
              title: "Falta de Datos del Comprador",
              desc: "Una vez que la bodega vende una botella en vinotecas o la exporta a Europa, pierde el rastro por completo. No sabe quién la consume ni puede comunicarse directamente con sus compradores VIP.",
              icon: Database,
              color: "border-cyan-500/20 bg-cyan-500/5 text-cyan-300"
            },
            {
              title: "El Fraude de la Falsificación",
              desc: "El mercado internacional de vinos falsificados mueve miles de millones de dólares. Los códigos QR y sellos tradicionales son fotocopiables, dañando severamente el prestigio de las bodegas premium.",
              icon: Lock,
              color: "border-rose-500/20 bg-rose-500/5 text-rose-300"
            },
            {
              title: "Marketing Frío y Genérico",
              desc: "Los newsletters masivos y los folletos impresos tienen tasas de respuesta inferiores al 2%. La base de coleccionistas de lujo exige exclusividad y una interacción interactiva premium.",
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
      tagline: "INTEGRACIÓN HÍBRIDA DE BASE SQL EN LA NUBE (AWS/RENDER) Y CAPA WEB3 OPCIONAL",
      content: (
        <div className="flex flex-col justify-between h-full py-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { step: "1. Embotellado Físico", desc: "Se inserta un microchip NFC criptográfico nexID en el cuello de la botella o empaque.", icon: QrCode },
              { step: "2. Validación y Tap", desc: "El comprador toca el empaque con su celular y valida la procedencia al instante.", icon: Smartphone },
              { step: "3. Nube SQL Segura", desc: "La firma dinámica se verifica contra la base SQL custodiada en Render/AWS.", icon: ShieldCheck },
              { step: "4. Web3 Opcional", desc: "Registro opcional on-chain (Polygon) para generar el gemelo digital de líneas de alta gama.", icon: Sparkles }
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
            <span className="p-3 bg-purple-500/20 rounded-xl text-purple-300 font-black">Híbrido: SQL + Web3</span>
            <p>
              <strong>Una arquitectura flexible de alta velocidad y máxima compatibilidad:</strong> Registramos firmas dinámicas en bases de datos SQL redundantes por defecto. Activamos la capa de Polygon Blockchain on-chain con un clic únicamente para productos de colección o trazabilidad ultra-premium.
            </p>
          </div>
        </div>
      )
    },
    // Slide 4: Pilar A - Cryptographic Security
    {
      id: 3,
      title: "Pilar A: Seguridad Criptográfica",
      tagline: "PREVENCIÓN ACTIVA DE COPIAS Y ANÁLISIS ANTIFRAUDE",
      content: (
        <div className="grid gap-6 md:grid-cols-2 items-center h-full py-4">
          <div className="space-y-4">
            {[
              {
                title: "Firma Dinámica (NFC SUN)",
                desc: "Cada toque físico genera un código de un solo uso criptográfico. La etiqueta no se puede duplicar ni clonar mediante clonadores estándar."
              },
              {
                title: "Telemetría de Geolocalización",
                desc: "Análisis en tiempo real de coordenadas GPS e IPs. Si la misma botella reporta lecturas en Buenos Aires y Miami al mismo tiempo, el sistema levanta alerta de copia."
              },
              {
                title: "Detección de Sello Violado",
                desc: "El circuito del chip se rompe físicamente al descorchar, informando al ledger si la botella ya fue abierta anteriormente, evitando rellenos."
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
              <span>LEDGER DE SEGURIDAD nexID</span>
              <span className="animate-pulse">ACTIVO</span>
            </div>
            <p>· Firma Criptográfica: <span className="text-emerald-400 font-bold">VERIFICADA (OK)</span></p>
            <p>· Estado de Sello: <span className="text-emerald-400 font-bold">CERRADO ORIGINAL</span></p>
            <p>· GPS Tap: <span className="text-white">Lat -34.6037 / Lon -58.3816</span></p>
            <p>· Mobile Device: <span className="text-slate-300">iOS 18.2 (iPhone 16 Pro)</span></p>
          </div>
        </div>
      )
    },
    // Slide 5: Pilar B - Cognitive AI Engine
    {
      id: 4,
      title: "Pilar B: nexID Cognitive AI Engine",
      tagline: "OPTMIZACIÓN DE MENSAJES Y ANÁLISIS DE IMPACTO DE MARCA",
      content: (
        <div className="grid gap-6 md:grid-cols-2 items-center h-full py-4">
          <div className="space-y-3.5">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tres perfiles de reescritura AI</h3>
            {[
              { title: "Tono Sommelier", desc: "Traducción a terminología enológica de prestigio (notas aromáticas, taninos, maderas nobles)." },
              { title: "Tono Club Privado", desc: "Enfocado en triggers de exclusividad, membresías VIP y asignación de cupos." },
              { title: "Tono Modern Web3", desc: "Mapea el copy al vocabulario criptográfico de tokens, airdrops y gemelos digitales." }
            ].map((item, idx) => (
              <div key={idx} className="p-2.5 rounded-xl border border-white/5 bg-slate-900/30">
                <strong className="text-xs text-purple-300 font-bold block">{item.title}</strong>
                <span className="text-[10px] text-slate-400 mt-0.5 block">{item.desc}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider">Telemetría de Impacto Live</span>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                <div className="bg-slate-950/50 p-2 rounded">
                  <span className="text-slate-500 block text-[8px]">PRESTIGIO</span>
                  <strong className="text-amber-400 text-xs font-mono">92% (Exclusivo VIP)</strong>
                </div>
                <div className="bg-slate-950/50 p-2 rounded">
                  <span className="text-slate-500 block text-[8px]">CTR / ESTIMADOR</span>
                  <strong className="text-purple-400 text-xs font-mono">28% (Conversión Alta)</strong>
                </div>
              </div>
              <div className="text-[9px] text-slate-400 leading-relaxed pt-1">
                La IA analiza la huella emocional midiendo los niveles de *Exclusividad*, *Confianza*, *Curiosidad* y *Urgencia* del texto de la campaña antes de enviarlo al consumidor.
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
                desc: "Los clientes visualizan sus botellas originales escaneadas en 3D en su portal, incentivando la compra para completar la colección digital."
              },
              {
                title: "Categorías Metálicas de Estatus",
                desc: "Aumentando escaneos se sube de Starter a Plata, Platino y Oro, desbloqueando credenciales exclusivas y catas con el enólogo."
              },
              {
                title: "Sommelier AI & Gobernanza Activa",
                desc: "Chat interactivo de servicio y maridaje. Votos reales sobre la uva del próximo blend, diseños de etiquetas y eventos VIP."
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
              Gobernanza VIP Activa
            </span>
            <h4 className="text-xs font-bold text-white">Votación en Curso: Diseño de Etiqueta Cosecha 2026</h4>
            <div className="space-y-1.5 text-[10px] text-left pt-1">
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-slate-300">Opción A (Clásico Grabado)</span>
                  <span className="text-amber-400 font-bold">58%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full rounded-full" style={{ width: "58%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-0.5">
                  <span className="text-slate-300">Opción B (Minimalista Vanguardista)</span>
                  <span className="text-slate-500 font-bold">42%</span>
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
    // Slide 7: Commercial Traction & Business Opportunity
    {
      id: 6,
      title: "Tracción y Oportunidad de Negocio",
      tagline: "VALOR COMERCIAL DISRUPTIVO PARA LAS BODEGAS",
      content: (
        <div className="grid gap-6 md:grid-cols-3 items-center h-full py-4 text-center">
          {[
            {
              title: "Datos Directos de Mercado",
              desc: "Las bodegas finalmente saben quién es su cliente final en el extranjero, obteniendo demografía y hábitos sin depender del distribuidor.",
              metric: "100%",
              label: "Propiedad de Datos"
            },
            {
              title: "Control en Exportación",
              desc: "Monitoreo activo del mercado gris y reventa. Certificación del lote original en aduana para proteger el valor comercial.",
              metric: "Zero",
              label: "Falsificaciones en Red"
            },
            {
              title: "Recurrencia e Ingresos",
              desc: "Membresías recurrentes y mercado integrado (Marketplace). Los taps físicos generan compras secundarias directas a la bodega.",
              metric: "+24%",
              label: "Venta Directa Direct-to-Consumer"
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
    // Slide 8: Live Demo & Next Steps
    {
      id: 7,
      title: "Demostración en Vivo y Próximos Pasos",
      tagline: "EXPERIMENTÁ EL MOTOR COGNITIVO nexID AHORA MISMO",
      content: (
        <div className="flex flex-col items-center justify-center text-center h-full space-y-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            Listo para la demostración práctica
          </h2>
          <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
            A continuación, usaremos una botella de cata real equipada con chip NFC nexID, un teléfono móvil inteligente para reclamar la propiedad, y la notebook del administrador para ver el ledger criptográfico en tiempo real.
          </p>

          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 max-w-2xl w-full pt-2">
            {[
              { title: "NFC Smart Tag", step: "Apunta el teléfono" },
              { title: "Consumer App", step: "Reclamar Dueño" },
              { title: "Bodega CRM", step: "IA Campaign Telemetry" },
              { title: "Polygon Ledger", step: "Tokenización NFT" }
            ].map((item, idx) => (
              <div key={idx} className="rounded-xl border border-white/5 bg-slate-950 p-3 text-center">
                <span className="text-[8px] uppercase text-slate-500 font-bold block">Fase {idx + 1}</span>
                <strong className="text-xs text-white mt-1 block">{item.title}</strong>
                <span className="text-[9px] text-purple-300 mt-0.5 block">{item.step}</span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-slate-500 font-mono pt-4">
            nexID Inc. · info@nexid.lat · nexID Cognitive AI Vision Suite 2026
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
