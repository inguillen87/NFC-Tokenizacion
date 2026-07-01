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
  Activity
} from "lucide-react";

interface Scenario {
  id: string;
  name: string;
  industry: string;
  icon: React.ReactNode;
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
  
  const scenarios: Scenario[] = [
    {
      id: "wine-tourism",
      name: isEn ? "Wine + Tourism VIP" : "Vinos + Traslados VIP",
      industry: isEn ? "Beverages & Transport" : "Bebidas y Turismo",
      icon: <Wine className="h-4 w-4" />,
      scannedProduct: "Gran Reserva Malbec 2023",
      scannedBatch: "Batch #BOD-2023-Mendoza",
      partnerBrand: "Combi VIP Traslados",
      partnerBenefit: isEn ? "15% off Shuttle Tour" : "15% OFF en Traslado de Retorno",
      partnerBenefitDesc: isEn 
        ? "Ensures safe travel back to the hotel after wine tasting." 
        : "Permite a los turistas regresar seguros al hotel sin tener que manejar.",
      feeText: "1.5% Platform Fee · Gasless swap",
      conversionEst: "94%"
    },
    {
      id: "festivals-food",
      name: isEn ? "Events + Gastronomy" : "Festivales + Gastronomía",
      industry: isEn ? "Entertainment & Food" : "Entretenimiento y Gastronomía",
      icon: <Ticket className="h-4 w-4" />,
      scannedProduct: "VIP Wristband - Summer Fest",
      scannedBatch: "Batch #EV-SUMMER-2026",
      partnerBrand: "Patagonia Beer Gardens",
      partnerBenefit: isEn ? "Free Craft Pint" : "Pinta de Artesanal de Regalo",
      partnerBenefitDesc: isEn
        ? "Unlocked at the local pub after tapping the smart wristband."
        : "Se desbloquea al ingresar en los stands del predio con el tap físico.",
      feeText: "1.2% Platform Fee · NFT check",
      conversionEst: "97%"
    },
    {
      id: "sneakers-club",
      name: isEn ? "Sneakers + Private Club" : "Lujo + Experiencias Club",
      industry: isEn ? "Fashion & Nightlife" : "Moda y Eventos VIP",
      icon: <Sparkles className="h-4 w-4" />,
      scannedProduct: "Limited Edition Retro Sneakers",
      scannedBatch: "Batch #SNK-RETRO-09",
      partnerBrand: "Club 146 Lounge VIP",
      partnerBenefit: isEn ? "Free Access + Welcome Drink" : "Acceso Directo + Trago VIP",
      partnerBenefitDesc: isEn
        ? "Verified ownership grants queue-free access to exclusive lounge."
        : "La titularidad verificada del calzado sirve de membresía VIP.",
      feeText: "2.0% Trade Royalty · Web3 ticket",
      conversionEst: "89%"
    }
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
    <div className="brand-synergy-simulator grid gap-8 lg:grid-cols-[1.1fr_0.9fr] items-center">
      <div>
        <span className="rounded-full border border-purple-400/25 bg-purple-400/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-purple-300 inline-flex items-center gap-1">
          <Network className="h-3 w-3 animate-spin-slow" />
          {isEn ? "NEXID BRAND SYNERGY ENGINE" : "MOTOR DE SINERGIA DE MARCAS"}
        </span>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl leading-tight">
          {isEn 
            ? "Unite products, build trust, share rewards"
            : "Ecosistema de Sinergias Cruzadas & IA"
          }
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">
          {isEn
            ? "Every NFC tap not only verifies authenticity, but dynamically queries our matching database. When a customer scans your product, the engine recommends exclusive benefits from partner brands in the NexID family. Companies boost mutual sales while customers enjoy instant real-world rewards."
            : "Al escanear un producto con chip NFC o QR, el motor de recomendación inteligente de NexID busca marcas aliadas en la red. Si el cliente compra o escanea un producto (ej. una cata de bodega), el sistema le asocia recompensas de socios estratégicos (ej. traslado seguro de retorno). Las empresas se potencian entre sí compartiendo clientes e ingresos."
          }
        </p>

        {/* Scenario Selector Toggles */}
        <div className="mt-6 flex flex-col gap-2.5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {isEn ? "Select simulation scenario:" : "Seleccionar escenario a simular:"}
          </p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((scen) => {
              const isActive = scen.id === activeId;
              return (
                <button
                  key={scen.id}
                  onClick={() => setActiveId(scen.id)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all duration-300 ${
                    isActive 
                      ? "bg-purple-500/20 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                      : "bg-slate-900/50 border-white/10 text-slate-400 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {scen.icon}
                  {scen.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-4">
          <a
            href="/login?next=/me"
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition shadow-md hover:-translate-y-0.5"
          >
            {isEn ? "Simulate Wallet / Portal" : "Simular Portal & Wallet"} <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="/demo-lab"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition"
          >
            {isEn ? "Open Demo Lab" : "Abrir Demo Lab"}
          </a>
        </div>
      </div>

      {/* Visual Live Simulator Terminal */}
      <div className="brand-synergy-terminal rounded-2xl border border-purple-500/20 bg-slate-950/80 p-5 font-mono text-[11.5px] text-slate-300 space-y-4 relative shadow-[0_20px_50px_rgba(168,85,247,0.06)] overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-purple-500/20 via-purple-500 to-cyan-500/20" />
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-purple-500 animate-ping" />
            <span className="text-[10px] text-purple-300 uppercase font-black tracking-widest">
              AI MATCHMAKER LIVE
            </span>
          </div>
          <span className="text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-1">
            <Activity className="h-3 w-3 text-cyan-400" />
            Active channel
          </span>
        </div>

        {/* Step 1: Scan detection */}
        <div className="transition-all duration-500">
          <span className="text-slate-500 block uppercase tracking-wider text-[9px] mb-1">
            {isEn ? "1. PHYSICAL TAP DETECTED" : "1. TAP FÍSICO DETECTADO"}
          </span>
          <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 text-slate-400 flex items-center justify-between">
            <div>
              <p className="text-slate-200 font-bold">{activeScenario.scannedProduct}</p>
              <p className="text-[10px] text-slate-500">{activeScenario.scannedBatch}</p>
            </div>
            <Smartphone className="h-5 w-5 text-purple-400 animate-pulse" />
          </div>
        </div>

        {/* Step 2: Verification status */}
        {step >= 1 && (
          <div className="animate-fade-in transition-all duration-500">
            <span className="text-slate-500 block uppercase tracking-wider text-[9px] mb-1">
              {isEn ? "2. AUTHENTICITY CHECK" : "2. CHEQUEO DE AUTENTICIDAD"}
            </span>
            <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/20 text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                <strong>SUN Signature Verified:</strong> OK (Risk score: 0.01)
              </span>
            </div>
          </div>
        )}

        {/* Step 3: Synergy Matching */}
        {step >= 2 && (
          <div className="animate-fade-in transition-all duration-500">
            <span className="text-slate-500 block uppercase tracking-wider text-[9px] mb-1">
              {isEn ? "3. AI BRAND SYNERGY QUERY" : "3. CONSULTA DE SINERGIA CON IA"}
            </span>
            <div className="bg-slate-900/50 p-2.5 rounded-lg border border-white/5 text-slate-400 space-y-1">
              <p className="flex items-center gap-1.5 text-xs text-purple-300">
                <Navigation className="h-3 w-3 text-cyan-400 animate-pulse" />
                <span>Geolocalizando ofertas cruzadas...</span>
              </p>
              <p className="text-[10px] text-slate-500">
                {isEn ? `Matching category: ${activeScenario.industry}` : `Categorías asociadas: ${activeScenario.industry}`}
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Benefit Unlocked Card */}
        {step >= 3 && (
          <div className="animate-fade-in transition-all duration-500">
            <span className="text-purple-300 block uppercase tracking-wider text-[9px] mb-1">
              {isEn ? "4. MATCH FOUND & VOUCHER UNLOCKED" : "4. MATCH ENCONTRADO & VOUCHER ACTIVO"}
            </span>
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3.5 relative overflow-hidden">
              <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-10">
                <Zap className="h-20 w-20 text-purple-400" />
              </div>
              <p className="text-[9px] uppercase tracking-wider text-cyan-300 font-bold">
                {activeScenario.partnerBrand}
              </p>
              <p className="text-sm font-black text-white mt-1 leading-tight">
                🎁 {activeScenario.partnerBenefit}
              </p>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {activeScenario.partnerBenefitDesc}
              </p>
              <div className="mt-2.5 pt-2 border-t border-purple-500/20 flex justify-between items-center text-[10px]">
                <span className="inline-flex items-center gap-1 text-slate-400">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  {activeScenario.feeText}
                </span>
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-bold text-emerald-400">
                  {isEn ? "Conversion Est:" : "Conversión Est:"} {activeScenario.conversionEst}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
