"use client";

import { useEffect, useRef, useState } from "react";

type SupportedLocale = "es-AR" | "en" | "pt-BR";

const SIGNAL_COPY: Record<SupportedLocale, { detected: string; ready: string; device: string; product: string }> = {
  "es-AR": {
    detected: "Etiqueta vinculada",
    ready: "Pasaporte disponible",
    device: "Celular · Pasaporte Digital",
    product: "Packaging · NFC",
  },
  en: {
    detected: "Tag linked",
    ready: "Passport available",
    device: "Phone · Digital Passport",
    product: "Packaging · NFC",
  },
  "pt-BR": {
    detected: "Etiqueta vinculada",
    ready: "Passaporte disponível",
    device: "Celular · Passaporte Digital",
    product: "Embalagem · NFC",
  },
};

function normalizeLocale(locale: string): SupportedLocale {
  if (locale === "en" || locale === "pt-BR") return locale;
  return "es-AR";
}

export function HeroImmersiveSignal({ locale }: { locale: string }) {
  const signalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const copy = SIGNAL_COPY[normalizeLocale(locale)];

  useEffect(() => {
    const signal = signalRef.current;
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncEnvironment = () => {
      setPageVisible(!document.hidden);
      setReducedMotion(reducedMotionQuery.matches);
    };
    const handleVisibilityChange = () => setPageVisible(!document.hidden);
    const handleReducedMotionChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);

    setMounted(true);
    syncEnvironment();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    if (!signal || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return () => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.18)),
      { rootMargin: "32px 0px", threshold: [0, 0.18, 0.45] },
    );

    observer.observe(signal);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotionQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  const motionMode = !mounted ? "pending" : reducedMotion ? "reduced" : "ready";
  const motionActive = mounted && !reducedMotion && pageVisible && inView;

  return (
    <div
      ref={signalRef}
      className="hero-immersive-signal"
      data-motion-mode={motionMode}
      data-motion-active={motionActive ? "true" : "false"}
      aria-hidden="true"
    >
      <span className="hero-immersive-object-label hero-immersive-object-label--device" data-hero-object="device">
        <small>01</small>
        <strong>{copy.device}</strong>
      </span>
      <span className="hero-immersive-object-label hero-immersive-object-label--product" data-hero-object="product">
        <small>02</small>
        <strong>{copy.product}</strong>
      </span>

      <div className="hero-immersive-link-stage">
        <svg
          className="hero-immersive-link-diagram"
          viewBox="0 0 360 120"
          preserveAspectRatio="none"
          focusable="false"
        >
          <defs>
            <linearGradient id="hero-signal-spectrum" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#06b6d4" />
              <stop offset="0.48" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#10b981" />
            </linearGradient>
          </defs>
          <path className="hero-immersive-link-halo" d="M48 61C126 42 228 42 312 61" pathLength="1" />
          <path className="hero-immersive-link-core" data-signal-role="request" d="M48 61C126 42 228 42 312 61" pathLength="1" />
          <path className="hero-immersive-link-spectrum" data-signal-role="response" d="M48 68C128 50 226 50 312 68" pathLength="1" />

          <path className="hero-immersive-wave hero-immersive-wave--one" d="M66 48c16 7 16 19 0 26" pathLength="1" />
          <path className="hero-immersive-wave hero-immersive-wave--two" d="M80 38c28 12 28 34 0 46" pathLength="1" />
          <path className="hero-immersive-wave hero-immersive-wave--three" d="M96 27c40 17 40 51 0 68" pathLength="1" />

          <path className="hero-immersive-wave hero-immersive-wave--target-one" d="M294 48c-16 7-16 19 0 26" pathLength="1" />
          <path className="hero-immersive-wave hero-immersive-wave--target-two" d="M280 38c-28 12-28 34 0 46" pathLength="1" />

          <circle className="hero-immersive-node hero-immersive-node--device" cx="48" cy="61" r="4" />
          <circle className="hero-immersive-node hero-immersive-node--tag" cx="312" cy="61" r="5" />
        </svg>

        <span className="hero-immersive-packet hero-immersive-packet--one" data-signal-packet="identity" />
        <span className="hero-immersive-packet hero-immersive-packet--two" data-signal-packet="passport" />
        <span className="hero-immersive-packet hero-immersive-packet--three" data-signal-packet="traceability" />
        <span className="hero-immersive-packet hero-immersive-packet--return" data-signal-packet="response" />
      </div>

      <span className="hero-immersive-ring hero-immersive-ring--one" />
      <span className="hero-immersive-ring hero-immersive-ring--two" />
      <span className="hero-immersive-ring hero-immersive-ring--three" />

      <div className="hero-immersive-status">
        <span className="hero-immersive-status__icon">
          <i />
          NFC
        </span>
        <span className="hero-immersive-status__copy">
          <small>{copy.detected}</small>
          <strong>{copy.ready}</strong>
        </span>
        <span className="hero-immersive-status__meter"><i /></span>
      </div>
    </div>
  );
}
