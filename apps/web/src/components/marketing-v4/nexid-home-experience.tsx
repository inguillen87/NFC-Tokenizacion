"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  FileText,
  Headphones,
  Nfc,
  PackageCheck,
  Pause,
  Play,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
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
const PROCESS_STEP_MS = 4_600;
const NexidOperationsPreview = dynamic(
  () => import("./nexid-operations-preview").then((module) => module.NexidOperationsPreview),
  {
    ssr: false,
    loading: () => (
      <div className={styles.operationsLoading} aria-hidden="true">
        <span /><span /><span />
      </div>
    ),
  },
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
          <div
            className={styles.processControls}
            role="tablist"
            aria-label={flow.title}
            onFocusCapture={() => setPlaying(false)}
          >
            {flow.steps.map((step, index) => (
              <button
                key={step.number}
                id={`journey-step-${index}`}
                type="button"
                role="tab"
                aria-label={step.title}
                aria-selected={stepIndex === index}
                aria-controls="journey-stage"
                tabIndex={stepIndex === index ? 0 : -1}
                data-active={stepIndex === index ? "true" : "false"}
                onClick={() => {
                  setStepIndex(index);
                  setPlaying(false);
                }}
                onKeyDown={(event) => {
                  if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const next = event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? flow.steps.length - 1
                      : (stepIndex + (["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1) + flow.steps.length) % flow.steps.length;
                  setStepIndex(next);
                  setPlaying(false);
                  requestAnimationFrame(() => document.getElementById(`journey-step-${next}`)?.focus());
                }}
              >
                <span aria-hidden="true">{step.number}</span>
                <strong className={styles.processStepLong} aria-hidden="true">{step.title}</strong>
                <strong className={styles.processStepShort} aria-hidden="true">{step.shortTitle}</strong>
              </button>
            ))}
          </div>

          <div
            id="journey-stage"
            className={styles.processStage}
            role="tabpanel"
            aria-labelledby={`journey-step-${stepIndex}`}
            aria-live="off"
          >
            <div className={styles.processStageTop}>
              <span>{flow.sampleLabel}</span>
              <b>{activeStep.number} / {String(flow.steps.length).padStart(2, "0")}</b>
            </div>

            <div className={styles.processScene} data-step={stepIndex}>
              <div className={styles.journeyPhoto} role="img" aria-label={controls.mediaLabel}>
                <motion.span
                  className={styles.journeyHotspot}
                  animate={reduceMotion || !playing ? undefined : { scale: [1, 1.09, 1] }}
                  transition={{ duration: 1.55, repeat: Infinity, ease: "easeInOut" }}
                  aria-hidden="true"
                >
                  {stepIndex === 0 ? <Nfc size={21} /> : stepIndex === 1 ? <ShieldCheck size={21} /> : <PackageCheck size={21} />}
                </motion.span>

                <AnimatePresence initial={false}>
                  <motion.div
                    key={activeStep.signal}
                    className={styles.journeySignal}
                    initial={reduceMotion ? false : { opacity: 0, x: -18, y: 8 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, x: 12 }}
                    transition={{ duration: reduceMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <span aria-hidden="true">{stepIndex === 0 ? <Nfc size={17} /> : stepIndex === 1 ? <BadgeCheck size={17} /> : <Smartphone size={17} />}</span>
                    <div><small>nexID</small><strong>{activeStep.signal}</strong></div>
                  </motion.div>
                </AnimatePresence>

                <div className={styles.journeyActions} data-visible={stepIndex === 2 ? "true" : "false"} aria-hidden="true">
                  <span><FileText size={15} />{flow.steps[2]?.title}</span>
                  <span><Headphones size={15} />{controls.openDemo}</span>
                </div>
              </div>

              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={activeStep.number}
                  className={styles.processNarrative}
                  initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span>{activeStep.number}</span>
                  <h3>{activeStep.title}</h3>
                  <p>{activeStep.body}</p>
                  <div className={styles.processPerspectives}>
                    <article>
                      <Smartphone aria-hidden="true" size={19} />
                      <div><small>{flow.personLabel}</small><strong>{activeStep.person}</strong></div>
                    </article>
                    <article>
                      <Building2 aria-hidden="true" size={19} />
                      <div><small>{flow.businessLabel}</small><strong>{activeStep.business}</strong></div>
                    </article>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className={styles.processFooter}>
              <button type="button" onClick={togglePlayback}>
                {playing ? <Pause aria-hidden="true" size={15} /> : <Play aria-hidden="true" size={15} />}
                {playing ? controls.pause : stepIndex === flow.steps.length - 1 ? controls.replay : controls.play}
              </button>
              <a href="#evidence">{flow.detail}<span aria-hidden="true">↘</span></a>
              <div className={styles.processTimeline} aria-hidden="true">
                {flow.steps.map((step, index) => <span key={step.number} data-active={stepIndex >= index ? "true" : "false"} />)}
              </div>
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
                  <small>{item.role}</small>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>
            <div className={styles.roleSummary}>
              <p>{active.body}</p>
              <strong>{active.outcome}</strong>
            </div>
          </div>

          <div
            id={`${tabSetId}-panel`}
            className={styles.roleViewport}
            data-role={activeIndex}
            role="tabpanel"
            aria-labelledby={`${tabSetId}-tab-${activeIndex}`}
          >
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={activeIndex}
                className={styles.roleMockup}
                initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.995 }}
                transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeIndex === 0 && (
                  <div className={styles.brandBoard}>
                    <div className={styles.boardTitle}>
                      <span aria-hidden="true"><PackageCheck size={20} /></span>
                      <div><small>{copy.workspace.portfolioTitle}</small><b>{active.outcome}</b></div>
                      <p>{copy.scenarioLabel}</p>
                    </div>
                    <div className={styles.productPortfolio}>
                      {copy.workspace.portfolioItems.map((item, index) => (
                        <article key={item} data-sector={index + 1}>
                          <div className={styles.portfolioImage} aria-hidden="true">
                            <span><Nfc size={16} /></span>
                          </div>
                          <div className={styles.portfolioCopy}>
                            <span>{String(index + 1).padStart(2, "0")}</span>
                            <strong>{item}</strong>
                            <small data-active={index === 0 ? "true" : "false"}>{index === 0 ? copy.workspace.activeLabel : copy.workspace.configuredLabel}</small>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className={styles.portfolioSummary}>
                      <p>{active.body}</p>
                      <span><i aria-hidden="true" />{copy.workspace.activeLabel}</span>
                      <span><i aria-hidden="true" />{copy.workspace.configuredLabel}</span>
                    </div>
                  </div>
                )}
                {activeIndex === 1 && (
                  <NexidOperationsPreview copy={copy.workspace} outcome={active.outcome} scenarioLabel={copy.scenarioLabel} />
                )}
                {activeIndex === 2 && (
                  <div className={styles.customerBoard}>
                    <div className={styles.customerStory}>
                      <small>{copy.scenarioLabel}</small>
                      <strong>{active.title}</strong>
                      <p>{active.body}</p>
                      <span><Smartphone size={17} />{active.outcome}</span>
                    </div>
                    <div className={styles.customerBrowser}>
                      <div className={styles.browserChrome} aria-hidden="true"><i /><span>nexID</span><b>000128</b></div>
                      <div className={styles.customerVerified}><BadgeCheck size={19} /><span>{copy.workspace.activeLabel}</span></div>
                      <small>{copy.workspace.customerTitle}</small>
                      <strong>{active.outcome}</strong>
                      <div><span>{copy.workspace.informationLabel}</span><b>{copy.workspace.activeLabel}</b></div>
                      <div><span>{copy.workspace.nextActionLabel}</span><b>{copy.workspace.configuredLabel}</b></div>
                      <span className={styles.customerAction}>{copy.workspace.viewDetail}</span>
                    </div>
                    <div className={styles.customerTouchpoint} aria-hidden="true"><Nfc size={21} /></div>
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
