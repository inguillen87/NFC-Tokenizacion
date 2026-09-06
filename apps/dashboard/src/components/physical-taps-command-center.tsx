"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Fingerprint,
  LockKeyhole,
  MapPin,
  Radio,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wine,
} from "lucide-react";
import { PremiumVectorMap, type VectorMapPoint } from "@product/ui/premium-vector-map";
import {
  canRefreshPhysicalTaps,
  isRecoverablePhysicalTapsAvailability,
  latestPhysicalTapByState,
  mergePhysicalTapRealtimeProjection,
  mergePhysicalTapsRefresh,
  normalizePhysicalTapsPayload,
  physicalTapFromRealtimeProjection,
  type PhysicalTapRow,
  type PhysicalTapsAvailability,
  type PhysicalTapsResult,
} from "../lib/physical-taps-contract";
import { dashboardRealtimeConsumerFellBehind, unreadDashboardRealtimeFrames } from "../lib/dashboard-realtime-buffer";
import { SecureDashboardLogoutButton } from "./secure-dashboard-logout-button";
import { useDashboardRealtime } from "./dashboard-realtime-provider";
import styles from "./physical-taps-command-center.module.css";

type StateFilter = "all" | "closed" | "opened" | "other";
type LocationFilter = "all" | "approximate" | "none";
type SyncState = "idle" | "connecting" | "syncing" | "live" | "stale";
const EMPTY_ROWS: PhysicalTapRow[] = [];
const PHYSICAL_RECONCILE_MIN_INTERVAL_MS = 15_000;
const PHYSICAL_TAP_EVENT_TYPES = new Set(["TAP_VALID", "TAP_INVALID", "REPLAY_SUSPECT"]);
const NUMBER_FORMATTER = new Intl.NumberFormat("es-AR");
const DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

function number(value: number) {
  return NUMBER_FORMATTER.format(value);
}

function absoluteDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Hora no informada";
  return DATE_FORMATTER.format(timestamp);
}

function locationLabel(row: PhysicalTapRow) {
  const locality = [row.location.city, row.location.region, row.location.country].filter(Boolean);
  return locality.length ? locality.join(" · ") : "Zona no informada";
}

function locationEvidenceCopy(row: PhysicalTapRow) {
  if (row.location.precision === "none") {
    return "Este evento no tiene una ubicación persistida. No completamos la zona con coordenadas inferidas.";
  }
  if (row.location.precision === "browser_approximate_consent") {
    return "Ubicación aproximada compartida desde el navegador con consentimiento y precisión reducida; no demuestra presencia exacta.";
  }
  return `Zona aproximada informada por ${row.location.source || "la red"}; no identifica una dirección ni demuestra presencia exacta.`;
}

function stateCopy(state: PhysicalTapRow["sealState"]) {
  if (state === "closed") {
    return {
      eyebrow: "Lectura con sello reportado cerrado",
      title: "Producto sin apertura reportada",
      detail: "El mensaje autenticado del tag reportó estado TT cerrado. No certifica por sí solo el contenido ni el montaje del sello.",
      action: "Preparar bienvenida, garantía o club sólo si la persona brinda consentimiento.",
      tone: "emerald",
    } as const;
  }
  if (state === "opened") {
    return {
      eyebrow: "Lectura con sello reportado abierto",
      title: "Apertura electrónica reportada",
      detail: "El tag reportó estado TT abierto. Es una señal operativa útil, no una prueba independiente del estado físico del envase.",
      action: "Ofrecer soporte, recompra o reposición sólo después de opt-in o claim autorizado.",
      tone: "amber",
    } as const;
  }
  return {
    eyebrow: "Estado no clasificado",
    title: "Lectura para revisión",
    detail: "La validación existe, pero el estado TT no se pudo presentar como cerrado o abierto.",
    action: "Revisar evidencia técnica antes de iniciar cualquier automatización comercial.",
    tone: "slate",
  } as const;
}

function stateBadgeClass(state: PhysicalTapRow["sealState"]) {
  if (state === "closed") return "border-[var(--taps-success-border)] bg-[var(--taps-success-bg)] text-[var(--taps-success)]";
  if (state === "opened") return "border-[var(--taps-warning-border)] bg-[var(--taps-warning-bg)] text-[var(--taps-warning)]";
  return "border-[var(--taps-border)] bg-[var(--taps-muted-bg)] text-[var(--taps-text)]";
}

function EventEvidenceCard({ row }: { row: PhysicalTapRow }) {
  const copy = stateCopy(row.sealState);
  const closed = row.sealState === "closed";
  const ttReceiptBound = row.evidence.kind === "physical_nfc_tt_evidenced" && row.evidence.ttStatusReported;
  return (
    <article
      data-testid={`physical-tap-${row.sealState}`}
      className={`overflow-hidden rounded-3xl border ${closed ? "border-[var(--taps-success-border)] bg-[var(--taps-success-bg)]" : row.sealState === "opened" ? "border-[var(--taps-warning-border)] bg-[var(--taps-warning-bg)]" : "border-[var(--taps-border)] bg-[var(--taps-surface)]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--taps-border)] px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border ${stateBadgeClass(row.sealState)}`}>
            {closed ? <ShieldCheck className="h-5 w-5" /> : <CircleAlert className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${closed ? "text-[var(--taps-success)]" : row.sealState === "opened" ? "text-[var(--taps-warning)]" : "text-[var(--taps-muted)]"}`}>{copy.eyebrow}</p>
            <h3 className="mt-1 text-lg font-black text-[var(--taps-text)]">{copy.title}</h3>
            <p className="mt-1 truncate text-xs text-[var(--taps-muted)]">{row.productName || "Producto sin nombre"} · {row.bid || "Lote no informado"}</p>
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--taps-accent)]">Fuente real</span>
      </div>

      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-2 text-xs sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-3">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-[var(--taps-muted)]">Unidad independiente</p>
            <p className="mt-1 font-mono font-semibold text-[var(--taps-text)]">{row.uidMasked}</p>
            <p className="mt-1 text-[var(--taps-muted)]">Evento #{row.eventId}{row.readCounter !== null ? ` · lectura ${row.readCounter}` : ""}</p>
          </div>
          <div className="rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-3">
            <p className="text-xs font-black uppercase tracking-[0.13em] text-[var(--taps-muted)]">Momento reportado</p>
            <p className="mt-1 font-semibold text-[var(--taps-text)]">{absoluteDate(row.occurredAt.utc)}</p>
            <p className="mt-1 text-[var(--taps-muted)]">{row.occurredAt.timezone || "Timezone no informada"}</p>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] p-3 text-xs leading-5 text-[var(--taps-muted)]">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--taps-accent)]" />
          <span><b className="text-[var(--taps-text)]">{locationLabel(row)}</b><br />{locationEvidenceCopy(row)}</span>
        </div>
        <p className="text-xs leading-5 text-[var(--taps-muted)]">{row.messageValid ? ttReceiptBound ? copy.detail : "El evento source=real fue validado, pero no tiene un receipt TT durable que confirme el carrier y su estado electrónico. Requiere revisión técnica." : "El evento fue registrado con source=real, pero el mensaje NFC no quedó validado. Requiere revisión técnica antes de operar."}</p>
        <p className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${row.messageValid ? "border-[var(--taps-success-border)] bg-[var(--taps-success-bg)] text-[var(--taps-success)]" : "border-[var(--taps-warning-border)] bg-[var(--taps-warning-bg)] text-[var(--taps-warning)]"}`}>
          {row.messageValid ? <CheckCircle2 className="h-3 w-3" /> : <CircleAlert className="h-3 w-3" />}
          {row.messageValid ? "Mensaje NFC validado" : "Mensaje no validado"}
        </p>
        <p className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${ttReceiptBound ? "border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] text-[var(--taps-accent)]" : "border-[var(--taps-border)] bg-[var(--taps-muted-bg)] text-[var(--taps-muted)]"}`}>
          <Fingerprint className="h-3 w-3" />
          {ttReceiptBound ? "TT respaldado por receipt durable" : "Carrier físico sin confirmar"}
        </p>
        <div className="rounded-2xl border border-[var(--taps-violet-border)] bg-[var(--taps-violet-bg)] p-3">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[var(--taps-violet)]"><Sparkles className="h-3.5 w-3.5" /> Próximo paso comercial</p>
          <p className="mt-1 text-xs leading-5 text-[var(--taps-text)]">{copy.action}</p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--taps-border)] bg-[var(--taps-surface)] px-2.5 py-1 text-xs font-bold text-[var(--taps-muted)]"><LockKeyhole className="h-3 w-3" /> Contacto bloqueado hasta consentimiento</p>
        </div>
      </div>
    </article>
  );
}

function groupMapPoints(rows: PhysicalTapRow[]): VectorMapPoint[] {
  const groups = new Map<string, { lat: number; lng: number; label: string; rows: PhysicalTapRow[] }>();
  for (const row of rows) {
    if (row.location.lat === null || row.location.lng === null) continue;
    const lat = Number(row.location.lat.toFixed(3));
    const lng = Number(row.location.lng.toFixed(3));
    const key = `${lat}:${lng}`;
    const existing = groups.get(key);
    if (existing) existing.rows.push(row);
    else groups.set(key, { lat, lng, label: locationLabel(row), rows: [row] });
  }
  return Array.from(groups.entries()).map(([id, group]) => {
    const closed = group.rows.filter((row) => row.sealState === "closed").length;
    const opened = group.rows.filter((row) => row.sealState === "opened").length;
    return {
      id: `physical-zone-${id}`,
      label: group.label,
      sublabel: `${group.rows.length} TAP${group.rows.length === 1 ? "" : "s"} independiente${group.rows.length === 1 ? "" : "s"}`,
      lat: group.lat,
      lng: group.lng,
      scans: group.rows.length,
      tone: "tap" as const,
      stageLabel: "Zona aproximada",
      evidence: `${closed} cerrado${closed === 1 ? "" : "s"} · ${opened} abierto${opened === 1 ? "" : "s"}; sin ruta inferida`,
      lastSeen: group.rows.map((row) => row.occurredAt.utc).sort().at(-1),
    };
  });
}

function UnavailablePhysicalTaps({
  result,
  tenantDisplayName,
  clerkEnabled = false,
  canRetry,
  syncState,
  onRetry,
}: {
  result: PhysicalTapsResult;
  tenantDisplayName: string;
  clerkEnabled?: boolean;
  canRetry: boolean;
  syncState: SyncState;
  onRetry: () => void;
}) {
  const needsSession = result.availability === "requires_tenant_session";
  const forbidden = result.availability === "forbidden";
  return (
    <section data-testid="physical-taps-unavailable" className={`${styles.workspace} ${styles.unavailable} overflow-hidden rounded-3xl border border-[var(--taps-warning-border)]`}>
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[var(--taps-warning-border)] bg-[var(--taps-warning-bg)] text-[var(--taps-warning)]"><LockKeyhole className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--taps-warning)]">TAP físicos · datos protegidos</p>
            <h2 className="mt-1 text-xl font-black text-[var(--taps-text)]">{needsSession ? "La demo no reemplaza la evidencia real" : forbidden ? "Tu cuenta no tiene acceso a estos TAP" : "No pudimos confirmar la fuente de TAP"}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--taps-muted)]">
              {needsSession
                ? `Los TAP físicos recientes de ${tenantDisplayName} requieren una sesión tenant autorizada. Esta sesión demo no muestra fixtures como si fueran actividad real.`
                : "La fuente real no confirmó acceso o disponibilidad. No convertimos el error en contadores cero ni en eventos simulados."}
            </p>
            <p className="mt-2 text-xs text-[var(--taps-muted)]">Último intento de consulta: {absoluteDate(result.checkedAt)}</p>
            <details className="mt-2 text-xs text-[var(--taps-muted)]"><summary className="cursor-pointer font-semibold">Detalle de disponibilidad</summary><p className="mt-1 break-words">{result.detail}</p></details>
            {canRetry ? (
              <p className="mt-2 inline-flex items-center gap-2 text-xs font-bold text-[var(--taps-accent)]" role="status" aria-live="polite">
                <span className={`h-2 w-2 rounded-full ${syncState === "syncing" ? "animate-pulse bg-[var(--taps-accent)]" : "bg-[var(--taps-warning)]"}`} />
                {syncState === "syncing" ? "Consultando la fuente real" : "Recuperación por stream o reintento"}
              </p>
            ) : null}
          </div>
        </div>
        {needsSession ? (
          <SecureDashboardLogoutButton
            clerkEnabled={clerkEnabled}
            label="Cambiar a cuenta tenant"
            pendingLabel="Cerrando sesión…"
            testId="physical-taps-change-account"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent)] px-4 py-2 text-sm font-black text-[var(--taps-on-accent)] hover:bg-[var(--taps-accent)] disabled:cursor-wait disabled:opacity-70 lg:w-auto"
          />
        ) : canRetry ? (
          <button
            type="button"
            data-testid="physical-taps-retry"
            onClick={onRetry}
            disabled={syncState === "syncing"}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-4 py-2 text-sm font-bold text-[var(--taps-accent)] transition hover:bg-[var(--taps-accent-bg)] disabled:cursor-wait disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${syncState === "syncing" ? "animate-spin" : ""}`} />
            Reintentar ahora
          </button>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--taps-border)] bg-[var(--taps-surface-strong)] px-4 py-2 text-sm font-bold text-[var(--taps-muted)]">
            {forbidden ? "Acceso restringido" : "Fuente no consultable"}
          </span>
        )}
      </div>
    </section>
  );
}

function isPhysicalTapStreamEvent(value: unknown, tenantSlug: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const eventTenant = String(event.tenant_slug || event.tenantSlug || "").trim().toLowerCase();
  const eventType = String(event.event_type || event.eventType || "").trim().toUpperCase();
  const streamSource = String(event.source || "").trim().toLowerCase();
  const eventSource = String(event.event_source || event.eventSource || "").trim().toLowerCase();
  return eventTenant === tenantSlug.trim().toLowerCase()
    && PHYSICAL_TAP_EVENT_TYPES.has(eventType)
    && streamSource === "production"
    && (eventSource === "real" || eventSource === "imported" || eventSource === "production");
}

export function PhysicalTapsCommandCenter({
  result,
  compact = false,
  tenantDisplayName = "este tenant",
  tenantSlug = "",
  clerkEnabled = false,
}: {
  result: PhysicalTapsResult;
  compact?: boolean;
  tenantDisplayName?: string;
  tenantSlug?: string;
  clerkEnabled?: boolean;
}) {
  const [liveResult, setLiveResult] = useState(result);
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [state, setState] = useState<StateFilter>("all");
  const [location, setLocation] = useState<LocationFilter>("all");
  const [batch, setBatch] = useState("all");
  const liveResultRef = useRef(result);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const refreshInFlightRef = useRef(false);
  const trailingRefreshRef = useRef(false);
  const eventRefreshTimerRef = useRef<number | null>(null);
  const lastEventReconcileAtRef = useRef(0);
  const consumedEventSequenceRef = useRef(0);
  const initialRange = result.payload?.scope.range || "24h";
  const initialBid = result.payload?.scope.bid || "all";
  const refreshable = Boolean(tenantSlug) && canRefreshPhysicalTaps(liveResult.availability);
  const realtime = useDashboardRealtime();
  const refreshPhysicalTaps = useCallback(async function runPhysicalTapsRefresh(): Promise<void> {
    if (!tenantSlug || !refreshable) return;
    if (refreshInFlightRef.current) {
      trailingRefreshRef.current = true;
      return;
    }
    refreshInFlightRef.current = true;
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    setSyncState("syncing");
    const params = new URLSearchParams({ tenant: tenantSlug, range: initialRange, limit: "100" });
    if (initialBid && initialBid !== "all") params.set("bid", initialBid);
    const recordFailure = (availability: PhysicalTapsAvailability, detail: string) => {
      const failedResult: PhysicalTapsResult = {
        availability,
        payload: null,
        detail,
        checkedAt: new Date().toISOString(),
      };
      setLiveResult((current) => mergePhysicalTapsRefresh(current, failedResult));
      setSyncState("stale");
    };
    try {
      const response = await fetch(`/api/admin/sun/physical-taps?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (controller.signal.aborted) return;
      if (response.status === 401 || response.status === 403) {
        setLiveResult({
          availability: "forbidden",
          payload: null,
          detail: `HTTP_${response.status}`,
          checkedAt: new Date().toISOString(),
        });
        setSyncState("idle");
        return;
      }
      if (!response.ok) {
        recordFailure("upstream_error", `HTTP_${response.status}`);
        return;
      }
      const payload = normalizePhysicalTapsPayload(await response.json().catch(() => null));
      if (controller.signal.aborted) return;
      if (!payload || payload.scope.tenant !== tenantSlug) {
        recordFailure("invalid_payload", "physical_taps_contract_invalid");
        return;
      }
      setLiveResult({
        availability: "ready",
        payload,
        detail: "tenant_scoped_real_physical_taps",
        checkedAt: new Date().toISOString(),
      });
      setSyncState("live");
      lastEventReconcileAtRef.current = Date.now();
    } catch {
      if (controller.signal.aborted) return;
      recordFailure("unreachable", "physical_taps_upstream_unreachable");
    } finally {
      if (refreshAbortRef.current === controller) refreshAbortRef.current = null;
      refreshInFlightRef.current = false;
      if (controller.signal.aborted) {
        trailingRefreshRef.current = false;
      } else if (trailingRefreshRef.current) {
        trailingRefreshRef.current = false;
        void runPhysicalTapsRefresh();
      }
    }
  }, [initialBid, initialRange, refreshable, tenantSlug]);

  const queuePhysicalTapsRefresh = useCallback(() => {
    if (eventRefreshTimerRef.current !== null) return;
    const elapsed = Date.now() - lastEventReconcileAtRef.current;
    const delay = Math.max(750, PHYSICAL_RECONCILE_MIN_INTERVAL_MS - elapsed);
    eventRefreshTimerRef.current = window.setTimeout(() => {
      eventRefreshTimerRef.current = null;
      void refreshPhysicalTaps();
    }, delay);
  }, [refreshPhysicalTaps]);

  useEffect(() => {
    setLiveResult(result);
  }, [result]);

  useEffect(() => {
    liveResultRef.current = liveResult;
  }, [liveResult]);

  useEffect(() => {
    if (!refreshable) return;
    if (realtime.status === "connected") {
      setSyncState((current) => current === "syncing" ? current : "connecting");
    } else if (realtime.status === "reconnecting") {
      setSyncState("stale");
    }
  }, [realtime.status, refreshable]);

  useEffect(() => {
    const frame = realtime.snapshot;
    if (!refreshable || !frame || frame.scopeKey !== realtime.activeScopeKey) return;
    const snapshot = frame.data as { availability?: unknown; scope?: { tenant?: unknown; window?: unknown }; source?: unknown; rows?: unknown } | null;
    if (
      !snapshot
      || snapshot.availability !== "ready"
      || String(snapshot.scope?.tenant || "").trim().toLowerCase() !== tenantSlug.trim().toLowerCase()
      || String(snapshot.scope?.window || "").trim().toLowerCase() !== realtime.activeScope.window
      || String(snapshot.source || "").trim().toLowerCase() !== "production"
      || !Array.isArray(snapshot.rows)
    ) {
      setSyncState("stale");
      return;
    }
    const snapshotRows: unknown[] = snapshot.rows;
    setLiveResult((current) => snapshotRows.reduce<PhysicalTapsResult>((next, candidate) => {
      const projected = physicalTapFromRealtimeProjection(candidate, tenantSlug);
      return projected ? mergePhysicalTapRealtimeProjection(next, projected, frame.receivedAt) || next : next;
    }, current));
    setSyncState("live");
  }, [realtime.activeScope.window, realtime.activeScopeKey, realtime.snapshot, refreshable, tenantSlug]);

  useEffect(() => {
    if (!refreshable) return;
    const frames = unreadDashboardRealtimeFrames(
      realtime.events,
      consumedEventSequenceRef.current,
      realtime.activeScopeKey,
    );
    const fellBehind = dashboardRealtimeConsumerFellBehind(
      consumedEventSequenceRef.current,
      realtime.droppedThroughSequence,
    );
    if (!frames.length && !fellBehind) return;
    consumedEventSequenceRef.current = frames[frames.length - 1]?.sequence || realtime.droppedThroughSequence;
    const physicalFrames = frames.filter((frame) => isPhysicalTapStreamEvent(frame.data, tenantSlug));
    if (!physicalFrames.length && !fellBehind) return;

    const projected = physicalFrames.flatMap((frame) => {
      const row = physicalTapFromRealtimeProjection(frame.data, tenantSlug);
      return row ? [{ row, receivedAt: frame.receivedAt }] : [];
    });
    if (projected.length && liveResultRef.current.availability === "ready" && liveResultRef.current.payload) {
      setLiveResult((current) => projected.reduce(
        (next, item) => mergePhysicalTapRealtimeProjection(next, item.row, item.receivedAt) || next,
        current,
      ));
      if (realtime.status === "connected") setSyncState("live");
    }
    if (!fellBehind && projected.length === physicalFrames.length && liveResultRef.current.availability === "ready" && liveResultRef.current.payload) return;
    // Exceptional durable reconciliation only: an incomplete projection or an
    // unavailable initial dataset is coalesced and capped to one GET per 15s.
    queuePhysicalTapsRefresh();
  }, [queuePhysicalTapsRefresh, realtime.activeScopeKey, realtime.droppedThroughSequence, realtime.events, realtime.status, refreshable, tenantSlug]);

  useEffect(() => {
    const frame = realtime.warning;
    if (refreshable && frame?.scopeKey === realtime.activeScopeKey) setSyncState("stale");
  }, [realtime.activeScopeKey, realtime.warning, refreshable]);

  useEffect(() => {
    if (!refreshable) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") queuePhysicalTapsRefresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [queuePhysicalTapsRefresh, refreshable]);

  useEffect(() => () => {
    if (eventRefreshTimerRef.current !== null) window.clearTimeout(eventRefreshTimerRef.current);
    eventRefreshTimerRef.current = null;
    refreshAbortRef.current?.abort();
    refreshAbortRef.current = null;
    refreshInFlightRef.current = false;
    trailingRefreshRef.current = false;
  }, []);

  const payload = liveResult.payload;
  const rows = payload?.rows ?? EMPTY_ROWS;
  const batches = useMemo(() => Array.from(new Set(rows.map((row) => row.bid).filter(Boolean))).sort(), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => (
    (state === "all" || row.sealState === state)
      && (location === "all" || (location === "approximate" ? row.location.precision !== "none" : row.location.precision === "none"))
      && (batch === "all" || row.bid === batch)
  )), [batch, location, rows, state]);
  const points = useMemo(() => groupMapPoints(filteredRows), [filteredRows]);
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>();

  if (liveResult.availability !== "ready" || !payload) {
    return (
      <UnavailablePhysicalTaps
        result={liveResult}
        tenantDisplayName={tenantDisplayName}
        clerkEnabled={clerkEnabled}
        canRetry={Boolean(tenantSlug) && isRecoverablePhysicalTapsAvailability(liveResult.availability)}
        syncState={syncState}
        onRetry={() => void refreshPhysicalTaps()}
      />
    );
  }

  const latestClosed = latestPhysicalTapByState(rows, "closed");
  const latestOpened = latestPhysicalTapByState(rows, "opened");
  const located = rows.filter((row) => row.location.precision !== "none").length;
  const rangeLabel = ({ "24h": "últimas 24 horas", "7d": "últimos 7 días", "30d": "últimos 30 días", "90d": "últimos 90 días" } as Record<string, string>)[payload.scope.range || ""];
  const evidenceHref = payload.scope.bid && payload.scope.bid !== "all"
    ? `/events?bid=${encodeURIComponent(payload.scope.bid)}&source=real`
    : "/events?source=real";
  const summaryCards = [
    { label: "TAP reales", value: number(payload.summary.total), detail: `${number(payload.summary.distinctUnits)} unidades · ${number(payload.summary.total)} lecturas recientes`, icon: Radio, tone: "text-[var(--taps-accent)]" },
    { label: "Cerrado reportado", value: number(payload.summary.closed), detail: "Estado TT del tag", icon: CheckCircle2, tone: "text-[var(--taps-success)]" },
    { label: "Abierto reportado", value: number(payload.summary.opened), detail: "Señal operativa, no alarma", icon: CircleAlert, tone: "text-[var(--taps-warning)]" },
    { label: "Zona disponible", value: `${located}/${rows.length}`, detail: "Red o navegador con consentimiento", icon: MapPin, tone: "text-[var(--taps-accent)]" },
  ];

  return (
    <section data-testid="physical-taps-command-center" className={`${styles.workspace} space-y-5 rounded-[2rem] border border-[var(--taps-accent-border)] p-4 sm:p-6`}>
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-accent)]"><ScanLine className="h-3.5 w-3.5" /> {tenantDisplayName} · evidencia tenant</span>
            <span className="rounded-full border border-[var(--taps-success-border)] bg-[var(--taps-success-bg)] px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-success)]">source=real</span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[var(--taps-text)] sm:text-3xl">TAP reales recientes, listos para revisar</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--taps-muted)]">Cada tarjeta representa un evento persistido. No inferimos que cerrado y abierto formen un antes/después ni una ruta del mismo producto.</p>
          {rangeLabel ? <p className="mt-2 text-xs font-bold text-[var(--taps-muted)]">Período consultado: {rangeLabel}. Lecturas recientes del período, no un total histórico.</p> : null}
        </div>
        <div data-testid="physical-taps-last-evidence" className="rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] px-4 py-3 text-right">
          <p className="flex items-center justify-end gap-1.5 text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-muted)]"><Clock3 className="h-3.5 w-3.5" /> Última evidencia</p>
          <p className="mt-1 text-lg font-black text-[var(--taps-text)]">{payload.summary.latestAt ? absoluteDate(payload.summary.latestAt) : "Sin lecturas confirmadas"}</p>
          <p className="mt-2 text-xs text-[var(--taps-muted)]">Última confirmación: {absoluteDate(liveResult.checkedAt)}</p>
          <div className="mt-3 flex items-center justify-end gap-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${syncState === "stale" ? "text-[var(--taps-warning)]" : "text-[var(--taps-success)]"}`} role="status" aria-live="polite">
              <span className={`h-2 w-2 rounded-full ${syncState === "stale" ? "bg-[var(--taps-warning)]" : "bg-[var(--taps-success)]"}`} />
              {syncState === "stale" ? "Último snapshot confirmado" : syncState === "syncing" ? "Consultando evidencia…" : syncState === "live" && realtime.status === "connected" ? "Canal en vivo" : realtime.status === "connected" ? "Canal conectado · esperando evidencia" : "Consulta confirmada · canal pendiente"}
            </span>
            <button type="button" onClick={() => void refreshPhysicalTaps()} disabled={!refreshable || syncState === "syncing"} className="inline-grid min-h-11 min-w-11 place-items-center rounded-xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] text-[var(--taps-accent)] transition hover:bg-[var(--taps-accent-bg)] disabled:cursor-wait disabled:opacity-60" aria-label="Actualizar TAP físicos ahora">
              <RefreshCw className={`h-4 w-4 ${syncState === "syncing" ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-4">
            <div className="flex items-start justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.13em] text-[var(--taps-muted)]">{card.label}</p><card.icon className={`h-4 w-4 ${card.tone}`} /></div>
            <p className="mt-2 text-3xl font-black text-[var(--taps-text)]">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--taps-muted)]">{card.detail}</p>
          </div>
        ))}
      </div>

      {!compact && latestClosed && latestOpened ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <EventEvidenceCard row={latestClosed} />
          <EventEvidenceCard row={latestOpened} />
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(20rem,.75fr)]">
        <div className="overflow-hidden rounded-3xl border border-[var(--taps-border)] bg-[var(--taps-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--taps-border)] px-4 py-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-accent)]">Mapa de zonas reportadas</p>
              <p className="mt-1 text-xs text-[var(--taps-muted)]">Marcadores agrupados a 3 decimales. Sin rutas ni precisión domiciliaria.</p>
            </div>
            <span className="rounded-full border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-2.5 py-1 text-xs font-bold text-[var(--taps-accent)]">Ubicación aproximada</span>
          </div>
          {points.length ? (
            <PremiumVectorMap
              points={points}
              routes={[]}
              selectedPointId={selectedPointId}
              onPointSelect={(point) => setSelectedPointId(point.id)}
              title="Dónde se registraron los TAP"
              subtitle="Zonas aproximadas informadas por la red o el navegador con consentimiento, según cada evento. No forman un recorrido."
              caption="La ubicación ayuda a priorizar operaciones y campañas regionales. No identifica una dirección ni demuestra presencia exacta."
              density="balanced"
              chrome="compact"
              maxPoints={24}
              heightClassName="h-[23rem]"
              evidenceSteps={[
                { id: "source", label: "Fuente", value: `${payload.summary.total} TAP físicos`, detail: "Eventos source=real del tenant", tone: "tap" },
                { id: "privacy", label: "Privacidad", value: "Zona aproximada", detail: "Red o browser consentido; sin domicilio", tone: "loyalty" },
                { id: "journey", label: "Relación", value: "Unidades independientes", detail: "No se dibuja una ruta", tone: "origin" },
              ]}
            />
          ) : (
            <div className="grid min-h-[23rem] place-items-center p-6 text-center">
              <div className="max-w-md"><MapPin className="mx-auto h-8 w-8 text-[var(--taps-muted)]" /><p className="mt-3 font-bold text-[var(--taps-text)]">Los filtros no dejan zonas visibles</p><p className="mt-2 text-sm leading-6 text-[var(--taps-muted)]">Los eventos siguen en el inbox; su ubicación no se reemplaza por coordenadas inventadas.</p></div>
            </div>
          )}
        </div>

        <aside className="space-y-3 rounded-3xl border border-[var(--taps-violet-border)] bg-[var(--taps-violet-bg)] p-4">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--taps-violet-border)] bg-[var(--taps-violet-bg)] text-[var(--taps-violet)]"><Fingerprint className="h-4 w-4" /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-violet)]">CRM después del TAP</p><h3 className="mt-1 font-black text-[var(--taps-text)]">Convertir sin invadir</h3></div></div>
          <ol className="space-y-2 text-xs leading-5">
            <li className="rounded-2xl border border-[var(--taps-success-border)] bg-[var(--taps-success-bg)] p-3 text-[var(--taps-muted)]"><b className="text-[var(--taps-success)]">1. Evidencia recibida</b><br />Producto, lote, estado TT, hora y zona aproximada.</li>
            <li className="rounded-2xl border border-[var(--taps-warning-border)] bg-[var(--taps-warning-bg)] p-3 text-[var(--taps-muted)]"><b className="text-[var(--taps-warning)]">2. Cliente todavía anónimo</b><br />El TAP no crea owner, lead ni suscriptor automáticamente.</li>
            <li className="rounded-2xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] p-3 text-[var(--taps-muted)]"><b className="text-[var(--taps-accent)]">3. Acción con permiso</b><br />Claim, garantía, club, soporte o recompra sólo después de opt-in.</li>
          </ol>
          <div className="grid gap-2 pt-1">
            <Link href={evidenceHref} className="inline-flex min-h-11 items-center justify-between rounded-xl border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-3 py-2 text-xs font-black text-[var(--taps-accent)] hover:bg-[var(--taps-accent-bg)]"><span className="inline-flex items-center gap-2"><Radio className="h-3.5 w-3.5" /> Abrir evidencia técnica</span><ArrowRight className="h-3.5 w-3.5" /></Link>
            <Link href="/leads-tickets" className="inline-flex min-h-11 items-center justify-between rounded-xl border border-[var(--taps-border)] bg-[var(--taps-surface)] px-3 py-2 text-xs font-bold text-[var(--taps-text)] hover:border-[var(--taps-violet-border)]"><span className="inline-flex items-center gap-2"><Wine className="h-3.5 w-3.5" /> Abrir CRM y servicios</span><ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </aside>
      </div>

      {!compact ? (
        <div data-testid="physical-taps-inbox" className="rounded-3xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--taps-muted)]">Inbox operativo</p><p className="mt-1 text-xs text-[var(--taps-muted)]">Filtrá sin modificar la evidencia original.</p></div>
            <div className="flex flex-wrap gap-2">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--taps-muted)]">Estado<select aria-label="Filtrar TAP por estado" value={state} onChange={(event) => setState(event.target.value as StateFilter)} className="min-h-10 rounded-xl border border-[var(--taps-border)] bg-[var(--taps-surface-strong)] px-3 text-xs normal-case tracking-normal text-[var(--taps-text)]"><option value="all">Todos</option><option value="closed">Cerrado</option><option value="opened">Abierto</option><option value="other">Revisión</option></select></label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--taps-muted)]">Ubicación<select aria-label="Filtrar TAP por ubicación" value={location} onChange={(event) => setLocation(event.target.value as LocationFilter)} className="min-h-10 rounded-xl border border-[var(--taps-border)] bg-[var(--taps-surface-strong)] px-3 text-xs normal-case tracking-normal text-[var(--taps-text)]"><option value="all">Todas</option><option value="approximate">Zona aproximada</option><option value="none">Sin zona</option></select></label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-[0.1em] text-[var(--taps-muted)]">Lote<select aria-label="Filtrar TAP por lote" value={batch} onChange={(event) => setBatch(event.target.value)} className="min-h-10 rounded-xl border border-[var(--taps-border)] bg-[var(--taps-surface-strong)] px-3 text-xs normal-case tracking-normal text-[var(--taps-text)]"><option value="all">Todos</option>{batches.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {filteredRows.map((row) => (
              <div key={row.eventId} data-testid="physical-taps-event-row" className="grid gap-3 rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-3 text-xs text-[var(--taps-muted)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-black uppercase tracking-[0.1em] ${stateBadgeClass(row.sealState)}`}>{row.sealState === "closed" ? "Cerrado" : row.sealState === "opened" ? "Abierto" : "Revisión"}</span>
                <div className="min-w-0"><p className="truncate font-bold text-[var(--taps-text)]">{row.productName || "Producto"} · <span className="font-mono text-[var(--taps-muted)]">{row.uidMasked}</span></p><p className="mt-1 truncate text-[var(--taps-muted)]">Evento #{row.eventId} · {locationLabel(row)} · {absoluteDate(row.occurredAt.utc)}</p></div>
                <span className="justify-self-start rounded-full border border-[var(--taps-accent-border)] bg-[var(--taps-accent-bg)] px-2 py-1 text-xs font-bold text-[var(--taps-accent)] sm:justify-self-end">real</span>
              </div>
            ))}
            {!filteredRows.length ? <p className="rounded-2xl border border-[var(--taps-border)] bg-[var(--taps-surface)] p-5 text-center text-sm text-[var(--taps-muted)]">No hay eventos que coincidan con estos filtros.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
