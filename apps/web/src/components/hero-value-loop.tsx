"use client";

import { useEffect, useRef, useState } from "react";
import { LazyMotion, domAnimation, m, useReducedMotion } from "framer-motion";
import { BadgeCheck, BarChart3, PackageCheck, Pause, Play, Smartphone } from "lucide-react";
import styles from "./hero-value-loop.module.css";

type HeroValueLoopProps = {
  locale: string;
};

type Stage = {
  readonly id: string;
  readonly short: string;
  readonly title: string;
  readonly body: string;
  readonly result: string;
};

const COPY = {
  "es-AR": {
    eyebrow: "Del producto a la próxima acción",
    title: "Un toque abre una relación que continúa.",
    demo: "RECORRIDO ILUSTRATIVO",
    product: "Producto conectado",
    tag: "NFC + QR",
    phone: "Experiencia sin app",
    resultLabel: "Resultado para tu marca",
    controls: "Elegí una etapa",
    pause: "Pausar recorrido",
    resume: "Reanudar recorrido",
    motionOff: "Movimiento reducido activo",
    note: "La etiqueta digital inicia la experiencia; cada control físico requiere evidencia adicional.",
    stages: [
      { id: "discover", short: "Conocer", title: "El cliente entiende qué compró", body: "Historia, lote e información elegida por la marca, en una pantalla clara.", result: "Más valor percibido" },
      { id: "activate", short: "Activar", title: "La postventa aparece en el momento justo", body: "Garantía, beneficios y atención quedan a un toque de distancia.", result: "Más relación directa" },
      { id: "learn", short: "Aprender", title: "Cada interacción deja una señal útil", body: "Medí lecturas y acciones para mejorar el próximo piloto.", result: "Mejores decisiones" },
    ],
  },
  "pt-BR": {
    eyebrow: "Do produto para a próxima ação",
    title: "Um toque abre uma relação que continua.",
    demo: "JORNADA ILUSTRATIVA",
    product: "Produto conectado",
    tag: "NFC + QR",
    phone: "Experiência sem app",
    resultLabel: "Resultado para sua marca",
    controls: "Escolha uma etapa",
    pause: "Pausar jornada",
    resume: "Retomar jornada",
    motionOff: "Movimento reduzido ativo",
    note: "A etiqueta digital inicia a experiência; cada controle físico exige evidência adicional.",
    stages: [
      { id: "discover", short: "Conhecer", title: "O cliente entende o que comprou", body: "História, lote e informações escolhidas pela marca, em uma tela clara.", result: "Mais valor percebido" },
      { id: "activate", short: "Ativar", title: "O pós-venda aparece na hora certa", body: "Garantia, benefícios e atendimento ficam a um toque de distância.", result: "Mais relação direta" },
      { id: "learn", short: "Aprender", title: "Cada interação deixa um sinal útil", body: "Meça leituras e ações para melhorar o próximo piloto.", result: "Melhores decisões" },
    ],
  },
  en: {
    eyebrow: "From product to next action",
    title: "One tap opens a relationship that keeps going.",
    demo: "ILLUSTRATIVE JOURNEY",
    product: "Connected product",
    tag: "NFC + QR",
    phone: "No-app experience",
    resultLabel: "Outcome for your brand",
    controls: "Choose a stage",
    pause: "Pause journey",
    resume: "Resume journey",
    motionOff: "Reduced motion is active",
    note: "The digital tag starts the experience; every physical control requires additional evidence.",
    stages: [
      { id: "discover", short: "Discover", title: "Customers understand what they bought", body: "Story, batch and brand-selected information in one clear screen.", result: "More perceived value" },
      { id: "activate", short: "Activate", title: "After-sales appears at the right moment", body: "Warranty, benefits and support stay one tap away.", result: "A stronger direct relationship" },
      { id: "learn", short: "Learn", title: "Every interaction leaves a useful signal", body: "Measure readings and actions to improve the next pilot.", result: "Better decisions" },
    ],
  },
} as const;

const stageIcons = [PackageCheck, BadgeCheck, BarChart3] as const;

export function HeroValueLoop({ locale }: HeroValueLoopProps) {
  const normalizedLocale = locale === "en" || locale === "pt-BR" ? locale : "es-AR";
  const copy = COPY[normalizedLocale];
  const [activeIndex, setActiveIndex] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const activeStage: Stage = copy.stages[activeIndex] ?? copy.stages[0];
  const ActiveIcon = stageIcons[activeIndex] ?? PackageCheck;
  const motionEnabled = mounted && !reduceMotion;
  const isAutoAdvancing = autoAdvance && motionEnabled;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(Boolean(entry?.isIntersecting)), {
      rootMargin: "120px 0px",
      threshold: 0.15,
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibility = () => setPageVisible(!document.hidden);
    handleVisibility();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!isAutoAdvancing || !inView || !pageVisible) return;
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % copy.stages.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [copy.stages.length, inView, isAutoAdvancing, pageVisible]);

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.header}>
        <div>
          <p>{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <span>{copy.demo}</span>
      </div>

      <LazyMotion features={domAnimation}>
        <div className={styles.scene} aria-hidden="true">
          <m.div className={styles.product} animate={motionEnabled ? { y: [0, -4, 0] } : undefined} transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}>
            <span className={styles.productIcon}><PackageCheck /></span>
            <strong>{copy.product}</strong>
            <small>{copy.tag}</small>
          </m.div>

          <div className={styles.signal}>
            <m.span animate={motionEnabled ? { x: [0, 44], opacity: [0, 1, 0] } : undefined} transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }} />
          </div>

          <div className={styles.phone}>
            <div className={styles.phoneTop}><Smartphone /><span>{copy.phone}</span></div>
            <m.div
              key={activeStage.id}
              className={styles.phoneResult}
              initial={motionEnabled ? { opacity: 0, y: 8, scale: 0.98 } : false}
              animate={motionEnabled ? { opacity: 1, y: 0, scale: 1 } : undefined}
              transition={{ duration: 0.36, ease: "easeOut" }}
            >
              <span className={styles.resultIcon}><ActiveIcon /></span>
              <strong>{activeStage.title}</strong>
              <p>{activeStage.body}</p>
            </m.div>
          </div>
        </div>

        <m.div
          key={`${activeStage.id}-outcome`}
          className={styles.outcome}
          initial={motionEnabled ? { opacity: 0, y: 5 } : false}
          animate={motionEnabled ? { opacity: 1, y: 0 } : undefined}
          transition={{ duration: 0.28 }}
        >
          <span>{copy.resultLabel}</span>
          <strong>{activeStage.result}</strong>
        </m.div>
      </LazyMotion>

      <div className={styles.controls} role="group" aria-label={copy.controls}>
        {copy.stages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            aria-pressed={activeIndex === index}
            aria-label={`${stage.short}. ${stage.title}. ${stage.body} ${copy.resultLabel}: ${stage.result}.`}
            onClick={() => {
              setActiveIndex(index);
              setAutoAdvance(false);
            }}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {stage.short}
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.playback}
        disabled={!motionEnabled}
        onClick={() => setAutoAdvance((current) => !current)}
      >
        {isAutoAdvancing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        <span>{!mounted ? copy.resume : reduceMotion ? copy.motionOff : isAutoAdvancing ? copy.pause : copy.resume}</span>
      </button>
      <p className={styles.note}>{copy.note}</p>
    </div>
  );
}
