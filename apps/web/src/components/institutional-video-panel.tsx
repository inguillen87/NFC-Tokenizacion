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
      eyebrow: "Interactive verification experience",
      title: "Tap to simulate the physical-to-digital handoff.",
      body: "Experience the verification steps in real-time or play the multi-language institutional video below.",
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
        eyebrow: "Experiência de Verificação Interativa",
        title: "Toque para simular a transferência física para digital.",
        body: "Experimente as etapas de verificação em tempo real ou reproduza o vídeo institucional multi-idioma abaixo.",
        play: "Institucional nexID",
        primary: "Abrir Demo Lab",
        secondary: "Agendar reunião",
        aria: "video institucional nexID",
        strip: "Produto físico -> toque confiável -> passport -> CRM",
        videoBtn: "📹 Ver Vídeo",
        demoBtn: "⚡ Simulação 3D",
      }
      : {
        eyebrow: "Experiencia de Verificación Interactiva",
        title: "Toca para simular la transferencia física a digital.",
        body: "Experimenta los pasos de verificación en tiempo real o reproduce el video institucional multi-idioma a continuación.",
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

        <div className="institutional-video-frame relative overflow-hidden bg-slate-950 aspect-ratio-[16/9] min-h-[260px]">
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
      step0_desc: "Storyboards & real captures: Tap the phone close to the bottle tag.",
      step1_desc: "NFC challenge triggered. Reading cryptogram from the label...",
      step2_desc: "NTAG 424 DNA security chip computing signature on-the-fly...",
      step3_desc: "Verifying signature. Digital passport unlocked & verified.",
      step4_desc: "Mendoza Malbec Gran Reserva unlocks 15% VIP cab ride discount.",
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
        step0_desc: "Storyboards e capturas reais: Aproxime o celular para escanear a etiqueta.",
        step1_desc: "Desafio NFC disparado. Lendo criptograma da etiqueta...",
        step2_desc: "Chip de segurança NTAG 424 DNA computando assinatura em tempo real...",
        step3_desc: "Verificando assinatura. Passaporte digital desbloqueado e verificado.",
        step4_desc: "Mendoza Malbec Gran Reserva libera 15% de desconto no traslado VIP.",
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
        step0_desc: "Storyboards y capturas reales: Aproxima el celular para escanear la etiqueta.",
        step1_desc: "Desafío NFC disparado. Leyendo criptograma de la etiqueta...",
        step2_desc: "Chip de seguridad NTAG 424 DNA computando firma al vuelo...",
        step3_desc: "Verificando firma. Pasaporte digital desbloqueado y verificado.",
        step4_desc: "Mendoza Malbec Gran Reserva libera 15% de descuento en traslado VIP.",
        provenance: "Mendoza Malbec Gran Reserva",
        batch: "Lote: MZ-2026-A",
        points: "+150 Puntos Ganados",
      };

  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => setStep(2), 1500);
      return () => clearTimeout(timer);
    } else if (step === 2) {
      const timer = setTimeout(() => setStep(3), 3500);
      return () => clearTimeout(timer);
    } else if (step === 3) {
      const timer = setTimeout(() => setStep(4), 3800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col justify-between p-3 font-sans select-none pointer-events-auto relative">
      
      {/* Step Video/Image Player Surface */}
      <div className="absolute inset-0 w-full h-full z-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="storyboard-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.95 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <img
                src="/images/visual_storyboard.jpeg"
                alt="Storyboards nexID"
                className="w-full h-full object-cover filter brightness-[0.4]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
            </motion.div>
          )}

          {step === 1 && (
            <motion.div
              key="tap-animation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full bg-[radial-gradient(circle_at_center,rgba(8,47,73,0.8),rgba(2,6,23,0.98))] flex items-center justify-between px-16 py-6"
            >
              {/* Smartphone Mock */}
              <motion.div
                animate={{ x: 120, rotate: 10, scale: 1.05 }}
                transition={{ type: "spring", stiffness: 90, damping: 15 }}
                className="w-[95px] h-[140px] rounded-2xl border-2 border-slate-700 bg-slate-950 flex flex-col items-center justify-between p-1.5 shadow-2xl relative z-10 shrink-0"
              >
                <div className="w-full h-full rounded-xl bg-slate-900/60 flex flex-col justify-between p-1 relative">
                  <div className="w-5 h-0.5 rounded-full bg-slate-800 mx-auto" />
                  <div className="flex-1 flex flex-col items-center justify-center">
                    <Radio className="h-5 w-5 text-cyan-400 animate-pulse" />
                    <span className="text-[5px] text-cyan-300 font-mono mt-0.5 font-bold animate-pulse">CONNECTING...</span>
                  </div>
                  <div className="w-8 h-0.5 rounded-full bg-slate-800 mx-auto" />
                </div>
              </motion.div>

              {/* Electromagnetic Ripples */}
              <div className="absolute left-[120px] right-[100px] top-[40px] bottom-[40px] flex items-center justify-center pointer-events-none z-0">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.8, scale: 0.2 }}
                    animate={{ opacity: 0, scale: 1.4 }}
                    transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.4, ease: "easeOut" }}
                    className="absolute w-20 h-20 rounded-full border border-cyan-400/40"
                  />
                ))}
              </div>

              {/* Wine Bottle */}
              <img
                src="/images/premium_magnum.png"
                alt="Bottle"
                className="h-[120px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.7)] z-10"
              />
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-chip-video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <video className="w-full h-full object-cover filter brightness-[0.85]" autoPlay loop muted playsInline>
                <source src="/video/3D_render_NTAG_424_DNA.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step-passport-video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <video className="w-full h-full object-cover filter brightness-[0.85]" autoPlay loop muted playsInline>
                <source src="/video/Smartphone_screen_displaying_hologram.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step-glasses-video"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full relative"
            >
              <video className="w-full h-full object-cover filter brightness-[0.85]" autoPlay loop muted playsInline>
                <source src="/video/Man_and_woman_clinking_glasses.mp4" type="video/mp4" />
              </video>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Overlay Status Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[10px] text-slate-300 font-mono z-10 bg-slate-950/40 backdrop-blur-sm px-2 rounded">
        <span className="flex items-center gap-1.5 font-bold">
          <span className={`h-1.5 w-1.5 rounded-full ${step === 4 ? "bg-emerald-400 animate-pulse" : step > 0 ? "bg-cyan-400 animate-pulse" : "bg-slate-500"}`} />
          {step === 0 ? "STANDBY" : step === 1 ? "NFC TAP" : step === 2 ? "NTAG 424 DNA" : step === 3 ? "PASS DECODE" : "SYNERGY LOCKED"}
        </span>
        <span className="font-bold opacity-80">UID: 04E1D4A7F392B1</span>
      </div>

      {/* Center Intro Card for Step 0 */}
      {step === 0 && (
        <div className="z-10 flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="rounded-full bg-cyan-400/10 border border-cyan-400/30 p-3 mb-2 animate-pulse">
            <Zap className="h-6 w-6 text-cyan-400" />
          </div>
          <h3 className="text-sm font-black text-white leading-none tracking-wide uppercase">nexID Experience</h3>
          <p className="text-[10px] text-slate-300 mt-1.5 max-w-sm">{t.step0_desc}</p>
        </div>
      )}

      {/* Spacer to push elements to bottom in other steps */}
      {step > 0 && <div className="flex-1 z-10" />}

      {/* Steps Descriptions Panel */}
      <div className="z-10 text-center px-4 min-h-[38px] flex flex-col justify-center bg-slate-950/70 border border-white/5 rounded-xl backdrop-blur p-2 shadow-2xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={`desc-${step}`}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="text-[9.5px] leading-snug"
          >
            {step === 0 && <p className="text-slate-300">{t.step0_desc}</p>}
            {step === 1 && <p className="text-cyan-300 font-bold">{t.step1_desc}</p>}
            {step === 2 && <p className="text-amber-300 font-semibold">{t.step2_desc}</p>}
            {step === 3 && <p className="text-cyan-200 font-semibold">{t.step3_desc}</p>}
            {step === 4 && (
              <div className="space-y-0.5">
                <p className="text-emerald-300 font-black tracking-wider uppercase text-[10px]">{t.verified} · {t.provenance}</p>
                <p className="text-[9px] text-cyan-300 font-bold animate-bounce mt-0.5">{t.synergy}</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions and Controls */}
      <div className="mt-2.5 flex gap-2 justify-center z-20">
        {step === 0 && (
          <button
            onClick={() => setStep(1)}
            className="px-6 py-2 rounded-xl bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-cyan-300 hover:scale-[1.01] active:scale-95 transition-all shadow-[0_4px_16px_rgba(34,211,238,0.3)] flex items-center gap-1.5"
          >
            <Zap className="h-3.5 w-3.5" />
            {t.startBtn}
          </button>
        )}
        {step > 0 && step < 4 && (
          <div className="px-4 py-1.5 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-sm text-[9px] text-slate-300 font-mono animate-pulse flex items-center gap-2">
            <Cpu className="h-3.5 w-3.5 animate-spin text-cyan-400" />
            {step === 1 ? t.scanning : t.verifying}
          </div>
        )}
        {step === 4 && (
          <div className="flex gap-2">
            <Link
              href="/demo-lab"
              className="px-4 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider hover:bg-emerald-400 transition"
            >
              {isEn ? "Open Passport" : isBr ? "Abrir Passport" : "Abrir Pasaporte"}
            </Link>
            <button
              onClick={() => setStep(0)}
              className="px-4 py-1.5 rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-sm text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 hover:scale-[1.01] active:scale-95 transition flex items-center gap-1.5"
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
