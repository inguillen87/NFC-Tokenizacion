"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, RefreshCw, Smartphone, Radio, Cpu, Award, Zap, Coins } from "lucide-react";
import { schedulingUrls } from "@product/config";
import { resolveInstitutionalVideo } from "../lib/institutional-video";

type InstitutionalVideoPanelProps = {
  locale: string;
  variant?: "landing" | "demo";
  className?: string;
};

export function InstitutionalVideoPanel({ locale, variant = "landing", className = "" }: InstitutionalVideoPanelProps) {
  const [mode, setMode] = useState<"video" | "interactive">("interactive");
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";
  const video = resolveInstitutionalVideo(locale);

  const copy = isEn
    ? {
      eyebrow: "Verify experience",
      title: "Understand nexID in a cinematic tap.",
      body: "Toggle between the video explanation and the live interactive 3D simulation showing the real physical-to-digital handoff.",
      play: "nexID institutional",
      primary: "Open Demo Lab",
      secondary: "Schedule meeting",
      aria: "nexID institutional video",
      strip: "Physical product -> trusted tap -> customer passport -> CRM signal",
      videoBtn: "📹 Play Video",
      demoBtn: "⚡ Interactive Demo",
    }
    : isBr
      ? {
        eyebrow: "Experiência de Verificação",
        title: "Entenda o nexID com um toque cinemático.",
        body: "Alterne entre o vídeo institucional e a simulação 3D interativa que demonstra a transferência real do físico para o digital.",
        play: "Institucional nexID",
        primary: "Abrir Demo Lab",
        secondary: "Agendar reunião",
        aria: "video institucional nexID",
        strip: "Produto físico -> toque confiável -> passport -> CRM",
        videoBtn: "📹 Ver Vídeo",
        demoBtn: "⚡ Simulação 3D",
      }
      : {
        eyebrow: "Experiencia de Verificación",
        title: "Entiende nexID en un toque cinemático.",
        body: "Alterna entre el video institucional y la simulación 3D interactiva que demuestra la transferencia real del plano físico al digital.",
        play: "Institucional nexID",
        primary: "Abrir Demo Lab",
        secondary: "Agendar reunión",
        aria: "video institucional nexID",
        strip: "Producto físico -> toque confiable -> pasaporte -> CRM",
        videoBtn: "📹 Ver Video",
        demoBtn: "⚡ Simulación 3D",
      };

  return (
    <section className={`institutional-video-panel institutional-video-panel--${variant} ${className}`} aria-label={copy.aria}>
      <div className="institutional-video-copy">
        <p>{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
        <div className="institutional-video-actions">
          <Link href="/demo-lab">{copy.primary}</Link>
          <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer">{copy.secondary}</a>
        </div>
      </div>
      <div className="institutional-video-device">
        <div className="institutional-video-topbar flex items-center justify-between w-full px-4 py-2 border-b border-white/5 bg-slate-950/60 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="institutional-video-mark flex items-center justify-center font-bold text-cyan-300">N</span>
            <strong className="text-xs font-bold text-white tracking-wider">nex<span className="text-cyan-400">ID</span></strong>
          </div>
          <div className="flex bg-slate-900/90 p-0.5 rounded-lg border border-white/5 gap-1 select-none pointer-events-auto z-30">
            <button
              onClick={() => setMode("video")}
              className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition ${
                mode === "video"
                  ? "bg-cyan-400 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {copy.videoBtn}
            </button>
            <button
              onClick={() => setMode("interactive")}
              className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition ${
                mode === "interactive"
                  ? "bg-cyan-400 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {copy.demoBtn}
            </button>
          </div>
        </div>

        <div className="institutional-video-frame relative overflow-hidden bg-slate-950 aspect-ratio-[16/9] min-h-[220px]">
          <AnimatePresence mode="wait">
            {mode === "video" ? (
              <motion.div
                key="video-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full absolute inset-0"
              >
                <video key={video.src} className="w-full h-full object-cover" controls preload="metadata" playsInline controlsList="nodownload" data-video-locale={video.locale} data-video-target={video.futureSrc}>
                  <source src={video.src} type={video.type} />
                </video>
                <span className="institutional-video-watermark">nexID</span>
              </motion.div>
            ) : (
              <motion.div
                key="cinematic-simulator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full absolute inset-0"
              >
                <CinematicTapSimulator locale={locale} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="institutional-video-strip">
          <span>{copy.strip}</span>
          <i />
        </div>
      </div>
    </section>
  );
}

function CinematicTapSimulator({ locale }: { locale: string }) {
  const [step, setStep] = useState(0);
  const isEn = locale === "en";
  const isBr = locale === "pt-BR";

  const t = isEn
    ? {
      startBtn: "Perform NFC Tap",
      scanning: "Establishing secure NFC connection...",
      verifying: "Verifying SUN cryptographic signature...",
      verified: "AUTHENTIC ORIGINAL VERIFIED",
      synergy: "NexID Club Synergy: 15% discount on VIP cab ride back unlocked!",
      resetBtn: "Reset Simulation",
      step0_desc: "Bring the phone close to the bottle to tap the secure tag.",
      step1_desc: "NFC challenge triggered. Reading cryptogram from the label...",
      step2_desc: "Validating SUN signature against the decentralised registry...",
      step3_desc: "Guaranteed provenance. NFT proof generated on Polygon Amoy.",
      provenance: "Mendoza Malbec Gran Reserva",
      batch: "Batch: MZ-2026-A",
      points: "+150 Points Earned",
    }
    : isBr
      ? {
        startBtn: "Fazer Tap NFC",
        scanning: "Estabelecendo conexão NFC segura...",
        verifying: "Verificando assinatura criptográfica SUN...",
        verified: "ORIGINAL AUTÊNTICO VERIFICADO",
        synergy: "Sinergia NexID Club: 15% de desconto no transporte VIP liberado!",
        resetBtn: "Reiniciar Simulação",
        step0_desc: "Aproxime o celular da garrafa para escanear a etiqueta de segurança.",
        step1_desc: "Desafio NFC disparado. Lendo criptograma da etiqueta...",
        step2_desc: "Validando assinatura SUN contra o registro descentralizado...",
        step3_desc: "Procedência garantida. Comprovante NFT emitido na Polygon Amoy.",
        provenance: "Mendoza Malbec Gran Reserva",
        batch: "Lote: MZ-2026-A",
        points: "+150 Pontos Ganhos",
      }
      : {
        startBtn: "Hacer Tap NFC",
        scanning: "Estableciendo conexión NFC segura...",
        verifying: "Verificando firma criptográfica SUN...",
        verified: "ORIGINAL AUTÉNTICO VERIFICADO",
        synergy: "Sinergia NexID Club: ¡15% de descuento en traslado VIP liberado!",
        resetBtn: "Reiniciar Simulación",
        step0_desc: "Aproxima el celular a la botella para escanear la etiqueta de seguridad.",
        step1_desc: "Desafío NFC disparado. Leyendo criptograma de la etiqueta...",
        step2_desc: "Validando firma SUN contra el registro descentralizado...",
        step3_desc: "Procedencia garantizada. Comprobación NFT emitida en Polygon Amoy.",
        provenance: "Mendoza Malbec Gran Reserva",
        batch: "Lote: MZ-2026-A",
        points: "+150 Puntos Ganados",
      };

  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => setStep(2), 1500);
      return () => clearTimeout(timer);
    } else if (step === 2) {
      const timer = setTimeout(() => setStep(3), 2200);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(8,47,73,0.8),rgba(2,6,23,0.98))] flex flex-col justify-between p-4 font-sans select-none pointer-events-auto">
      {/* Top Banner Status */}
      <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[10px] text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${step === 3 ? "bg-emerald-400 animate-pulse" : step > 0 ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
          {step === 0 ? "STANDBY" : step === 1 ? "NFC CONNECTION" : step === 2 ? "CRYPTO AUDIT" : "PASSPORT VALID"}
        </span>
        <span>UID: 04E1D4A7F392B1</span>
      </div>

      {/* Main Animation Area */}
      <div className="flex-1 flex items-center justify-between relative overflow-hidden min-h-[140px] px-6">
        
        {/* Smartphone Mock */}
        <motion.div
          animate={
            step === 1
              ? { x: 130, rotate: 12, scale: 1.05 }
              : step >= 2
              ? { x: 0, rotate: 0, scale: 1 }
              : { x: -20, rotate: 0, scale: 1 }
          }
          transition={{ type: "spring", stiffness: 90, damping: 15 }}
          className={`w-[110px] h-[160px] rounded-2xl border-2 bg-slate-950 flex flex-col items-center justify-between p-2 shadow-2xl relative z-10 shrink-0 ${
            step === 3 ? "border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]" : "border-slate-800"
          }`}
        >
          {/* Internal Screen Mock */}
          <div className="w-full h-full rounded-xl bg-slate-900/60 overflow-hidden flex flex-col justify-between p-1.5 relative">
            <div className="w-6 h-1 rounded-full bg-slate-800 mx-auto mb-1 shrink-0" />
            
            {/* Screen Content based on step */}
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="sc-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <Smartphone className="h-6 w-6 text-slate-500 animate-bounce" />
                    <span className="text-[7px] text-slate-500 font-mono mt-1 font-bold">READY TO TAP</span>
                  </motion.div>
                )}
                {step === 1 && (
                  <motion.div
                    key="sc-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center"
                  >
                    <Radio className="h-6 w-6 text-cyan-400 animate-pulse" />
                    <span className="text-[6px] text-cyan-300 font-mono mt-1 font-bold animate-pulse">CONNECTING...</span>
                  </motion.div>
                )}
                {step === 2 && (
                  <motion.div
                    key="sc-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="w-full flex flex-col items-start text-left font-mono text-[5px] text-cyan-400 leading-tight space-y-0.5 bg-black/40 p-1 rounded border border-white/5"
                  >
                    <div className="text-[6px] text-amber-300 font-bold border-b border-white/5 pb-0.5 w-full">DECRYPTING SUN...</div>
                    <div>&gt; UID: 04E1D4A7</div>
                    <div>&gt; CTR: 000164</div>
                    <div>&gt; SIG: VALID</div>
                    <div>&gt; RISK: 0/100</div>
                  </motion.div>
                )}
                {step === 3 && (
                  <motion.div
                    key="sc-3"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center w-full"
                  >
                    <ShieldCheck className="h-6 w-6 text-emerald-400" />
                    <span className="text-[7px] text-emerald-300 font-bold mt-1 tracking-tight leading-none">VERIFIED</span>
                    <span className="text-[5px] text-slate-400 mt-1 font-mono leading-none truncate max-w-[80px]">MZ-GranReserva</span>
                    <div className="mt-1 flex items-center gap-0.5 bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5 text-[5px] text-amber-200">
                      <Award className="h-2 w-2 shrink-0" />
                      <span>{isEn ? "Gold" : "Oro"}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Phone Home Bar */}
            <div className="w-10 h-0.5 rounded-full bg-slate-800 mx-auto mt-1 shrink-0" />
          </div>
        </motion.div>

        {/* Electromagnetic Ripple (Only visible during step 1) */}
        <AnimatePresence>
          {step === 1 && (
            <div className="absolute left-[110px] right-[100px] top-[40px] bottom-[40px] flex items-center justify-center pointer-events-none z-0">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0.8, scale: 0.2 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  exit={{ opacity: 0 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    delay: i * 0.4,
                    ease: "easeOut",
                  }}
                  className="absolute w-24 h-24 rounded-full border border-cyan-400/40"
                />
              ))}
            </div>
          )}
        </AnimatePresence>

        {/* Premium Product Mock (Wine Bottle) */}
        <motion.div
          animate={step === 1 ? { scale: 0.98, y: 2 } : { scale: 1, y: 0 }}
          className="relative h-[150px] w-[90px] flex items-center justify-center shrink-0 z-10"
        >
          {/* Bottle Shadow */}
          <div className="absolute bottom-1 w-12 h-2.5 bg-black/50 blur-md rounded-full" />
          
          {/* Bottle Graphic using generated premium magnum */}
          <img
            src="/images/premium_magnum.png"
            alt="Mendoza Malbec Premium"
            className="h-[140px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)]"
          />

          {/* Secure Tag Glow Overlay */}
          <span className={`absolute top-[42px] h-3.5 w-3.5 rounded-full border flex items-center justify-center transition-all duration-300 ${
            step === 3 
              ? "bg-emerald-500/25 border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)]" 
              : step === 1 
              ? "bg-cyan-500/25 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-ping" 
              : "bg-amber-500/10 border-amber-500/40 shadow-[0_0_6px_rgba(245,158,11,0.2)]"
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${step === 3 ? "bg-emerald-400" : step === 1 ? "bg-cyan-400" : "bg-amber-400"}`} />
          </span>
        </motion.div>
      </div>

      {/* Steps Descriptions */}
      <div className="mt-2 text-center px-4 min-h-[36px] flex flex-col justify-center border-t border-white/5 pt-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={`desc-${step}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[10px] leading-snug"
          >
            {step === 0 && <p className="text-slate-300">{t.step0_desc}</p>}
            {step === 1 && <p className="text-cyan-300 font-bold">{t.step1_desc}</p>}
            {step === 2 && <p className="text-amber-300 font-semibold">{t.step2_desc}</p>}
            {step === 3 && (
              <div className="space-y-1">
                <p className="text-emerald-300 font-bold tracking-wider">{t.verified} · {t.provenance}</p>
                <p className="text-[9px] text-cyan-300 font-medium">{t.synergy}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 flex gap-2 justify-center z-20">
        {step === 0 && (
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-cyan-300 hover:scale-[1.02] active:scale-95 transition-all shadow-[0_4px_16px_rgba(34,211,238,0.25)] flex items-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            {t.startBtn}
          </button>
        )}
        {step > 0 && step < 3 && (
          <div className="px-5 py-2 rounded-xl border border-white/10 bg-slate-900/50 text-[10px] text-slate-400 font-mono animate-pulse flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            {step === 1 ? t.scanning : t.verifying}
          </div>
        )}
        {step === 3 && (
          <div className="flex gap-2">
            <Link
              href="/demo-lab"
              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
            >
              {isEn ? "Open Passport" : isBr ? "Abrir Passport" : "Abrir Pasaporte"}
            </Link>
            <button
              onClick={() => setStep(0)}
              className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 hover:scale-[1.01] active:scale-95 transition flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t.resetBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
