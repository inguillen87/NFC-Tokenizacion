"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, Nfc, Pause, Play } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import type {
  HomeFlowCopy,
  HomeHeroSector,
  HomeMotionCopy,
  HomeRolesCopy,
} from "./home-copy";
import styles from "./nexid-home-v4.module.css";

const HERO_ROTATION_MS = 5_800;
const PROCESS_STEP_MS = 1_650;
const NexidOperationsPreview = dynamic(
  () => import("./nexid-operations-preview").then((module) => module.NexidOperationsPreview),
  { ssr: false },
);
const DEMO_VERTICAL_BY_SECTOR: Record<HomeHeroSector["id"], string> = {
  agro: "seeds",
  pharma: "pharma",
  wine: "wine",
  premium: "sneaker",
};

type HeroExperienceProps = {
  sectors: HomeHeroSector[];
  sectorsLabel: string;
  rotationLabel: string;
  pauseRotation: string;
  resumeRotation: string;
  demoLabel: string;
};

function usePageVisibility() {
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const onVisibilityChange = () => setPageVisible(document.visibilityState === "visible");
    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return pageVisible;
}

export function NexidHeroExperience({
  sectors,
  sectorsLabel,
  rotationLabel,
  pauseRotation,
  resumeRotation,
  demoLabel,
}: HeroExperienceProps) {
  const groupLabelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const pageVisible = usePageVisibility();
  const [activeIndex, setActiveIndex] = useState(0);
  const [manualPaused, setManualPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [narrowViewport, setNarrowViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 46rem)");
    const update = () => setNarrowViewport(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInViewport(entry?.isIntersecting ?? true),
      { threshold: 0.18 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isRotating = !reduceMotion && !narrowViewport && !manualPaused && !interactionPaused && inViewport && pageVisible;

  useEffect(() => {
    if (!isRotating || sectors.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % sectors.length);
    }, HERO_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [isRotating, sectors.length]);

  const activeSector = sectors[activeIndex] ?? sectors[0];
  if (!activeSector) return null;

  return (
    <div
      ref={rootRef}
      className={styles.heroExperience}
      onPointerEnter={() => setInteractionPaused(true)}
      onPointerLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setInteractionPaused(false);
      }}
    >
      <figure className={styles.heroVisual} data-sector={activeSector.id} aria-live="off">
        <AnimatePresence initial={false}>
          <motion.div
            key={activeSector.id}
            className={styles.heroImage}
            initial={reduceMotion ? false : { opacity: 0, scale: 1.035, x: 14 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.99, x: -10 }}
            transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
          >
            <Image
              src={activeSector.image}
              alt={activeSector.alt}
              fill
              priority={activeIndex === 0}
              loading={activeIndex === 0 ? "eager" : "lazy"}
              sizes="(max-width: 900px) 100vw, 56vw"
            />
          </motion.div>
        </AnimatePresence>

        <div className={styles.heroFrameGrid} aria-hidden="true" />
        <div className={styles.heroFrameTop} aria-hidden="true">
          <span>nexID</span>
          <i />
          <b>{String(activeIndex + 1).padStart(2, "0")} / {String(sectors.length).padStart(2, "0")}</b>
        </div>

        <div className={styles.productSignal} aria-hidden="true">
          <span><Nfc size={18} strokeWidth={1.8} /></span>
          <i />
          <b>{activeSector.title}</b>
        </div>

        <AnimatePresence initial={false}>
          <motion.div
            key={`${activeSector.id}-rail`}
            className={styles.heroDataRail}
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: 10 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, delay: reduceMotion ? 0 : 0.12 }}
            aria-hidden="true"
          >
            <span><i /> 01</span>
            <span><i /> 02</span>
            <span><i /> 03</span>
          </motion.div>
        </AnimatePresence>

        <AnimatePresence initial={false}>
          <motion.figcaption
            key={`${activeSector.id}-result`}
            className={styles.resultCard}
            initial={reduceMotion ? false : { opacity: 0, x: narrowViewport ? 28 : 72, scale: 0.985 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: narrowViewport ? 18 : 44, scale: 0.99 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 245, damping: 27, mass: 0.92, delay: 0.08 }}
          >
            <div className={styles.resultCardHeading}>
              <div>
                <p>{activeSector.visualKicker}</p>
                <strong>{activeSector.visualTitle}</strong>
              </div>
              <span className={styles.resultBadge}><BadgeCheck aria-hidden="true" size={19} /></span>
            </div>
            <div className={styles.statusLine}>
              <span aria-hidden="true" />
              {activeSector.visualStatus}
            </div>
            <dl>
              <div>
                <dt>{activeSector.visualOrigin}</dt>
                <dd>{activeSector.visualOriginValue}</dd>
              </div>
            </dl>
            <small>{activeSector.visualBoundary}</small>
            <Link className={styles.resultLink} href={`/demo-lab?vertical=${DEMO_VERTICAL_BY_SECTOR[activeSector.id]}`}>
              {demoLabel}<span aria-hidden="true">↗</span>
            </Link>
          </motion.figcaption>
        </AnimatePresence>
      </figure>

      <div className={styles.sectorStrip} role="group" aria-labelledby={groupLabelId}>
        <div className={styles.sectorStripHeading}>
          <div>
            <p id={groupLabelId}>{sectorsLabel}</p>
            <span>{rotationLabel}</span>
          </div>
          {!reduceMotion && !narrowViewport && (
            <button
              type="button"
              className={styles.rotationButton}
              aria-pressed={manualPaused}
              onClick={() => setManualPaused((current) => !current)}
            >
              {manualPaused ? <Play aria-hidden="true" size={15} /> : <Pause aria-hidden="true" size={15} />}
              <span>{manualPaused ? resumeRotation : pauseRotation}</span>
            </button>
          )}
        </div>

        <div className={styles.sectorControls}>
          {sectors.map((sector, index) => {
            const isActive = activeIndex === index;
            return (
              <button
                key={sector.id}
                type="button"
                className={styles.sectorButton}
                data-active={isActive ? "true" : "false"}
                aria-pressed={isActive}
                onClick={() => {
                  setActiveIndex(index);
                  setManualPaused(true);
                }}
              >
                <span>
                  <strong>{sector.title}</strong>
                  <small>{sector.body}</small>
                </span>
                {isActive && isRotating && (
                  <motion.i
                    key={`${sector.id}-progress`}
                    className={styles.sectorProgress}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: HERO_ROTATION_MS / 1000, ease: "linear" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ProcessExperienceProps = {
  flow: HomeFlowCopy;
  controls: HomeMotionCopy;
};

export function NexidProcessExperience({ flow, controls }: ProcessExperienceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = Boolean(useReducedMotion());
  const pageVisible = usePageVisibility();
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [inViewport, setInViewport] = useState(false);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || reduceMotion || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setInViewport(entry?.isIntersecting ?? false);
      if (entry?.isIntersecting && !hasPlayed) {
        setStepIndex(0);
        setPlaying(true);
        setHasPlayed(true);
      }
    }, { threshold: 0.38 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasPlayed, reduceMotion]);

  useEffect(() => {
    if (!playing || !pageVisible || !inViewport || reduceMotion) return;
    const timer = window.setTimeout(() => {
      if (stepIndex < flow.steps.length - 1) setStepIndex((current) => current + 1);
      else setPlaying(false);
    }, PROCESS_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [flow.steps.length, inViewport, pageVisible, playing, reduceMotion, stepIndex]);

  const activeStep = flow.steps[stepIndex] ?? flow.steps[0];
  if (!activeStep) return null;

  const togglePlayback = () => {
    if (reduceMotion) {
      setStepIndex((current) => (current + 1) % flow.steps.length);
      return;
    }
    if (playing) {
      setPlaying(false);
      return;
    }
    if (stepIndex === flow.steps.length - 1) setStepIndex(0);
    setPlaying(true);
  };

  return (
    <section ref={rootRef} id="how-it-works" className={styles.processExperience} aria-labelledby="flow-title">
      <div className={styles.shell}>
        <div className={styles.processHeader}>
          <div>
            <p className={styles.eyebrow}>{flow.eyebrow}</p>
            <h2 id="flow-title">{flow.title}</h2>
          </div>
          <p>{flow.body}</p>
        </div>

        <div className={styles.processLayout}>
          <div className={styles.processControls} role="group" aria-label={flow.title}>
            {flow.steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                aria-pressed={stepIndex === index}
                data-active={stepIndex === index ? "true" : "false"}
                onClick={() => {
                  setStepIndex(index);
                  setPlaying(false);
                }}
              >
                <span>{step.number}</span>
                <div>
                  <strong>{step.title}</strong>
                  <small>{step.body}</small>
                </div>
              </button>
            ))}
            <div className={styles.processActions}>
              <button type="button" onClick={togglePlayback}>
                {playing ? <Pause aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
                {playing ? controls.pause : stepIndex === flow.steps.length - 1 ? controls.replay : controls.play}
              </button>
              <a href="#evidence">{flow.detail}<span aria-hidden="true">↘</span></a>
            </div>
          </div>

          <div className={styles.processStage} role="region" aria-label={controls.mediaLabel} aria-live="off">
            <div className={styles.processStageTop}>
              <span>{controls.boundary}</span>
              <b>{activeStep.number} / 03</b>
            </div>

            <div className={styles.processScene} data-step={stepIndex} role="img" aria-label={controls.mediaLabel}>
              <div className={styles.identityObject} aria-hidden="true">
                <div className={styles.identityPackage}>
                  <span>nexID</span>
                  <i />
                  <strong>000128</strong>
                  <small>{flow.steps[0]?.title}</small>
                </div>
                <motion.div
                  className={styles.identityTag}
                  animate={reduceMotion || !playing ? undefined : { scale: stepIndex === 0 ? [1, 1.08, 1] : 1 }}
                  transition={{ duration: 1.4, repeat: stepIndex === 0 ? Infinity : 0, ease: "easeInOut" }}
                >
                  <Nfc size={22} />
                </motion.div>
              </div>

              <div className={styles.processConnector} aria-hidden="true"><i /><motion.b animate={reduceMotion ? undefined : { x: stepIndex >= 0 ? [0, 52, 0] : 0 }} transition={{ duration: 1.35, repeat: playing && stepIndex === 0 ? Infinity : 0, ease: "easeInOut" }} /></div>

              <div className={styles.verificationCore} data-active={stepIndex >= 1 ? "true" : "false"} aria-hidden="true">
                <i /><i /><i />
                <span>{stepIndex >= 1 ? <BadgeCheck size={28} /> : <Nfc size={27} />}</span>
                <small>{flow.steps[1]?.title}</small>
              </div>

              <div className={styles.processConnector} aria-hidden="true"><i /><motion.b animate={reduceMotion ? undefined : { x: stepIndex >= 1 ? [0, 52, 0] : 0 }} transition={{ duration: 1.35, repeat: playing && stepIndex >= 1 ? Infinity : 0, ease: "easeInOut" }} /></div>

              <motion.div
                key={activeStep.number}
                className={styles.actionSurface}
                data-active={stepIndex === 2 ? "true" : "false"}
                initial={reduceMotion ? false : { opacity: 0.7, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.36 }}
                aria-hidden="true"
              >
                <div className={styles.actionChrome}><i /><i /><i /><span>nexID</span></div>
                <small>{activeStep.number}</small>
                <strong>{activeStep.title}</strong>
                <p>{activeStep.body}</p>
                <span className={styles.actionButton}>{flow.steps[2]?.title}</span>
              </motion.div>
            </div>

            <div className={styles.processTimeline} aria-hidden="true">
              {flow.steps.map((step, index) => <span key={step.number} data-active={stepIndex >= index ? "true" : "false"} />)}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

type RoleExperienceProps = { copy: HomeRolesCopy };

export function NexidRoleExperience({ copy }: RoleExperienceProps) {
  const reduceMotion = Boolean(useReducedMotion());
  const tabSetId = useId();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = copy.items[activeIndex] ?? copy.items[0];
  if (!active) return null;

  return (
    <section id="solutions" className={styles.roleExperience} aria-labelledby="roles-title">
      <div className={styles.shell}>
        <div className={styles.roleHeader}>
          <div><p className={styles.eyebrow}>{copy.eyebrow}</p><h2 id="roles-title">{copy.title}</h2></div>
          <p>{copy.body}</p>
        </div>

        <div className={styles.roleWorkspace}>
          <div className={styles.roleTabs}>
            <div className={styles.roleTabList} role="tablist" aria-label={copy.title}>
              {copy.items.map((item, index) => (
                <button
                key={item.role}
                id={`${tabSetId}-tab-${index}`}
                type="button"
                role="tab"
                aria-controls={`${tabSetId}-panel`}
                aria-selected={activeIndex === index}
                tabIndex={activeIndex === index ? 0 : -1}
                data-active={activeIndex === index ? "true" : "false"}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home" ? 0 : event.key === "End" ? copy.items.length - 1 : (activeIndex + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + copy.items.length) % copy.items.length;
                  setActiveIndex(next);
                  requestAnimationFrame(() => document.getElementById(`${tabSetId}-tab-${next}`)?.focus());
                }}
                >
                  <div><small>{item.role}</small><strong>{item.title}</strong></div>
                </button>
              ))}
            </div>
            <div className={styles.roleSummary}><p>{active.body}</p><strong>{active.outcome}</strong></div>
          </div>

          <div id={`${tabSetId}-panel`} className={styles.roleViewport} role="tabpanel" aria-labelledby={`${tabSetId}-tab-${activeIndex}`}>
            <div className={styles.workspaceChrome}><span>nexID</span><i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><b>{copy.scenarioLabel}</b></div>
            <AnimatePresence initial={false}>
              <motion.div key={activeIndex} className={styles.roleMockup} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}>
                {activeIndex === 0 && (
                  <div className={styles.brandBoard}>
                    <div className={styles.boardTitle}><span aria-hidden="true">N</span><div><small>{copy.workspace.portfolioTitle}</small><b>{active.outcome}</b></div></div>
                    <div className={styles.productPortfolio}>
                      {copy.workspace.portfolioItems.map((item, index) => (
                        <article key={item}>
                          <div className={styles.portfolioObject} data-shape={index + 1} aria-hidden="true"><i /><b /></div>
                          <strong>{item}</strong>
                          <small>{index === 0 ? copy.workspace.activeLabel : copy.workspace.configuredLabel}</small>
                        </article>
                      ))}
                    </div>
                    <div className={styles.portfolioSummary}>
                      <span><i aria-hidden="true" />{copy.workspace.activeLabel}</span>
                      <span><i aria-hidden="true" />{copy.workspace.configuredLabel}</span>
                    </div>
                  </div>
                )}
                {activeIndex === 1 && (
                  <NexidOperationsPreview copy={copy.workspace} outcome={active.outcome} />
                )}
                {activeIndex === 2 && (
                  <div className={styles.customerBoard}>
                    <div className={styles.customerObject} aria-hidden="true"><div><span>nexID</span><i /><b>000128</b></div><em><Nfc size={24} /></em></div>
                    <div className={styles.customerBrowser}>
                      <div className={styles.browserChrome} aria-hidden="true"><i /><i /><i /><span>nexID</span></div>
                      <small>{copy.workspace.customerTitle}</small>
                      <strong>{active.outcome}</strong>
                      <div><span>{copy.workspace.informationLabel}</span><b>{copy.workspace.activeLabel}</b></div>
                      <div><span>{copy.workspace.nextActionLabel}</span><b>{copy.workspace.configuredLabel}</b></div>
                      <span className={styles.customerAction}>{copy.workspace.viewDetail}</span>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
