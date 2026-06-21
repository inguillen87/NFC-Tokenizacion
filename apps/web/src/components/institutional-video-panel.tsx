"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Cpu, Radio, RefreshCw, Zap, Volume2, VolumeX } from "lucide-react";
import { schedulingUrls } from "@product/config";
import { resolveInstitutionalVideo } from "../lib/institutional-video";

type InstitutionalVideoPanelProps = {
  locale: string;
  variant?: "landing" | "demo";
  className?: string;
};

type SupportedLocale = "es-AR" | "en" | "pt-BR";

type PanelCopy = {
  eyebrow: string;
  title: string;
  body: string;
  primary: string;
  secondary: string;
  aria: string;
  strip: string;
  videoBtn: string;
  demoBtn: string;
};

type SimulatorCopy = {
  startBtn: string;
  scanning: string;
  verifying: string;
  verified: string;
  resetBtn: string;
  step0Desc: string;
  provenance: string;
  points: string;
  subtitles: Record<1 | 2 | 3 | 4, string>;
  voucherTitle: string;
  voucherSubtitle: string;
  voucherDesc: string;
  voucherClaim: string;
  voucherStatus: string;
  voucherCode: string;
};

const PANEL_COPY: Record<SupportedLocale, PanelCopy> = {
  "es-AR": {
    eyebrow: "Experiencia de verificación interactiva",
    title: "Tocá para simular el puente de producto físico a identidad digital.",
    body: "Recorré la verificación NFC en tiempo real o reproducí el institucional multi-idioma desde el mismo panel.",
    primary: "Abrir Demo Lab",
    secondary: "Agendar reunión",
    aria: "video institucional nexID",
    strip: "Producto físico -> toque confiable -> pasaporte digital -> señal CRM",
    videoBtn: "Ver video",
    demoBtn: "Simulación NFC",
  },
  en: {
    eyebrow: "Interactive verification experience",
    title: "Tap to simulate the physical-to-digital handoff.",
    body: "Explore the NFC verification flow in real time or play the multi-language institutional video from the same panel.",
    primary: "Open Demo Lab",
    secondary: "Schedule meeting",
    aria: "nexID institutional video",
    strip: "Physical product -> trusted tap -> digital passport -> CRM signal",
    videoBtn: "Play video",
    demoBtn: "NFC simulation",
  },
  "pt-BR": {
    eyebrow: "Experiência de verificação interativa",
    title: "Toque para simular a ponte entre produto físico e identidade digital.",
    body: "Percorra a verificação NFC em tempo real ou reproduza o institucional multi-idioma no mesmo painel.",
    primary: "Abrir Demo Lab",
    secondary: "Agendar reunião",
    aria: "video institucional nexID",
    strip: "Produto físico -> toque confiável -> passaporte digital -> sinal CRM",
    videoBtn: "Ver video",
    demoBtn: "Simulação NFC",
  },
};

const SIMULATOR_COPY: Record<SupportedLocale, SimulatorCopy> = {
  "es-AR": {
    startBtn: "Hacer tap NFC",
    scanning: "Estableciendo conexión NFC segura...",
    verifying: "Verificando firma criptográfica SUN...",
    verified: "ORIGINAL AUTÉNTICO VERIFICADO",
    resetBtn: "Reiniciar simulación",
    step0Desc: "Aproximá el celular al tag de la botella para iniciar la verificación.",
    provenance: "Mendoza Malbec Gran Reserva",
    points: "+150 puntos acreditados",
    subtitles: {
      1: "El celular dispara un desafío NFC seguro contra la etiqueta inteligente.",
      2: "El chip NTAG 424 DNA calcula una firma única para evitar copias estáticas.",
      3: "La firma se valida y el pasaporte digital del producto queda desbloqueado.",
      4: "El producto original habilita un voucher para cenar con tu pareja en Bodega Mendoza.",
    },
    voucherTitle: "Voucher de regalo",
    voucherSubtitle: "Cena para 2 en Bodega Mendoza",
    voucherDesc: "Experiencia gastronómica para dos personas. Reclamalo y mostralo desde tu pasaporte nexID.",
    voucherClaim: "Reclamar en mi billetera",
    voucherStatus: "Listo para guardar en tu billetera digital",
    voucherCode: "Cupón: NEX-WINE-DUO-2026",
  },
  en: {
    startBtn: "Perform NFC tap",
    scanning: "Establishing secure NFC connection...",
    verifying: "Verifying SUN cryptographic signature...",
    verified: "AUTHENTIC ORIGINAL VERIFIED",
    resetBtn: "Reset simulation",
    step0Desc: "Move the phone close to the bottle tag to start the verification.",
    provenance: "Mendoza Malbec Gran Reserva",
    points: "+150 points earned",
    subtitles: {
      1: "The phone triggers a secure NFC challenge against the smart label.",
      2: "The NTAG 424 DNA chip calculates a unique signature to prevent static copies.",
      3: "The signature is validated and the product digital passport is unlocked.",
      4: "The original product unlocks a dinner-for-two voucher at Mendoza Winery.",
    },
    voucherTitle: "Gift voucher",
    voucherSubtitle: "Dinner for 2 at Mendoza Winery",
    voucherDesc: "Complimentary dining experience for two. Claim it and show it from your nexID passport.",
    voucherClaim: "Claim in my wallet",
    voucherStatus: "Ready to save in your digital wallet",
    voucherCode: "Coupon: NEX-WINE-DUO-2026",
  },
  "pt-BR": {
    startBtn: "Fazer tap NFC",
    scanning: "Estabelecendo conexão NFC segura...",
    verifying: "Verificando assinatura criptográfica SUN...",
    verified: "ORIGINAL AUTÊNTICO VERIFICADO",
    resetBtn: "Reiniciar simulação",
    step0Desc: "Aproxime o celular da etiqueta da garrafa para iniciar a verificação.",
    provenance: "Mendoza Malbec Gran Reserva",
    points: "+150 pontos creditados",
    subtitles: {
      1: "O celular dispara um desafio NFC seguro contra a etiqueta inteligente.",
      2: "O chip NTAG 424 DNA calcula uma assinatura única para evitar cópias estáticas.",
      3: "A assinatura é validada e o passaporte digital do produto é desbloqueado.",
      4: "O produto original libera um voucher de jantar para duas pessoas na Vinícola Mendoza.",
    },
    voucherTitle: "Voucher de presente",
    voucherSubtitle: "Jantar para 2 na Vinícola Mendoza",
    voucherDesc: "Experiência gastronômica para duas pessoas. Resgate e apresente pelo seu passaporte nexID.",
    voucherClaim: "Resgatar na minha carteira",
    voucherStatus: "Pronto para guardar na sua carteira digital",
    voucherCode: "Cupom: NEX-WINE-DUO-2026",
  },
};

const VIDEO_SUBTITLES: Record<SupportedLocale, Array<{ start: number; end: number; text: string }>> = {
  "es-AR": [
    { start: 0, end: 15, text: "En un mundo inundado de copias, la confianza física necesita una firma digital indestructible. Presentamos nexID." },
    { start: 15, end: 35, text: "Un simple toque con tu celular sobre cualquier producto original activa un desafío criptográfico único. Sin aplicaciones que descargar, validado directamente por el chip de seguridad NTAG 424 DNA." },
    { start: 35, end: 50, text: "Al instante, el consumidor accede al pasaporte digital del producto: procedencia garantizada, historial de la pieza y beneficios exclusivos del Club de Marcas aliadas." },
    { start: 50, end: 60, text: "nexID. El puente definitivo entre el producto físico y el ecosistema Web3. Protege tu marca, fideliza a tus clientes." }
  ],
  en: [
    { start: 0, end: 15, text: "In a world flooded with counterfeits, physical trust requires an indestructible digital signature. Introducing nexID." },
    { start: 15, end: 35, text: "A simple tap of your phone on any original product triggers a unique cryptographic challenge. No apps to download, validated instantly by the secure NTAG 424 DNA chip." },
    { start: 35, end: 50, text: "Immediately, the consumer unlocks the product's digital passport: guaranteed provenance, lifecycle history, and exclusive partner brand rewards." },
    { start: 50, end: 60, text: "nexID. The ultimate bridge between physical assets and the Web3 ecosystem. Protect your brand, empower your community." }
  ],
  "pt-BR": [
    { start: 0, end: 15, text: "Em um mundo cheio de falsificações, a confiança física exige uma assinatura digital indestrutível. Apresentamos nexID." },
    { start: 15, end: 35, text: "Um simples toque do celular em qualquer produto original ativa um desafio criptográfico único. Sem aplicativos para baixar, validado instantaneamente pelo chip de segurança NTAG 424 DNA." },
    { start: 35, end: 50, text: "Na hora, o consumidor acessa o passaporte digital do produto: procedência garantida, histórico do ciclo de vida e benefícios exclusivos do Clube de Marcas parceiras." },
    { start: 50, end: 60, text: "nexID. A ponte definitiva entre o produto físico e o ecossistema Web3. Proteja sua marca, fidelize seus clientes." }
  ]
};

const STATUS_BY_STEP = ["STANDBY", "NFC TAP", "NTAG 424 DNA", "PASS DECODE", "MARKETPLACE WIN"] as const;
const BARCODE_BARS = Array.from({ length: 24 }, (_, index) => ({
  width: index % 3 === 0 ? "3px" : index % 5 === 0 ? "1px" : "2px",
  opacity: index % 4 === 0 ? 0.42 : 0.84,
}));
const TICKET_DOTS = Array.from({ length: 40 }, (_, index) => index);

function normalizeLocale(locale: string): SupportedLocale {
  if (locale === "en") return "en";
  if (locale === "pt-BR") return "pt-BR";
  return "es-AR";
}

export function InstitutionalVideoPanel({ locale, variant = "landing", className = "" }: InstitutionalVideoPanelProps) {
  const [mode, setMode] = useState<"video" | "interactive">("interactive");
  const [activeVideoSubtitle, setActiveVideoSubtitle] = useState<string | null>(null);
  const activeLocale = normalizeLocale(locale);
  const video = resolveInstitutionalVideo(locale);
  const copy = PANEL_COPY[activeLocale];

  useEffect(() => {
    setActiveVideoSubtitle(null);
  }, [mode]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = e.currentTarget.currentTime;
    const subtitles = VIDEO_SUBTITLES[activeLocale];
    const matched = subtitles.find((s) => time >= s.start && time < s.end);
    setActiveVideoSubtitle(matched ? matched.text : null);
  };

  return (
    <section className={`institutional-video-panel institutional-video-panel--${variant} ${className}`} aria-label={copy.aria}>
      <div className="institutional-video-copy">
        <p>{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
        <div className="institutional-video-actions">
          <Link href="/demo-lab">{copy.primary}</Link>
          <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer">
            {copy.secondary}
          </a>
        </div>
      </div>

      <div className="institutional-video-device">
        <div className="institutional-video-topbar flex w-full items-center justify-between border-b border-white/5 bg-slate-950/60 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="institutional-video-mark flex items-center justify-center font-bold text-cyan-300">N</span>
            <strong className="text-xs font-bold tracking-wider text-white">
              nex<span className="text-cyan-400">ID</span>
            </strong>
          </div>

          <div className="pointer-events-auto z-30 flex select-none gap-1 rounded-lg border border-white/5 bg-slate-900/90 p-0.5">
            <button
              type="button"
              onClick={() => setMode("video")}
              className={`rounded-md px-3 py-1 text-[9px] font-black uppercase tracking-wider transition ${
                mode === "video" ? "bg-cyan-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              {copy.videoBtn}
            </button>
            <button
              type="button"
              onClick={() => setMode("interactive")}
              className={`rounded-md px-3 py-1 text-[9px] font-black uppercase tracking-wider transition ${
                mode === "interactive" ? "bg-cyan-400 text-slate-950 shadow-md" : "text-slate-400 hover:text-white"
              }`}
            >
              {copy.demoBtn}
            </button>
          </div>
        </div>

        <div className="institutional-video-frame relative aspect-video min-h-[260px] overflow-hidden bg-slate-950">
          <AnimatePresence mode="wait">
            {mode === "video" ? (
              <motion.div
                key="video-player"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 h-full w-full"
              >
                <video
                  key={video.src}
                  className="h-full w-full object-cover"
                  controls
                  preload="metadata"
                  playsInline
                  controlsList="nodownload"
                  onTimeUpdate={handleTimeUpdate}
                  data-video-locale={video.locale}
                  data-video-target={video.futureSrc}
                >
                  <source src={video.src} type={video.type} />
                </video>
                <FilmSubtitle subtitle={activeVideoSubtitle} />
                <span className="institutional-video-watermark">nexID</span>
              </motion.div>
            ) : (
              <motion.div
                key="cinematic-simulator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 h-full w-full"
              >
                <CinematicTapSimulator locale={activeLocale} />
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

function CinematicTapSimulator({ locale }: { locale: SupportedLocale }) {
  const [step, setStep] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const t = SIMULATOR_COPY[locale];

  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => setStep(2), 2200);
      return () => clearTimeout(timer);
    }
    if (step === 2) {
      const timer = setTimeout(() => setStep(3), 3500);
      return () => clearTimeout(timer);
    }
    if (step === 3) {
      const timer = setTimeout(() => setStep(4), 3800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  const handleStart = () => {
    setIsMuted(false);
    setStep(1);
  };

  const subtitle = step > 0 ? t.subtitles[step as 1 | 2 | 3 | 4] : null;

  return (
    <div className="pointer-events-auto relative flex h-full w-full select-none flex-col justify-between overflow-hidden bg-slate-950 p-3 font-sans">
      <SimulatorMediaLayer step={step} isMuted={isMuted} />

      <div className="z-10 flex items-center justify-between rounded border-b border-white/10 bg-slate-950/40 px-2 pb-2 font-mono text-[10px] text-slate-300 backdrop-blur-sm">
        <span className="flex items-center gap-1.5 font-bold">
          <span className={`h-1.5 w-1.5 rounded-full ${step === 4 ? "bg-emerald-400" : step > 0 ? "bg-cyan-400" : "bg-slate-500"} animate-pulse`} />
          {STATUS_BY_STEP[step]}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-bold opacity-80">UID: 04E1D4A7F392B1</span>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              className="flex items-center justify-center rounded p-1 hover:bg-white/10 active:scale-95 transition"
              aria-label={isMuted ? "Unmute sound" : "Mute sound"}
            >
              {isMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
              )}
            </button>
          )}
        </div>
      </div>

      {step === 0 ? <IntroState copy={t} /> : <div className="z-10 flex-1" />}

      <AnimatePresence>
        {step === 4 ? <GiftVoucher key="gift-voucher" copy={t} onReset={() => setStep(0)} /> : null}
      </AnimatePresence>

      <FilmSubtitle subtitle={subtitle} />

      {step < 4 ? (
        <>
          <StepStatus step={step} copy={t} />
          <SimulatorActions step={step} copy={t} onStart={handleStart} onReset={() => setStep(0)} />
        </>
      ) : null}
    </div>
  );
}

function SimulatorMediaLayer({ step, isMuted }: { step: number; isMuted: boolean }) {
  return (
    <div className="absolute inset-0 z-0 h-full w-full overflow-hidden">
      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="storyboard-cover" initial={{ opacity: 0 }} animate={{ opacity: 0.95 }} exit={{ opacity: 0 }} className="relative h-full w-full">
            <img src="/images/visual_storyboard.jpeg" alt="Storyboards nexID" className="h-full w-full object-cover brightness-[0.4]" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </motion.div>
        ) : null}

        {step === 1 ? (
          <motion.div
            key="tap-video"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative h-full w-full"
          >
            <video className="h-full w-full object-cover filter brightness-[0.85]" autoPlay loop muted={isMuted} playsInline>
              <source src="/video/Hand_holding_smartphone_touching.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/10 to-transparent" />
          </motion.div>
        ) : null}

        {step === 2 ? <VideoScene key="step-chip-video" src="/video/3D_render_NTAG_424_DNA.mp4" brightness="brightness-[0.85]" muted={isMuted} /> : null}
        {step === 3 ? <VideoScene key="step-passport-video" src="/video/Smartphone_screen_nexID_web_interface.mp4" brightness="brightness-[0.85]" muted={isMuted} /> : null}
        {step === 4 ? <VideoScene key="step-glasses-video" src="/video/Man_and_woman_clinking_glasses.mp4" brightness="brightness-[0.5]" overlay="via-slate-950/30" muted={isMuted} /> : null}
      </AnimatePresence>
    </div>
  );
}

function VideoScene({ src, brightness, overlay = "via-slate-950/10", muted = true }: { src: string; brightness: string; overlay?: string; muted?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative h-full w-full">
      <video className={`h-full w-full object-cover ${brightness}`} autoPlay loop muted={muted} playsInline>
        <source src={src} type="video/mp4" />
      </video>
      <div className={`absolute inset-0 bg-gradient-to-t from-slate-950 ${overlay} to-transparent`} />
    </motion.div>
  );
}

function IntroState({ copy }: { copy: SimulatorCopy }) {
  return (
    <div className="z-10 flex flex-1 flex-col items-center justify-center p-4 text-center">
      <div className="mb-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 p-3 animate-pulse">
        <Zap className="h-6 w-6 text-cyan-400" />
      </div>
      <h3 className="text-sm font-black uppercase leading-none tracking-wide text-white">nexID Experience</h3>
      <p className="mt-1.5 max-w-sm text-[10px] text-slate-300">{copy.step0Desc}</p>
    </div>
  );
}

function GiftVoucher({ copy, onReset }: { copy: SimulatorCopy; onReset: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ delay: 0.35, duration: 0.48, type: "spring", damping: 16 }}
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center p-3"
    >
      <div className="relative flex w-full max-w-sm max-h-[92%] flex-col justify-between overflow-hidden rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-3 shadow-[0_0_25px_rgba(34,211,238,0.25)] backdrop-blur-md">
        {/* Ticket jagged edge circles (cuts) */}
        <div className="absolute -left-3 top-[55%] z-10 h-6 w-6 -translate-y-1/2 rounded-full border-r border-cyan-500/30 bg-slate-950" />
        <div className="absolute -right-3 top-[55%] z-10 h-6 w-6 -translate-y-1/2 rounded-full border-l border-cyan-500/30 bg-slate-950" />

        {/* Ticket Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="flex h-4 w-4 items-center justify-center rounded border border-cyan-400/30 bg-cyan-400/10 text-[9px] font-bold text-cyan-300">N</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-white">nexID Marketplace</span>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-emerald-400">
            {copy.voucherTitle}
          </span>
        </div>

        {/* Voucher Main Info */}
        <div className="my-1.5 text-center">
          <div className="mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.12)]">
            <Award className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <h4 className="text-xs font-black uppercase leading-snug tracking-wider text-white">{copy.voucherSubtitle}</h4>
          <p className="mx-auto mt-0.5 max-w-[270px] text-[8.5px] leading-normal text-slate-300">{copy.voucherDesc}</p>
        </div>

        {/* Barcode / Coupon details & Actions */}
        <div className="flex flex-col items-center border-t border-dashed border-white/20 pt-1.5">
          <div className="mb-1.5 flex w-full justify-between gap-0.5 opacity-20">
            {TICKET_DOTS.map((dot) => (
              <span key={dot} className="h-0.5 w-1 rounded-full bg-white" />
            ))}
          </div>
          <div className="mb-1 flex h-4 w-40 items-center justify-between bg-transparent px-2 opacity-80" aria-hidden="true">
            {BARCODE_BARS.map((bar, index) => (
              <div key={index} className="h-full bg-cyan-400" style={bar} />
            ))}
          </div>
          <span className="font-mono text-[8px] font-bold tracking-wider text-cyan-300">{copy.voucherCode}</span>
          <span className="mt-0.5 font-mono text-[7px] text-slate-400">{copy.voucherStatus}</span>
          
          <div className="mt-3.5 flex w-full gap-2">
            <Link
              href="/login?next=/me"
              className="flex-1 rounded-xl bg-emerald-500 py-1.5 text-center text-[10px] font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400"
            >
              {copy.voucherClaim}
            </Link>
            <button
              type="button"
              onClick={onReset}
              className="flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:bg-white/10"
            >
              <RefreshCw className="h-3 w-3" />
              {copy.resetBtn}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function FilmSubtitle({ subtitle }: { subtitle: string | null }) {
  if (!subtitle) return null;

  return (
    <div className="pointer-events-none absolute bottom-16 left-1/2 z-20 w-[90%] -translate-x-1/2 text-center" aria-live="polite">
      <AnimatePresence mode="wait">
        <motion.div
          key={subtitle}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.28 }}
          className="inline-block max-w-full rounded-lg border border-white/10 bg-black/85 px-3 py-1.5 text-[9.5px] font-semibold leading-normal text-white shadow-2xl backdrop-blur-sm md:text-[11px]"
        >
          {subtitle}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StepStatus({ step, copy }: { step: number; copy: SimulatorCopy }) {
  return (
    <div className="z-10 flex min-h-[38px] flex-col justify-center rounded-xl border border-white/5 bg-slate-950/70 p-2 px-4 text-center shadow-2xl backdrop-blur">
      <AnimatePresence mode="wait">
        <motion.div
          key={`desc-${step}`}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          className="text-[9.5px] leading-snug"
        >
          {step === 0 ? <p className="text-slate-300">{copy.step0Desc}</p> : null}
          {step === 1 ? <p className="font-bold text-cyan-300">{copy.scanning}</p> : null}
          {step === 2 ? <p className="font-semibold text-amber-300">{copy.verifying}</p> : null}
          {step === 3 ? (
            <p className="font-semibold text-cyan-200">
              {copy.verified} / {copy.provenance}
            </p>
          ) : null}
          {step === 4 ? (
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-300">
                {copy.verified} / {copy.provenance}
              </p>
              <p className="mt-0.5 animate-pulse text-[9px] font-bold text-cyan-300">{copy.points}</p>
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SimulatorActions({
  step,
  copy,
  onStart,
  onReset,
}: {
  step: number;
  copy: SimulatorCopy;
  onStart: () => void;
  onReset: () => void;
}) {
  return (
    <div className="z-20 mt-2.5 flex justify-center gap-2">
      {step === 0 ? (
        <button
          type="button"
          onClick={onStart}
          className="flex items-center gap-1.5 rounded-xl bg-cyan-400 px-6 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-[0_4px_16px_rgba(34,211,238,0.3)] transition-all hover:scale-[1.01] hover:bg-cyan-300 active:scale-95"
        >
          <Zap className="h-3.5 w-3.5" />
          {copy.startBtn}
        </button>
      ) : null}

      {step > 0 && step < 4 ? (
        <div className="flex animate-pulse items-center gap-2 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-1.5 font-mono text-[9px] text-slate-300 backdrop-blur-sm">
          <Cpu className="h-3.5 w-3.5 animate-spin text-cyan-400" />
          {step === 1 ? copy.scanning : copy.verifying}
        </div>
      ) : null}

      {step === 4 ? (
        <div className="flex gap-2">
          <Link
            href="/login?next=/me"
            className="rounded-xl bg-emerald-500 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-slate-950 transition hover:bg-emerald-400"
          >
            {copy.voucherClaim}
          </Link>
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-950/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white backdrop-blur-sm transition hover:scale-[1.01] hover:bg-white/10 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {copy.resetBtn}
          </button>
        </div>
      ) : null}
    </div>
  );
}
