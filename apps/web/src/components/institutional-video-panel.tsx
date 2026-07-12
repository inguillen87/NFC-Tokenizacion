"use client";

import React from "react";
import Link from "next/link";
import { Play, Calendar, Zap } from "lucide-react";
import { schedulingUrls } from "@product/config";
import { resolveInstitutionalVideo } from "../lib/institutional-video";

type InstitutionalVideoPanelProps = {
  locale: string;
  variant?: "landing" | "demo";
  className?: string;
  initialTheme?: "light" | "dark";
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
};

const PANEL_COPY: Record<SupportedLocale, PanelCopy> = {
  "es-AR": {
    eyebrow: "Video Institucional",
    title: "La capa de confianza para productos reales.",
    body: "Descubrí cómo nexID conecta tus productos físicos con el ecosistema digital mediante tecnología NFC criptográfica. Autenticidad, trazabilidad y beneficios con un simple toque.",
    primary: "Abrir Demo Lab",
    secondary: "Agendar reunión",
    aria: "video institucional nexID",
    strip: "Producto físico -> toque confiable -> pasaporte digital -> señal CRM",
  },
  en: {
    eyebrow: "Institutional Video",
    title: "The trust layer for real products.",
    body: "Discover how nexID bridges your physical products with the digital ecosystem using cryptographic NFC technology. Authenticity, traceability, and benefits with a simple tap.",
    primary: "Open Demo Lab",
    secondary: "Schedule meeting",
    aria: "nexID institutional video",
    strip: "Physical product -> trusted tap -> digital passport -> CRM signal",
  },
  "pt-BR": {
    eyebrow: "Vídeo Institucional",
    title: "A camada de confiança para produtos reais.",
    body: "Descubra como nexID conecta seus produtos físicos com o ecossistema digital usando tecnologia NFC criptográfica. Autenticidade, rastreabilidade e benefícios com um simples toque.",
    primary: "Abrir Demo Lab",
    secondary: "Agendar reunião",
    aria: "vídeo institucional nexID",
    strip: "Produto físico -> toque confiável -> pasaporte digital -> sinal CRM",
  },
};

function normalizeLocale(locale: string): SupportedLocale {
  if (locale === "en") return "en";
  if (locale === "pt-BR") return "pt-BR";
  return "es-AR";
}

function readIsLightTheme() {
  if (typeof document === "undefined") return false;
  const root = document.documentElement;
  return root.classList.contains("theme-light") || root.getAttribute("data-theme") === "light";
}

export function InstitutionalVideoPanel({ locale, variant = "landing", className = "", initialTheme = "dark" }: InstitutionalVideoPanelProps) {
  const activeLocale = normalizeLocale(locale);
  const video = resolveInstitutionalVideo(locale);
  const copy = PANEL_COPY[activeLocale];
  const panelRef = React.useRef<HTMLElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isLightTheme, setIsLightTheme] = React.useState(initialTheme === "light");
  const [isNearViewport, setIsNearViewport] = React.useState(false);
  const [isPosterReady, setIsPosterReady] = React.useState(false);
  const [mediaRequested, setMediaRequested] = React.useState(false);
  const [hasStarted, setHasStarted] = React.useState(false);
  const [isAtStart, setIsAtStart] = React.useState(true);

  React.useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsLightTheme(readIsLightTheme());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const target = panelRef.current;
    if (!target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "360px 0px", threshold: 0.01 },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const poster = isLightTheme ? video.lightPoster : video.poster;
  const showLightPreview = isLightTheme && (!hasStarted || isAtStart);
  const showPlayOverlay = !hasStarted || isAtStart;

  React.useEffect(() => {
    if (!isNearViewport || isLightTheme || isPosterReady) return;

    let cancelled = false;
    const image = new Image();
    const markReady = () => {
      if (!cancelled) setIsPosterReady(true);
    };

    image.decoding = "async";
    image.onload = markReady;
    image.src = poster;

    if (image.complete && image.naturalWidth > 0) markReady();

    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [isLightTheme, isNearViewport, isPosterReady, poster]);

  React.useEffect(() => {
    setMediaRequested(false);
    setIsPosterReady(false);
    setHasStarted(false);
    setIsAtStart(true);
  }, [video.src, poster]);

  const playVideo = () => {
    const target = videoRef.current;
    if (!target) return;

    setMediaRequested(true);
    target.src = video.src;
    target.preload = "metadata";
    target.load();

    const revealVideo = () => {
      setHasStarted(true);
      setIsAtStart(false);
    };

    const resetVideo = () => {
      target.pause();
      target.currentTime = 0;
      target.removeAttribute("src");
      target.load();
      setMediaRequested(false);
      setHasStarted(false);
      setIsAtStart(true);
    };

    window.requestAnimationFrame(() => {
      const playPromise = target.play();

      if (playPromise && typeof playPromise.then === "function") {
        void playPromise
          .then(revealVideo)
          .catch(() => {
            target.muted = true;
            const mutedPromise = target.play();

            if (mutedPromise && typeof mutedPromise.then === "function") {
              void mutedPromise.then(revealVideo).catch(resetVideo);
              return;
            }

            revealVideo();
          });
        return;
      }

      revealVideo();
    });
  };

  return (
    <section
      ref={panelRef}
      className={`institutional-video-panel institutional-video-panel--${variant} ${
        showLightPreview ? "institutional-video-panel--light-preview" : ""
      } ${className}`}
      aria-label={copy.aria}
    >
      <div className="institutional-video-copy">
        <p className="text-cyan-400 font-mono tracking-widest uppercase text-xs">{copy.eyebrow}</p>
        <h2>{copy.title}</h2>
        <span>{copy.body}</span>
        <div className="institutional-video-actions">
          <Link href="/demo-lab" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            {copy.primary}
          </Link>
          <a href={schedulingUrls.meeting} target="_blank" rel="noreferrer" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {copy.secondary}
          </a>
        </div>
      </div>

      <div className="institutional-video-device">
        <div className="institutional-video-topbar flex w-full items-center justify-between border-b border-white/5 bg-slate-950/60 px-4 py-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5">
            <span className="institutional-video-mark flex items-center justify-center font-bold text-cyan-300">N</span>
            <strong className="text-xs font-bold tracking-wider text-white">
              nex<span className="text-cyan-400">ID</span>
            </strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
            <span className="text-[9px] font-mono font-bold tracking-wider text-cyan-400 uppercase">OFFICIAL MEDIA</span>
          </div>
        </div>

        <div
          className={`institutional-video-frame relative aspect-video min-h-[260px] overflow-hidden bg-slate-950 ${
            showLightPreview ? "institutional-video-frame--light-preview" : ""
          }`}
        >
          <video
            ref={videoRef}
            key={`${video.src}-${poster}`}
            className={`institutional-video-media h-full w-full object-cover ${
              isLightTheme ? "institutional-video-media--light" : ""
            } ${showLightPreview ? "institutional-video-media--parked" : ""}`}
            controls={hasStarted && !isAtStart}
            onPlay={() => {
              setHasStarted(true);
              setIsAtStart(false);
            }}
            onPause={(event) => {
              if (isLightTheme && event.currentTarget.currentTime <= 0.35) {
                setIsAtStart(true);
                setHasStarted(false);
              }
            }}
            onSeeked={(event) => {
              if (isLightTheme && event.currentTarget.paused && event.currentTarget.currentTime <= 0.35) {
                setIsAtStart(true);
                setHasStarted(false);
              } else {
                setIsAtStart(false);
              }
            }}
            onLoadedMetadata={(event) => {
              if (isLightTheme && event.currentTarget.paused && event.currentTarget.currentTime <= 0.35) {
                setIsAtStart(true);
                setHasStarted(false);
              }
            }}
            onError={(event) => {
              event.currentTarget.currentTime = 0;
              setMediaRequested(false);
              setIsAtStart(true);
              setHasStarted(false);
            }}
            onEnded={() => {
              setIsAtStart(true);
              setHasStarted(false);
            }}
            src={mediaRequested ? video.src : undefined}
            preload={mediaRequested ? "metadata" : "none"}
            playsInline
            controlsList="nodownload"
            poster={isPosterReady && !isLightTheme ? poster : undefined}
            tabIndex={showPlayOverlay ? -1 : undefined}
          />
          {!isLightTheme && !isPosterReady && showPlayOverlay ? (
            <div
              className="institutional-video-deferred-preview absolute inset-0 z-[1] flex flex-col justify-center gap-3 bg-slate-950 px-6 py-8 text-left"
              aria-hidden="true"
            >
              <div className="flex items-center gap-3 text-cyan-300">
                <span className="institutional-video-mark flex items-center justify-center font-bold">N</span>
                <span className="font-mono text-[10px] font-bold uppercase text-cyan-300">nexID institutional media</span>
              </div>
              <strong className="max-w-md text-xl font-bold text-white sm:text-2xl">{copy.title}</strong>
              <span className="max-w-lg text-xs leading-5 text-slate-300">{copy.strip}</span>
            </div>
          ) : null}
          {showLightPreview ? (
            <div className="institutional-video-light-preview" aria-hidden="true">
              <div className="institutional-video-light-preview__scene">
                <div className="institutional-video-light-preview__chip">
                  <span>N</span>
                </div>
                <div className="institutional-video-light-preview__signal">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
              <div>
                <strong>{copy.title}</strong>
                <p>{copy.strip}</p>
              </div>
            </div>
          ) : null}
          {showPlayOverlay ? (
            <button className="institutional-video-play" type="button" onClick={playVideo} aria-label={copy.aria}>
              <Play className="h-5 w-5" />
              <span>{copy.eyebrow}</span>
            </button>
          ) : null}
          <span className="institutional-video-watermark font-bold tracking-wider opacity-60">nexID</span>
        </div>

        <div className="institutional-video-strip">
          <span>{copy.strip}</span>
          <i />
        </div>
      </div>
    </section>
  );
}
