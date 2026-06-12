"use client";

import React, { useState, useMemo } from "react";
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
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  ShoppingBag,
  Coins,
  Volume2,
  VolumeX,
  RefreshCw,
  Gift
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@product/ui";

// Multi-market FAQs object
const faqCategories = [
  {
    id: "bodega-cosmetica",
    label: "Bodegas & Cosmética",
    icon: ShieldCheck,
    color: "text-amber-400 border-amber-500/20 bg-amber-500/5",
    items: [
      {
        q: "¿Esto me va a encarecer mucho el costo por botella o empaque premium?",
        a: "El microchip criptográfico representa centavos de dólar por unidad (menos del 1.5% en botellas o perfumes premium). Además, al operar sobre una base de datos SQL híbrida en servidores premium de Render y AWS por defecto, no hay costos de gas fees ni transacciones de blockchain obligatorias para tu línea estándar.",
        ctx: "A cambio de este mínimo costo, eliminas el fraude y adquieres un canal de datos directo al consumidor final (DTC) que te ahorra miles de dólares en intermediarios de marketing."
      },
      {
        q: "¿Me va a ralentizar la línea de empaque industrial o embotellado?",
        a: "No. Los chips se entregan en formato inlay autoadhesivo (rollos industriales estándar). Tus máquinas etiquetadoras automáticas los aplican debajo de la contraetiqueta o bajo el sello del empaque de forma integrada y sin perder milésimas de velocidad.",
        ctx: "La implementación es totalmente transparente para el gerente de operaciones tanto en embotelladoras como en líneas de envasado cosmético."
      },
      {
        q: "En cosmética, ¿cómo evito que rellenen mis envases originales de perfume o cremas?",
        a: "nexID utiliza circuitos micro-electrónicos TagTamper integrados en el cierre. Al abrir la tapa o atomizador, el filamento del chip se rompe físicamente. El sistema registra permanentemente en el servidor SQL que el sello fue violado.",
        ctx: "Si alguien escanea un perfume rellenado, el sistema advertirá inmediatamente al comprador que el envase original ya fue abierto, destruyendo el mercado negro de adulteraciones."
      }
    ]
  },
  {
    id: "pharma-agro",
    label: "Farmacéutica & Agro",
    icon: Layers,
    color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/5",
    items: [
      {
        q: "¿Qué ventaja tiene sobre el código de barras que exige la regulación de medicamentos?",
        a: "El código de barras es estático y fácilmente duplicable por fotocopiadoras en empaques apócrifos. El microchip nexID genera una firma criptográfica dinámica de un solo uso que se valida contra nuestro servidor seguro en Render/AWS.",
        ctx: "Si una mafia copia el empaque, el servidor detecta que la firma del chip está ausente, es inválida o reporta ubicaciones geográficas simultáneas imposibles, bloqueando la falsificación de medicamentos de alto costo."
      },
      {
        q: "En el agro, ¿qué valor tiene colocar chips en bolsas de semillas de autor o agroquímicos?",
        a: "El mercado negro de semillas adulteradas y agroquímicos diluidos genera pérdidas millonarias y daña cosechas enteras. El chip nexID certifica el origen del criadero o laboratorio oficial directamente en el campo mediante un tap con el celular.",
        ctx: "El productor escanea el bidón o bolsa con su celular y valida que el agroquímico posee la composición y concentración original, protegiendo los derechos de autor y la producción agrícola."
      }
    ]
  },
  {
    id: "eventos-tickets",
    label: "Eventos & Tickets",
    icon: Smartphone,
    color: "text-cyan-400 border-cyan-500/20 bg-cyan-500/5",
    items: [
      {
        q: "Los códigos QR de las entradas se revenden y duplican. ¿Cómo lo soluciona nexID?",
        a: "Reemplazamos el QR digital por pulseras o credenciales VIP físicas inteligentes equipadas con chip NFC nexID. Cada ingreso requiere un tap físico que se procesa en milisegundos contra nuestro servidor Render.",
        ctx: "Al ser imposible clonar la llave criptográfica del chip, se erradica por completo la entrada duplicada o el fraude de accesos en eventos VIP y corporativos."
      }
    ]
  },
  {
    id: "inversores",
    label: "Inversores & SQL Híbrido",
    icon: Coins,
    color: "text-purple-400 border-purple-500/20 bg-purple-500/5",
    items: [
      {
        q: "¿Por qué ofrecer una solución híbrida (SQL + Blockchain Opcional)?",
        a: "Muchos clientes B2B tradicionales le temen a la Web3, gas fees y billeteras digitales. Al ofrecer por defecto una arquitectura SQL segura hospedada en AWS y Render, logramos un onboarding inmediato y sin fricciones.",
        ctx: "Si un cliente final lanza una línea ultra-premium o de colección y desea inmutabilidad total para el mercado de subastas, activamos la capa de Polygon on-chain como un add-on premium facturado en el plan SaaS."
      },
      {
        q: "¿Cómo garantizan la seguridad de la base de datos SQL si es centralizada?",
        a: "La seguridad no depende de la base de datos, sino de la criptografía del chip. Cada tap dinámico genera una firma SUN que solo puede ser descifrada por claves maestras almacenadas en un KMS/HSM de nivel bancario.",
        ctx: "Incluso si un hacker vulnera el servidor SQL, no puede generar firmas dinámicas falsas de chips físicos porque no posee las claves criptográficas maestras."
      },
      {
        q: "¿Cómo escala el modelo SaaS en Render y AWS?",
        a: "Operamos un modelo de software de alta rentabilidad: margen por volumen en el hardware programado (chips) + suscripción SaaS mensual por el uso del panel CRM, telemetría y el motor nexID Cognitive AI Engine.",
        ctx: "Esto nos da ingresos predecibles y un moat defensivo basado en el software y la integración criptográfica propietaria."
      }
    ]
  }
];

// Interactive presentation slides array
const slides = [
  {
    title: "1) nexID Thesis",
    tagline: "Propiedad Digital y Autenticidad Física",
    bullets: [
      "nexID convierte productos físicos en activos verificables, trazables y operables.",
      "Arquitectura Híbrida: base SQL segura por defecto para onboarding fácil, con capa blockchain-ready opcional.",
      "Monetización escalable mediante hardware, setup industrial, SaaS recurrente y licencias API."
    ]
  },
  {
    title: "2) El Problema del Mercado",
    tagline: "Falsificación y Pérdida del Cliente",
    bullets: [
      "Los códigos QR estáticos y hologramas son copiables por cualquier estafador mediante fotos.",
      "Las bodegas y marcas premium pierden el rastro de sus productos tras la venta en vinotecas o exportación.",
      "El marketing tradicional (email, newsletter) tiene tasas de conversión mediocres (<2%)."
    ]
  },
  {
    title: "3) La Solución Híbrida",
    tagline: "SQL en Nube Segura + Web3 Opt-in",
    bullets: [
      "Firma Criptográfica dinámica validada contra nuestra base SQL ultra-segura (Render/AWS) por defecto.",
      "Onboarding inmediato para marcas tradicionales sin necesidad de lidiar con criptomonedas o gas fees.",
      "Capa on-chain (Polygon Amoy) para acuñar pasaportes NFT e inmutabilidad en mercados de colección."
    ]
  },
  {
    title: "4) Seguridad Criptográfica",
    tagline: "Monitoreo Activo de Claves",
    bullets: [
      "Cada tap genera una firma dinámica única (SUN) que se descifra con llaves custodiadas en HSM/KMS.",
      "Telemetría de geolocalización activa: alerta si el mismo chip es leído simultáneamente en dos ciudades.",
      "Circuito físico TagTamper: el chip detecta e informa si la cápsula o sello original ya fue abierto."
    ]
  },
  {
    title: "5) nexID Cognitive AI",
    tagline: "Motor de Optimización de Tono",
    bullets: [
      "Reescritura de campañas comerciales en 3 perfiles: Sommelier, Club Privado y Modern Web3.",
      "Telemetría de impacto live: calcula el Prestige Score, Viralidad y la Huella Emocional del texto.",
      "Traducción semántica inteligente de palabras planas a jerga enológica y tecnológica premium."
    ]
  },
  {
    title: "6) Fidelidad & Gamificación VIP",
    tagline: "Estatus y Cava Digital 3D",
    bullets: [
      "Cava digital interactiva donde los consumidores reclaman la propiedad y coleccionan sus botellas.",
      "Categorías de membresía metálica (Bronce, Plata, Oro) con beneficios y preventas exclusivas.",
      "Gobernanza activa: encuestas on-chain para decidir cortes del próximo Blend o diseño de etiquetas."
    ]
  },
  {
    title: "7) Tracción y Modelo B2B",
    tagline: "SaaS Recurrente y Alto Margen",
    bullets: [
      "Ingresos recurrentes por SaaS de acceso al CRM, geolocalización, AI Engine y portal VIP.",
      "Venta del hardware pre-programado en inlays autoadhesivos con margen del 40%.",
      "Ecosistema multimercado aplicable a Bodegas, Cosmética, Farmacéutica, Agro y Eventos."
    ]
  },
  {
    title: "8) Live Demo Checklist",
    tagline: "Demostración Práctica en 3 Minutos",
    bullets: [
      "1. Hackear QR: Demostrar cómo se clona un QR fotocopiándolo desde una pantalla.",
      "2. Tap NFC: Acercar el móvil a una botella con chip nexID y abrir el Portal VIP sin instalar apps.",
      "3. Live CRM: Mostrar en la notebook cómo el tap apareció en vivo en el mapa del panel."
    ]
  }
];

export function InvestorSnapshotClient() {
  const [activeTab, setActiveTab] = useState<"slides" | "playbook" | "downloads">("slides");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [openFaq, setOpenFaq] = useState<string | null>("bodega-cosmetica-0");
  const [faqCatFilter, setFaqCatFilter] = useState("bodega-cosmetica");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Phone Simulator states
  const [simStep, setSimStep] = useState<"idle" | "tapping" | "loading" | "active">("idle");
  const [phoneTab, setPhoneTab] = useState<"validate" | "mint" | "rewards" | "market">("validate");
  const [isMinted, setIsMinted] = useState(false);
  const [minting, setMinting] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<Record<string, boolean>>({});

  // Web Audio Synth for NFC Tap Beep
  const triggerNfcBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5 note (chime)
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (err) {
      console.log("Audio synt failed:", err);
    }
  };

  const startTapSimulation = () => {
    if (simStep !== "idle") return;
    setSimStep("tapping");
    
    // 1. Move phone to bottle neck (handled by Framer Motion)
    // 2. Play beep at contact point (700ms)
    setTimeout(() => {
      triggerNfcBeep();
      setSimStep("loading");
    }, 700);

    // 3. Load phone screen portal (1800ms)
    setTimeout(() => {
      setSimStep("active");
    }, 1800);
  };

  const resetSimulation = () => {
    setSimStep("idle");
    setPhoneTab("validate");
    setIsMinted(false);
    setMinting(false);
    setClaimedRewards({});
  };

  const handleMintNft = () => {
    if (minting || isMinted) return;
    setMinting(true);
    // Simulate mining delays
    setTimeout(() => {
      setMinting(false);
      setIsMinted(true);
      triggerNfcBeep();
    }, 2000);
  };

  const handleClaimReward = (id: string) => {
    if (claimedRewards[id]) return;
    setClaimedRewards(prev => ({ ...prev, [id]: true }));
    triggerNfcBeep();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 lg:py-16 space-y-12">
      {/* Upper Navigation & Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b border-white/5 pb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Investor Snapshot & Interactive Demo</span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white uppercase">
            nexID: Ecosistema Híbrido Web3
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Presentación interactiva del plan de negocios SaaS y el manual de FAQs multimercado. Explora el simulador de Tap NFC a la derecha para ver la trazabilidad e interactuar con la Web3.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-xl border border-white/5 gap-1 shrink-0 self-stretch md:self-auto">
          {[
            { id: "slides", label: "Slides Pitch", icon: Layers },
            { id: "playbook", label: "Objeciones Playbook", icon: HelpCircle },
            { id: "downloads", label: "PDFs", icon: Download }
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                  isActive 
                    ? "bg-cyan-500/10 border border-cyan-500/35 text-cyan-300 shadow-md shadow-cyan-500/5" 
                    : "text-slate-400 hover:text-white border border-transparent hover:bg-white/[0.02]"
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Slides, Playbook, or Downloads */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === "slides" && (
              <motion.div
                key="slides"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/40 to-slate-950/60 p-8 min-h-[440px] flex flex-col justify-between shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full filter blur-3xl pointer-events-none" />
                  
                  {/* Slide header */}
                  <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-slate-500 border-b border-white/5 pb-4">
                    <span>{slides[currentSlide].title}</span>
                    <span>Diapositiva {currentSlide + 1} de {slides.length}</span>
                  </div>

                  {/* Slide content */}
                  <div className="my-6 space-y-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-400 block">
                      {slides[currentSlide].tagline}
                    </span>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                      {slides[currentSlide].title.split(") ")[1] || slides[currentSlide].title}
                    </h2>
                    <ul className="space-y-3 pt-2">
                      {slides[currentSlide].bullets.map((bullet, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-300 leading-relaxed">
                          <span className="h-5 w-5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Slide controls */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <button
                      onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                      disabled={currentSlide === 0}
                      className="text-xs font-bold text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                      <ChevronLeft className="w-4 h-4" /> Anterior
                    </button>

                    <div className="flex gap-2">
                      {slides.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentSlide(idx)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            currentSlide === idx ? "bg-cyan-500" : "bg-white/10 hover:bg-white/20"
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
                      disabled={currentSlide === slides.length - 1}
                      className="text-xs font-bold text-slate-400 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5"
                    >
                      Siguiente <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Additional Pitch Metrics Widget */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Onboarding", value: "AWS / Render", desc: "SQL core sin gas fees" },
                    { label: "Reducción Fraude", value: "100%", desc: "Chips dinámicos NFC" },
                    { label: "SaaS Recurrente", value: "+40%", desc: "Margen de software neto" }
                  ].map((metric, idx) => (
                    <div key={idx} className="rounded-2xl border border-white/5 bg-slate-900/20 p-4 text-center">
                      <span className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block">{metric.label}</span>
                      <strong className="text-lg text-white font-black mt-1 block">{metric.value}</strong>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">{metric.desc}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "playbook" && (
              <motion.div
                key="playbook"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                {/* FAQ category filters */}
                <div className="flex flex-wrap gap-2">
                  {faqCategories.map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = faqCatFilter === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setFaqCatFilter(cat.id);
                          setOpenFaq(`${cat.id}-0`);
                        }}
                        className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase rounded-lg border transition-all ${
                          isSelected 
                            ? "bg-purple-500/15 border-purple-500/50 text-purple-300" 
                            : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        <CatIcon className="w-3.5 h-3.5" />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Selected FAQ Accordions */}
                <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" /> Manejo de Objeciones del Mercado
                  </h3>

                  {faqCategories.find(c => c.id === faqCatFilter)?.items.map((item, idx) => {
                    const uniqueId = `${faqCatFilter}-${idx}`;
                    const isOpen = openFaq === uniqueId;
                    return (
                      <div 
                        key={idx}
                        className={`rounded-xl border transition-all ${
                          isOpen ? "border-purple-500/30 bg-purple-950/5" : "border-white/5 bg-slate-900/20 hover:border-white/10"
                        }`}
                      >
                        <button
                          onClick={() => setOpenFaq(isOpen ? null : uniqueId)}
                          className="w-full flex items-center justify-between gap-4 p-4 text-left font-bold text-xs uppercase text-white tracking-wide"
                        >
                          <span>{item.q}</span>
                          <span className="shrink-0 text-slate-500">
                            {isOpen ? "▲" : "▼"}
                          </span>
                        </button>
                        
                        {isOpen && (
                          <div className="p-4 pt-0 border-t border-white/5 space-y-3 text-xs text-slate-300 leading-relaxed">
                            <p>{item.a}</p>
                            {item.ctx && (
                              <div className="rounded-lg bg-slate-900/50 p-3 border-l-2 border-cyan-500/40 flex gap-2 items-start">
                                <span className="text-cyan-400 shrink-0 text-[10px] font-mono mt-0.5">ℹ</span>
                                <p className="text-[11px] text-slate-400 italic leading-relaxed">{item.ctx}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeTab === "downloads" && (
              <motion.div
                key="downloads"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-white/10 bg-slate-950 p-8 shadow-2xl text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-300 text-2xl mx-auto">
                    📂
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Descarga de Documentación Oficial</h2>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Obtén los PDF premium pre-diseñados y actualizados con las proporciones originales para enviarlos a tus inversionistas y clientes.
                    </p>
                  </div>

                  <div className="grid gap-4 max-w-md mx-auto pt-2">
                    <a
                      href="/nexid_pitch_deck.pdf"
                      download="nexid_pitch_deck.pdf"
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/50 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-cyan-500/30 transition-all"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="p-2 rounded bg-cyan-500/10 text-cyan-300">📊</span>
                        <span>nexID Pitch Deck (Apaisado)</span>
                      </span>
                      <Download className="w-4 h-4 text-cyan-400" />
                    </a>

                    <a
                      href="/nexid_sales_playbook.pdf"
                      download="nexid_sales_playbook.pdf"
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-slate-900/50 hover:bg-slate-900 text-xs font-bold uppercase tracking-wider text-white hover:border-purple-500/30 transition-all"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="p-2 rounded bg-purple-500/10 text-purple-300">📖</span>
                        <span>Playbook de Ventas & FAQs (Retrato)</span>
                      </span>
                      <Download className="w-4 h-4 text-purple-400" />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: NFC Mobile Tap Simulator */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.06),transparent_60%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.98))] p-6 shadow-2xl relative overflow-hidden flex flex-col items-center">
            
            {/* Simulator Control Header */}
            <div className="w-full flex items-center justify-between border-b border-white/5 pb-4 mb-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                Simulador nexID Live Tap
              </span>

              {/* Sound toggle */}
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1.5 rounded-lg border border-white/5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition"
                title={soundEnabled ? "Silenciar" : "Activar sonido"}
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Tap Arena */}
            <div className="w-full h-[260px] relative border border-white/5 bg-slate-950/40 rounded-2xl overflow-hidden flex items-center justify-center mb-6">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
              
              {/* Bottle (Magnum) */}
              <div className="absolute left-[20%] bottom-0 top-6 w-[80px] flex items-center justify-center z-10">
                <img 
                  src="/images/premium_magnum.png" 
                  alt="Vino premium nexID" 
                  className="h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.6)]"
                />
                
                {/* Contact Ripple point */}
                {simStep === "loading" && (
                  <motion.div 
                    initial={{ scale: 0.1, opacity: 1 }}
                    animate={{ scale: 4, opacity: 0 }}
                    transition={{ duration: 0.8, repeat: 1 }}
                    className="absolute top-[35%] w-8 h-8 rounded-full border-2 border-cyan-400 bg-cyan-400/20"
                  />
                )}
              </div>

              {/* Simulated iPhone Frame */}
              <motion.div
                animate={
                  simStep === "idle"
                    ? { x: 70, y: -20, rotate: 10, scale: 0.95 }
                    : simStep === "tapping"
                    ? { x: -35, y: -45, rotate: -25, scale: 1.05 }
                    : { x: 70, y: -20, rotate: 10, scale: 0.95 }
                }
                transition={{ type: "spring", stiffness: 150, damping: 18 }}
                className="absolute right-[12%] w-[110px] h-[200px] border-[3px] border-slate-700 rounded-[24px] bg-slate-900 shadow-2xl z-20 flex flex-col items-center justify-center overflow-hidden"
              >
                {/* Phone Speaker bar */}
                <div className="w-12 h-1 bg-slate-800 rounded-full absolute top-1.5 z-25" />
                
                {simStep === "idle" && (
                  <div className="text-center p-3 space-y-2">
                    <Smartphone className="w-8 h-8 mx-auto text-slate-500 animate-bounce" />
                    <span className="text-[8px] font-black uppercase text-slate-400 block tracking-widest leading-3">Móvil NFC Pasivo</span>
                  </div>
                )}

                {simStep === "tapping" && (
                  <div className="text-center p-3">
                    <Zap className="w-8 h-8 mx-auto text-cyan-400 animate-pulse" />
                    <span className="text-[8px] font-black uppercase text-cyan-300 block tracking-widest mt-1">Conectando...</span>
                  </div>
                )}

                {simStep === "loading" && (
                  <div className="text-center space-y-2">
                    <RefreshCw className="w-6 h-6 mx-auto text-purple-400 animate-spin" />
                    <span className="text-[7px] font-mono text-slate-400 block uppercase">Decodificando SUN</span>
                  </div>
                )}

                {simStep === "active" && (
                  <div className="w-full h-full bg-[#020617] flex flex-col justify-between p-2 pt-4 relative">
                    <div className="absolute top-1.5 right-2 flex gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-[5px] text-slate-500 font-mono">SQL</span>
                    </div>

                    <div className="text-center">
                      <span className="text-[6px] font-black tracking-widest text-cyan-400 block uppercase">nexID VIP</span>
                      <strong className="text-[7px] text-white block mt-0.5 uppercase truncate leading-none">Magnum Gran Corte</strong>
                    </div>

                    {/* Sim Phone Screen Content */}
                    <div className="flex-1 my-1.5 rounded bg-slate-900/60 p-1 flex items-center justify-center text-[7px] leading-tight text-slate-300 overflow-y-auto">
                      {phoneTab === "validate" && (
                        <div className="space-y-1 w-full text-center">
                          <CheckCircle2 className="w-3.5 h-3.5 mx-auto text-emerald-400" />
                          <p className="font-bold text-white text-[7px]">Sello de Origen OK</p>
                          <p className="text-[6px] text-slate-500">Render SQL Custody</p>
                        </div>
                      )}

                      {phoneTab === "mint" && (
                        <div className="space-y-1 w-full text-center">
                          {isMinted ? (
                            <>
                              <Award className="w-4 h-4 mx-auto text-purple-400" />
                              <p className="font-bold text-white text-[6px]">Gemelo NFT Acuñado</p>
                              <p className="text-[5px] font-mono text-slate-500">ID: #1892</p>
                            </>
                          ) : (
                            <>
                              <Coins className="w-3.5 h-3.5 mx-auto text-purple-400" />
                              <button 
                                onClick={handleMintNft}
                                disabled={minting}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-[6px] text-white font-bold uppercase rounded py-0.5 transition"
                              >
                                {minting ? "Minting..." : "Acuñar NFT"}
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {phoneTab === "rewards" && (
                        <div className="space-y-1 w-full text-center">
                          <Gift className="w-3.5 h-3.5 mx-auto text-amber-400" />
                          <p className="font-bold text-white text-[6px]">Drops del Club</p>
                          {claimedRewards["wine"] ? (
                            <span className="text-emerald-400 font-bold block text-[5px] uppercase">Reclamado OK</span>
                          ) : (
                            <button 
                              onClick={() => handleClaimReward("wine")}
                              className="w-full bg-amber-500 hover:bg-amber-400 text-[5px] text-slate-950 font-black uppercase rounded py-0.5"
                            >
                              Copa Gratis
                            </button>
                          )}
                        </div>
                      )}

                      {phoneTab === "market" && (
                        <div className="space-y-1 w-full text-center">
                          <ShoppingBag className="w-3.5 h-3.5 mx-auto text-cyan-400" />
                          <p className="text-[6px] text-slate-300">Floor: 0.18 ETH</p>
                          <p className="text-[5px] text-slate-500 leading-none">Mercado Secundario</p>
                        </div>
                      )}
                    </div>

                    {/* Sim Phone Tabs */}
                    <div className="grid grid-cols-4 gap-0.5 border-t border-white/5 pt-1 shrink-0">
                      {[
                        { id: "validate", label: "Val" },
                        { id: "mint", label: "Mint" },
                        { id: "rewards", label: "Drop" },
                        { id: "market", label: "Shop" }
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setPhoneTab(item.id as any)}
                          className={`text-[5px] font-black uppercase rounded py-0.5 transition ${
                            phoneTab === item.id 
                              ? "bg-cyan-500/20 text-cyan-300" 
                              : "text-slate-500 hover:text-slate-300"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-3">
              {simStep === "idle" ? (
                <Button
                  onClick={startTapSimulation}
                  variant="primary"
                  className="col-span-2 gap-2 text-xs py-2 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white font-bold tracking-wider uppercase border border-cyan-400/20 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
                >
                  <Smartphone className="w-4 h-4 text-white" />
                  Simular NFC Tap
                </Button>
              ) : (
                <Button
                  onClick={resetSimulation}
                  variant="secondary"
                  className="col-span-2 gap-2 text-xs py-2 border border-white/10 text-slate-300"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  Reiniciar Simulador
                </Button>
              )}
            </div>

            {/* Sim Info Box */}
            <div className="w-full mt-4 p-3 rounded-xl border border-white/5 bg-slate-900/30 text-[10px] text-slate-400 leading-relaxed space-y-1">
              {simStep === "idle" && (
                <p>💡 Presiona <strong>Simular NFC Tap</strong> para acercar el celular y desencadenar el descifrado dinámico contra el backend.</p>
              )}
              {simStep === "active" && (
                <p>🚀 Celular autenticado. Navega por las solapas en la pantalla del celular simulado para acuñar el NFT, reclamar premios o ver el marketplace.</p>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
