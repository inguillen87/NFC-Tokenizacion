"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type ReactNode } from "react";
import type { CtaActions } from "./cta-actions";
import type { QREngagementSuite } from "./qr-engagement-suite";
import { useSunLocale } from "./sun-locale-provider";
import styles from "./sun-deferred-consumer-tools.module.css";

type ReadyProps = { onReady: () => void };
type CtaProps = ComponentProps<typeof CtaActions>;
type EngagementProps = ComponentProps<typeof QREngagementSuite>;
const SLOW_TOOL_NOTICE_MS = 8_000;

function LoadingTool({ title }: { title: string }) {
  const { text } = useSunLocale();
  return <div className={styles.loading} data-testid="sun-tool-loading">
    <h3>{text(title)}</h3>
    <p className={styles.loadingStatus} role="status"><span className={styles.loadingSignal} aria-hidden="true" />{text("Preparando las opciones…")}</p>
    <div className={styles.loadingPreview} aria-hidden="true"><span /><span /></div>
    <p className={styles.loadingNote}>{text("Podés seguir consultando la información del producto.")}</p>
  </div>;
}

function LoadingCtaTool() { return <LoadingTool title="Postventa y garantía" />; }
function LoadingEngagementTool() { return <LoadingTool title="Novedades y experiencias" />; }

// A new instance is only needed after a failed download. Once mounted, forms stay mounted.
function createCtaTool() {
  return dynamic<CtaProps & ReadyProps>(() => import("./cta-actions").then(({ CtaActions: Tool }) => function ReadyTool({ onReady, ...props }) {
    useEffect(onReady, [onReady]);
    return <Tool {...props} />;
  }), { ssr: false, loading: LoadingCtaTool });
}

function createEngagementTool() {
  return dynamic<EngagementProps & ReadyProps>(() => import("./qr-engagement-suite").then(({ QREngagementSuite: Tool }) => function ReadyTool({ onReady, ...props }) {
    useEffect(onReady, [onReady]);
    return <Tool {...props} />;
  }), { ssr: false, loading: LoadingEngagementTool });
}

class ToolErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function DeferredTool<Props extends object>({ anchorId, title, description, create, toolProps }: {
  anchorId: string;
  title: string;
  description: string;
  create: () => ComponentType<Props & ReadyProps>;
  toolProps: Props;
}) {
  const { text } = useSunLocale();
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [delayed, setDelayed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusAfterLoad = useRef(false);
  const focusOwner = useRef<Element | null>(null);
  const Tool = useMemo(create, [create, attempt]);
  const cancelFocus = useCallback(() => {
    focusAfterLoad.current = false;
    focusOwner.current = null;
  }, []);
  const rememberFocus = useCallback(() => {
    focusAfterLoad.current = true;
    focusOwner.current = document.activeElement;
  }, []);
  const finishFocus = useCallback((target: HTMLElement | null) => {
    const active = document.activeElement;
    const mayFocus = focusAfterLoad.current && (
      active === focusOwner.current || active === document.body || active === document.documentElement
    );
    focusAfterLoad.current = false;
    focusOwner.current = null;
    if (mayFocus) target?.focus({ preventScroll: true });
  }, []);
  const request = useCallback((focus = false) => {
    if (focus) rememberFocus();
    setRequested(true);
  }, [rememberFocus]);
  const onReady = useCallback(() => {
    setReady(true);
    setFailed(false);
    setDelayed(false);
    finishFocus(rootRef.current);
  }, [finishFocus]);
  const onError = useCallback(() => { setFailed(true); setDelayed(false); }, []);

  useEffect(() => cancelFocus, [cancelFocus]);

  useEffect(() => {
    if (!requested || ready || failed) return;
    // Slow is feedback, not a failed import: keep this attempt and its form mounted.
    const timer = window.setTimeout(() => setDelayed(true), SLOW_TOOL_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [attempt, failed, ready, requested]);

  useEffect(() => {
    if (!requested || ready || failed) return;
    // A delayed download must not override a newer interaction or browser history.
    const onFocus = (event: FocusEvent) => {
      if (event.target !== focusOwner.current) cancelFocus();
    };
    const pointerEvents = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    document.addEventListener("focusin", onFocus);
    for (const event of pointerEvents) document.addEventListener(event, cancelFocus, { passive: true });
    window.addEventListener("hashchange", cancelFocus);
    window.addEventListener("popstate", cancelFocus);
    return () => {
      document.removeEventListener("focusin", onFocus);
      for (const event of pointerEvents) document.removeEventListener(event, cancelFocus);
      window.removeEventListener("hashchange", cancelFocus);
      window.removeEventListener("popstate", cancelFocus);
    };
  }, [attempt, cancelFocus, failed, ready, requested]);

  useEffect(() => {
    if (failed) finishFocus(retryRef.current);
  }, [failed, finishFocus]);

  useEffect(() => {
    if (requested) return;
    const root = rootRef.current;
    if (!root) return;
    const syncHash = () => { if (window.location.hash === `#${anchorId}`) request(true); };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    let observer: IntersectionObserver | undefined;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) request();
      }, { rootMargin: "320px 0px" });
      observer.observe(root);
    } else request();
    return () => { observer?.disconnect(); window.removeEventListener("hashchange", syncHash); };
  }, [anchorId, request, requested]);

  const showDelay = requested && delayed && !ready && !failed;
  return <div ref={rootRef} className={styles.boundary} role="region" aria-label={text(title)} tabIndex={-1}
    data-sun-deferred-tool={anchorId} data-tool-load-state={failed ? "error" : ready ? "ready" : showDelay ? "delayed" : requested ? "loading" : "waiting"}
    aria-busy={requested && !ready && !failed && !showDelay}>
    {showDelay && <div className={styles.placeholder} data-testid="sun-tool-delayed">
      <h3>{text(title)}</h3>
      <p role="status">{text("Estas opciones están tardando más de lo esperado.")}</p>
      <p>{text("Podés seguir leyendo la ficha. Las opciones aparecerán cuando termine la carga.")}</p>
      <a className={styles.openButton} href="#sun-summary" onClick={cancelFocus}>{text("Volver a la ficha")}</a>
    </div>}
    {requested ? <div hidden={showDelay}><ToolErrorBoundary key={attempt} onError={onError} fallback={<div className={styles.placeholder}>
      <p role="status">{text("No pudimos preparar estas opciones. Revisá la conexión y volvé a intentar.")}</p>
      <button ref={retryRef} type="button" className={styles.openButton} onClick={() => { rememberFocus(); setReady(false); setFailed(false); setDelayed(false); setAttempt(value => value + 1); }}>{text("Volver a intentar")}</button>
    </div>}><Tool {...toolProps} onReady={onReady} /></ToolErrorBoundary></div> : <div className={styles.placeholder}>
      <h3>{text(title)}</h3>
      <p>{text(description)}</p>
      <button type="button" className={styles.openButton} onClick={() => request(true)}>{text("Ver opciones")}</button>
      <noscript>{text("Activá JavaScript para usar estas opciones. La información del producto sigue disponible arriba.")}</noscript>
    </div>}
  </div>;
}

export function DeferredCtaActions(props: CtaProps) {
  return <DeferredTool anchorId="protected-actions" title="Postventa y garantía" description="Consultá las opciones habilitadas para este producto. Cada acción conserva sus requisitos de validación." create={createCtaTool} toolProps={props} />;
}

export function DeferredQREngagementSuite(props: EngagementProps) {
  return <DeferredTool anchorId="qr-engagement" title="Novedades y experiencias" description="Explorá las opciones de la marca. Compartir datos o enviar una consulta requiere tu acción." create={createEngagementTool} toolProps={props} />;
}
