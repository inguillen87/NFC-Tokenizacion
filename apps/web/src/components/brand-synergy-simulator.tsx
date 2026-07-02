"use client";

import React, { useState, useEffect } from "react";
import {
  Wine,
  Ticket,
  Sparkles,
  Zap,
  Network,
  Coins,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Navigation,
  Activity,
  ChevronRight,
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  industry: string;
  icon: React.ReactNode;
  accentFrom: string;
  accentTo: string;
  accentText: string;
  borderColor: string;
  activeBg: string;
  activeBorder: string;
  scannedProduct: string;
  scannedBatch: string;
  partnerBrand: string;
  partnerBenefit: string;
  partnerBenefitDesc: string;
  feeText: string;
  conversionEst: string;
}

export function BrandSynergySimulator({ locale }: { locale: string }) {
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";

  const scenarios: Scenario[] = [
    {
      id: "wine-tourism",
      name: isEn ? "Wine + VIP Transfer" : isBr ? "Vinhos + traslado VIP" : "Vinos + traslados VIP",
      industry: isEn ? "Beverages & Transport" : isBr ? "Bebidas e turismo" : "Bebidas y turismo",
      icon: <Wine className="h-4 w-4" />,
      accentFrom: "from-purple-600",
      accentTo: "to-violet-500",
      accentText: "text-purple-300",
      borderColor: "border-purple-500/40",
      activeBg: "bg-gradient-to-r from-purple-600 to-violet-500",
      activeBorder: "border-purple-500",
      scannedProduct: "Gran Reserva Malbec 2023",
      scannedBatch: "Batch #BOD-2023-Mendoza",
      partnerBrand: "Combi VIP Traslados",
      partnerBenefit: isEn ? "15% off Shuttle Tour" : isBr ? "15% OFF no traslado de retorno" : "15% OFF en traslado de retorno",
      partnerBenefitDesc: isEn
        ? "Ensures safe travel back to the hotel after wine tasting."
        : isBr ? "Permite que turistas voltem ao hotel com seguranca depois da degustacao." : "Permite a los turistas regresar seguros al hotel sin manejar.",
      feeText: isEn
        ? "Partner eligibility + consent gate"
        : isBr ? "Elegibilidade + consentimento" : "Elegibilidad + consentimiento",
      conversionEst: "94%",
    },
    {
      id: "festivals-food",
      name: isEn ? "Events + Gastronomy" : "Festivales + Gastronomía",
      industry: isEn ? "Entertainment & Food" : "Entretenimiento y Gastronomía",
      icon: <Ticket className="h-4 w-4" />,
      accentFrom: "from-orange-500",
      accentTo: "to-amber-400",
      accentText: "text-orange-300",
      borderColor: "border-orange-500/40",
      activeBg: "bg-gradient-to-r from-orange-500 to-amber-400",
      activeBorder: "border-orange-500",
      scannedProduct: "VIP Wristband - Summer Fest",
      scannedBatch: "Batch #EV-SUMMER-2026",
      partnerBrand: "Patagonia Beer Gardens",
      partnerBenefit: isEn ? "Free Craft Pint" : isBr ? "Pint artesanal de presente" : "Pinta artesanal de regalo",
      partnerBenefitDesc: isEn
        ? "Unlocked at the local pub after tapping the smart wristband."
        : "Se desbloquea al ingresar en los stands del predio con el tap físico.",
      feeText: isEn
        ? "Access proof + audience match"
        : isBr ? "Prova de acesso + audiencia" : "Prueba de acceso + audiencia",
      conversionEst: "97%",
    },
    {
      id: "sneakers-club",
      name: isEn ? "Luxury + Club Access" : isBr ? "Luxo + acesso club" : "Lujo + experiencias club",
      industry: isEn ? "Fashion & Nightlife" : isBr ? "Moda e eventos VIP" : "Moda y eventos VIP",
      icon: <Sparkles className="h-4 w-4" />,
      accentFrom: "from-yellow-500",
      accentTo: "to-amber-600",
      accentText: "text-yellow-300",
      borderColor: "border-yellow-500/40",
      activeBg: "bg-gradient-to-r from-yellow-500 to-amber-600",
      activeBorder: "border-yellow-500",
      scannedProduct: "Limited Edition Retro Sneakers",
      scannedBatch: "Batch #SNK-RETRO-09",
      partnerBrand: "Club 146 Lounge VIP",
      partnerBenefit: isEn ? "Free Access + Welcome Drink" : isBr ? "Acesso direto + drink VIP" : "Acceso directo + trago VIP",
      partnerBenefitDesc: isEn
        ? "Verified ownership grants queue-free access to exclusive lounge."
        : "La titularidad verificada del calzado sirve de membresía VIP.",
      feeText: isEn
        ? "Revenue share + fraud gate"
        : isBr ? "Receita compartilhada + antifraude" : "Revenue share + antifraude",
      conversionEst: "89%",
    },
  ];

  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [step, setStep] = useState(0);
  const activeScenario = scenarios.find((s) => s.id === activeId) || scenarios[0];

  useEffect(() => {
    setStep(0);
    const interval = setInterval(() => {
      setStep((prev) => (prev < 3 ? prev + 1 : prev));
    }, 1200);
    return () => clearInterval(interval);
  }, [activeId]);

  return (
    /* ── Outer glassmorphic dark card ── */
    <div className="brand-synergy-simulator relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl p-8 shadow-2xl md:p-10">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,211,238,0.10),transparent_50%)]" />

      <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] items-start">
        {/* ── LEFT: copy + controls ── */}
        <div>
          {/* Eyebrow badge */}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-300">
            <Network className="h-3 w-3 animate-spin" />
            {isEn ? "NEXID BRAND SYNERGY ENGINE" : "MOTOR DE SINERGIA DE MARCAS"}
          </span>

          <h2 className="mt-5 text-3xl font-black tracking-tight text-white md:text-4xl leading-tight">
            {isEn
              ? "Unite products, build trust, share rewards"
              : isBr ? "Ecossistema de sinergias cruzadas e IA" : "Ecosistema de sinergias cruzadas e IA"}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            {isEn
              ? "Every NFC tap not only verifies authenticity, but dynamically queries our matching database. When a customer scans your product, the engine recommends exclusive benefits from partner brands in the nexID family."
              : "Al escanear un producto con chip NFC o QR, el motor de recomendación inteligente busca marcas aliadas en la red y asocia recompensas de socios estratégicos al instante."}
          </p>

          {/* ── Animated flow ── Brand A → [NFC TAP] → nexID → Brand B */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-bold">
            <span className="rounded-lg bg-slate-800 border border-white/10 px-3 py-1.5 text-white whitespace-nowrap">
              🍷 {isEn ? "Brand A" : "Marca A"}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 text-cyan-300 whitespace-nowrap animate-pulse">
              📡 {isEn ? "NFC Tap" : "Tap NFC"}
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="rounded-lg bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-purple-300 whitespace-nowrap font-black">
              nexID
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-emerald-300 whitespace-nowrap">
              🎁 {isEn ? "Brand B reward" : "Recompensa Marca B"}
            </span>
          </div>

          {/* ── Colorful scenario selector pills ── */}
          <div className="mt-6 flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {isEn ? "Select scenario:" : "Seleccionar escenario:"}
            </p>
            <div className="flex flex-wrap gap-2.5">
              {scenarios.map((scen) => {
                const isActive = scen.id === activeId;
                return (
                  <button
                    key={scen.id}
                    onClick={() => setActiveId(scen.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all duration-300 ${
                      isActive
                        ? `${scen.activeBg} ${scen.activeBorder} text-white shadow-lg scale-105`
                        : `bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20 hover:text-white hover:scale-[1.02]`
                    }`}
                  >
                    {scen.icon}
                    {scen.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── CTA Buttons ── */}
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/login?next=/me"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 px-5 py-3 text-sm font-black uppercase tracking-wider transition-all shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5"
            >
              {isEn ? "SIMULATE PORTAL & WALLET" : "SIMULAR PORTAL & WALLET"} <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href="/demo-lab"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 px-5 py-3 text-sm font-bold uppercase tracking-wider transition"
            >
              {isEn ? "Open Demo Lab" : "Abrir Demo Lab"}
            </a>
          </div>
        </div>

        {/* ── RIGHT: Demo panel with high-contrast white-bg steps ── */}
        <div className="brand-synergy-terminal rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden shadow-xl">
          {/* Terminal header */}
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
              <span className="text-[10px] text-purple-300 uppercase font-black tracking-widest">
                PARTNER MATCHING LIVE
              </span>
            </div>
            <span className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
              <Activity className="h-3 w-3 text-cyan-400" />
              Active channel
            </span>
          </div>

          <div className="p-4 space-y-3 font-mono text-[11.5px] text-slate-300">
            {/* Step 1 */}
            <div className="rounded-xl border border-white/10 bg-slate-900 p-3">
              <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">
                {isEn ? "1 · PHYSICAL TAP DETECTED" : "1 · TAP FÍSICO DETECTADO"}
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-100 font-bold text-xs">{activeScenario.scannedProduct}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{activeScenario.scannedBatch}</p>
                </div>
                <Smartphone className="h-5 w-5 text-purple-400 animate-pulse shrink-0" />
              </div>
            </div>

            {/* Step 2 */}
            {step >= 1 && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">
                  {isEn ? "2 · AUTHENTICITY CHECK" : "2 · CHEQUEO DE AUTENTICIDAD"}
                </p>
                <div className="flex items-center gap-2 text-emerald-300">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span className="text-xs">
                    <strong>SUN Verified:</strong> OK · Risk score: 0.01
                  </span>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step >= 2 && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3">
                <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-2">
                  {isEn ? "3 · AI SYNERGY QUERY" : "3 · CONSULTA DE SINERGIA IA"}
                </p>
                <p className="flex items-center gap-1.5 text-xs text-cyan-300">
                  <Navigation className="h-3 w-3 text-cyan-400 animate-pulse" />
                  {isEn ? "Matching cross-brand offers…" : "Geolocalizando ofertas cruzadas…"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {isEn ? `Category: ${activeScenario.industry}` : `Categoría: ${activeScenario.industry}`}
                </p>
              </div>
            )}

            {/* Step 4 – Voucher unlocked */}
            {step >= 3 && (
              <div className="rounded-xl border border-purple-500/40 bg-purple-950/40 p-3 relative overflow-hidden">
                <div className="absolute right-1 bottom-1 opacity-10">
                  <Zap className="h-16 w-16 text-purple-400" />
                </div>
                <p className="text-[9px] uppercase tracking-wider text-purple-300 mb-2">
                  {isEn ? "4 · VOUCHER UNLOCKED" : "4 · VOUCHER ACTIVO"}
                </p>
                <p className="text-[9px] uppercase tracking-widest text-cyan-400 font-bold">
                  {activeScenario.partnerBrand}
                </p>
                <p className="text-sm font-black text-white mt-1 leading-tight">
                  🎁 {activeScenario.partnerBenefit}
                </p>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  {activeScenario.partnerBenefitDesc}
                </p>
                <div className="mt-2 pt-2 border-t border-purple-500/20 flex justify-between items-center text-[10px]">
                  <span className="inline-flex items-center gap-1 text-slate-400">
                    <Coins className="h-3 w-3 text-amber-400" />
                    {activeScenario.feeText}
                  </span>
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-400">
                    Est. {activeScenario.conversionEst}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
