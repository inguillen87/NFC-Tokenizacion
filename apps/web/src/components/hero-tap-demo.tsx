"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Nfc, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import styles from "./home-enhancements.module.css";

type TapLocale = "es-AR" | "en" | "pt-BR";
type TapPhase = "idle" | "reading" | "open";

const READING_MS = 900;

const COPY: Record<TapLocale, {
  trigger: string;
  reading: string;
  scope: string;
  title: string;
  steps: [string, string, string];
  boundary: string;
  open: string;
  close: string;
  again: string;
  announceReading: string;
  announceOpen: string;
}> = {
  "es-AR": {
    trigger: "Simular un tap",
    reading: "Leyendo la etiqueta",
    scope: "Demo · datos de ejemplo",
    title: "Pasaporte de muestra",
    steps: ["Etiqueta leída desde el celular", "Registro comprobado digitalmente", "Información publicada por la marca"],
    boundary: "La comprobación digital no certifica por sí sola el producto físico.",
    open: "Ver un pasaporte completo",
    close: "Cerrar el pasaporte de muestra",
    again: "Repetir el tap",
    announceReading: "Leyendo la etiqueta de muestra.",
    announceOpen: "Pasaporte de muestra disponible.",
  },
  en: {
    trigger: "Simulate a tap",
    reading: "Reading the tag",
    scope: "Demo · sample data",
    title: "Sample passport",
    steps: ["Tag read from the phone", "Record checked digitally", "Information published by the brand"],
    boundary: "A digital check does not certify the physical product on its own.",
    open: "See a complete passport",
    close: "Close the sample passport",
    again: "Tap again",
    announceReading: "Reading the sample tag.",
    announceOpen: "Sample passport available.",
  },
  "pt-BR": {
    trigger: "Simular um toque",
    reading: "Lendo a etiqueta",
    scope: "Demo · dados de exemplo",
    title: "Passaporte de amostra",
    steps: ["Etiqueta lida pelo celular", "Registro conferido digitalmente", "Informação publicada pela marca"],
    boundary: "A conferência digital não certifica sozinha o produto físico.",
    open: "Ver um passaporte completo",
    close: "Fechar o passaporte de amostra",
    again: "Repetir o toque",
    announceReading: "Lendo a etiqueta de amostra.",
    announceOpen: "Passaporte de amostra disponível.",
  },
};

function normalizeLocale(locale: string): TapLocale {
  return locale === "en" || locale === "pt-BR" ? locale : "es-AR";
}

// An illustrative tap for the landing hero. It never calls the API and never
// claims a validation result: the card is labelled as sample data and links to
// the real guided demo for the complete passport.
export function HeroTapDemo({ locale }: { locale: string }) {
  const copy = COPY[normalizeLocale(locale)];
  const [phase, setPhase] = useState<TapPhase>("idle");
  const reducedMotion = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const close = useCallback((restoreFocus: boolean) => {
    clearTimer();
    setPhase("idle");
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
  }, [clearTimer]);

  const tap = useCallback(() => {
    clearTimer();
    if (phase === "open") {
      close(false);
      return;
    }
    if (reducedMotion) {
      setPhase("open");
      return;
    }
    setPhase("reading");
    timer.current = setTimeout(() => setPhase("open"), READING_MS);
  }, [clearTimer, close, phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "open") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, phase]);

  const spring = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 320, damping: 28, mass: 0.9 };

  return (
    <div className={styles.tap} data-tap-phase={phase}>
      <p className={styles.srOnly} role="status" aria-live="polite">
        {phase === "reading" ? copy.announceReading : phase === "open" ? copy.announceOpen : ""}
      </p>

      <AnimatePresence>
        {phase === "open" ? (
          <motion.section
            key="passport"
            id={panelId}
            className={styles.tapCard}
            aria-label={copy.title}
            initial={{ opacity: 0, y: 18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
            transition={spring}
          >
            <header className={styles.tapCardHeader}>
              <span className={styles.tapScope}>{copy.scope}</span>
              <button type="button" className={styles.tapClose} onClick={() => close(true)} aria-label={copy.close}>
                <X size={16} aria-hidden="true" />
              </button>
            </header>
            <strong className={styles.tapTitle}>{copy.title}</strong>
            <ol className={styles.tapSteps}>
              {copy.steps.map((step, index) => (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { delay: 0.12 + index * 0.09, duration: 0.28 }}
                >
                  <span aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
                  {step}
                </motion.li>
              ))}
            </ol>
            <p className={styles.tapBoundary}>{copy.boundary}</p>
            <Link href="/demo-lab" prefetch={false} className={styles.tapLink} data-demo-entry="hero-tap">
              {copy.open}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        className={styles.tapTrigger}
        onClick={tap}
        aria-expanded={phase === "open"}
        aria-controls={phase === "open" ? panelId : undefined}
        aria-busy={phase === "reading"}
      >
        <span className={styles.tapTriggerIcon} aria-hidden="true">
          <Nfc size={18} />
        </span>
        <span>{phase === "reading" ? copy.reading : phase === "open" ? copy.again : copy.trigger}</span>
      </button>
    </div>
  );
}
