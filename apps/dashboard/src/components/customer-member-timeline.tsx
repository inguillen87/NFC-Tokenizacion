"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Gift,
  MapPin,
  Package,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  appendCustomerMemberTimelinePage,
  parseCustomerMemberTimelinePayload,
  type CustomerMember,
  type CustomerMemberDirectoryState,
  type CustomerMemberTimelineEntry,
  type CustomerMemberTimelineState,
} from "../lib/customer-member-timeline";

type CustomerMemberTimelineProps = {
  tenantScope: string;
  members: CustomerMember[];
  directory: CustomerMemberDirectoryState;
  selectedMemberId: string;
  timeline: CustomerMemberTimelineState;
};

type TimelinePageLoadState =
  | "idle"
  | "loading"
  | "access_denied"
  | "member_not_found"
  | "invalid_payload"
  | "unavailable";

function memberLabel(member: CustomerMember) {
  return member.displayName || member.email || member.phone || `ID ${member.id.slice(0, 8)}`;
}

function value(data: CustomerMemberTimelineEntry["data"], key: string) {
  const raw = data[key];
  return raw === null || raw === undefined || raw === "" ? null : String(raw);
}

function eventCopy(event: CustomerMemberTimelineEntry) {
  if (event.sourceKind === "consumer_tap") {
    const verdict = value(event.data, "verdict");
    const city = value(event.data, "city");
    const country = value(event.data, "country");
    return {
      label: "Lectura",
      title: "Etiqueta leída",
      description: verdict ? `Resultado informado: ${verdict}` : "La lectura quedó vinculada a este miembro.",
      context: [city, country].filter(Boolean).join(", ") || null,
      icon: Radio,
      accent: "cyan",
    };
  }
  if (event.sourceKind === "incident") {
    return {
      label: "Incidente",
      title: value(event.data, "title") || "Incidente registrado",
      description: value(event.data, "summary") || "La fuente registró una excepción vinculada a una lectura.",
      context: value(event.data, "severity"),
      icon: ShieldAlert,
      accent: "rose",
    };
  }
  if (event.sourceKind === "loyalty_points") {
    const delta = value(event.data, "delta");
    const balance = value(event.data, "balanceAfter");
    return {
      label: "Fidelización",
      title: delta ? `Movimiento de puntos: ${Number(delta) > 0 ? "+" : ""}${delta}` : "Movimiento de puntos",
      description: value(event.data, "reason") || "La fuente registró un movimiento en el programa de fidelización.",
      context: balance ? `Saldo informado: ${balance}` : null,
      icon: Gift,
      accent: "violet",
    };
  }
  const quantity = value(event.data, "quantity");
  return {
    label: "Pedido",
    title: "Solicitud de producto registrada",
    description: quantity ? `Cantidad informada: ${quantity}` : "El miembro inició una solicitud desde la experiencia conectada.",
    context: value(event.data, "status"),
    icon: Package,
    accent: "amber",
  };
}

function formatMoment(value: string) {
  return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function timelineStateCopy(state: CustomerMemberTimelineState["availability"]) {
  if (state === "access_denied") return "Esta sesión no tiene las capacidades necesarias para leer miembros y su historial.";
  if (state === "tenant_required") return "Seleccioná un tenant antes de consultar el historial de un miembro.";
  if (state === "member_not_found") return "El miembro seleccionado ya no está disponible dentro de este tenant.";
  if (state === "not_selected") return "Elegí un miembro para consultar su historial durable sin correlacionarlo por nombre o email.";
  if (state === "invalid_payload") return "La fuente respondió, pero el contrato del historial no pudo validarse.";
  if (state === "upstream_error") return "El servicio del historial rechazó o no pudo completar la consulta.";
  if (state === "unreachable") return "El servicio del historial no está disponible en este momento.";
  return null;
}

function pageLoadStateCopy(state: TimelinePageLoadState) {
  if (state === "loading") return "Cargando actividad anterior desde el historial durable.";
  if (state === "access_denied") return "La sesión ya no tiene acceso a la siguiente página del historial.";
  if (state === "member_not_found") return "El miembro ya no está disponible dentro de este tenant.";
  if (state === "invalid_payload") return "La siguiente página no superó la validación de tenant, miembro o cursor.";
  if (state === "unavailable") return "La fuente durable no está disponible. La actividad ya cargada se conserva.";
  return "";
}

export function CustomerMemberTimeline({ tenantScope, members, directory, selectedMemberId, timeline }: CustomerMemberTimelineProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startNavigation] = useTransition();
  const [visibleTimeline, setVisibleTimeline] = useState(timeline);
  const [pageLoadState, setPageLoadState] = useState<TimelinePageLoadState>("idle");
  const loadRequestRef = useRef<AbortController | null>(null);
  const activeScopeRef = useRef(`${tenantScope}:${selectedMemberId}`);
  const selectedMember = members.find((member) => member.id === selectedMemberId) || null;
  const stateMessage = timelineStateCopy(visibleTimeline.availability);

  useEffect(() => {
    loadRequestRef.current?.abort();
    loadRequestRef.current = null;
    activeScopeRef.current = `${tenantScope}:${selectedMemberId}`;
    setVisibleTimeline(timeline);
    setPageLoadState("idle");
    return () => loadRequestRef.current?.abort();
  }, [selectedMemberId, tenantScope, timeline]);

  const loadEarlierActivity = async () => {
    if (
      pageLoadState === "loading"
      || visibleTimeline.availability !== "ready"
      || !visibleTimeline.hasMore
      || !visibleTimeline.nextCursor
      || !selectedMemberId
      || !tenantScope
    ) return;

    const requestedCursor = visibleTimeline.nextCursor;
    const requestedScope = `${tenantScope}:${selectedMemberId}`;
    const controller = new AbortController();
    loadRequestRef.current?.abort();
    loadRequestRef.current = controller;
    setPageLoadState("loading");
    try {
      const params = new URLSearchParams({ tenant: tenantScope, cursor: requestedCursor });
      const response = await fetch(
        `/api/customer-member-timeline/${encodeURIComponent(selectedMemberId)}?${params.toString()}`,
        { cache: "no-store", signal: controller.signal },
      );
      if (!response.ok) {
        if (activeScopeRef.current !== requestedScope || controller.signal.aborted) return;
        setPageLoadState(
          response.status === 401 || response.status === 403
            ? "access_denied"
            : response.status === 404
              ? "member_not_found"
              : response.status === 400 || response.status === 422 || response.status === 502
                ? "invalid_payload"
                : "unavailable",
        );
        return;
      }
      const payload = await response.json().catch(() => null);
      const parsed = parseCustomerMemberTimelinePayload(payload, {
        tenant: tenantScope,
        consumerId: selectedMemberId,
      });
      if (!parsed || (parsed.hasMore && parsed.nextCursor === requestedCursor)) {
        if (activeScopeRef.current === requestedScope && !controller.signal.aborted) {
          setPageLoadState("invalid_payload");
        }
        return;
      }
      if (activeScopeRef.current !== requestedScope || controller.signal.aborted) return;
      setVisibleTimeline((current) => appendCustomerMemberTimelinePage(current, parsed));
      setPageLoadState("idle");
    } catch {
      if (controller.signal.aborted || activeScopeRef.current !== requestedScope) return;
      setPageLoadState("unavailable");
    } finally {
      if (loadRequestRef.current === controller) loadRequestRef.current = null;
    }
  };

  const selectMember = (consumerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (consumerId) params.set("consumer", consumerId);
    else params.delete("consumer");
    const nextUrl = `${pathname}${params.size ? `?${params.toString()}` : ""}`;
    startNavigation(() => router.push(nextUrl, { scroll: false }));
  };

  const directoryLabel = directory.availability === "access_denied"
    ? "Sin permiso"
    : directory.availability !== "ready"
      ? "Directorio no disponible"
      : directory.source === "demo"
        ? `Directorio demo · ${members.length}`
        : `Directorio confirmado · ${members.length}`;

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_26px_80px_rgba(15,23,42,0.14)]" data-testid="customer-member-timeline">
      <header className="border-b border-white/10 bg-slate-900/70 px-5 py-6 sm:px-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)] lg:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-300">Historial durable por miembro</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">Del tap a la relación con el cliente.</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Lecturas, incidentes, puntos y pedidos unidos únicamente por el identificador interno del miembro y, cuando existe, por el evento de tap.
            </p>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="customer-member-selector" className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Miembro autorizado</label>
              <span className="text-[10px] font-bold text-slate-500">{directoryLabel}</span>
            </div>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <select
                id="customer-member-selector"
                value={selectedMemberId}
                onChange={(event) => selectMember(event.target.value)}
                disabled={directory.availability !== "ready" || !members.length || isNavigating}
                className="min-h-12 w-full appearance-none rounded-xl border border-white/10 bg-slate-950/70 py-2 pl-10 pr-10 text-sm font-bold text-white outline-none transition focus:border-emerald-300/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">{members.length ? "Elegí un miembro" : "Sin miembros disponibles"}</option>
                {members.map((member) => <option key={member.id} value={member.id}>{memberLabel(member)}</option>)}
              </select>
              {isNavigating ? <RefreshCw className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-emerald-300" /> : null}
            </div>
          </div>
        </div>
      </header>

      <div className="px-5 py-6 sm:px-7">
        {visibleTimeline.partial ? (
          <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100" role="status">
            <div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>Historial parcial: una o más fuentes no pudieron responder. Los eventos visibles sí fueron confirmados, pero no representan la actividad completa.</p></div>
            {visibleTimeline.sourceErrors.length ? <p className="mt-2 pl-8 text-xs text-amber-200">Fuentes afectadas: {visibleTimeline.sourceErrors.map((error) => `${error.sourceKind} (${error.code})`).join(", ")}.</p> : null}
          </div>
        ) : null}

        {visibleTimeline.availability !== "ready" ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/70 px-5 py-10 text-center" role="status">
            <UserRound className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-300">{stateMessage}</p>
          </div>
        ) : visibleTimeline.items.length ? (
          <div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-white">{selectedMember ? memberLabel(selectedMember) : "Miembro seleccionado"}</p>
                <p className="mt-1 text-xs text-slate-500">{visibleTimeline.items.length} eventos durables cargados · paginación manual, no tiempo real</p>
              </div>
              {visibleTimeline.hasMore ? <span className="rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200">Hay actividad anterior</span> : <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-200">Historial cargado</span>}
            </div>
            <ol className="relative space-y-3 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-gradient-to-b before:from-emerald-300/70 before:via-cyan-300/35 before:to-transparent">
              {visibleTimeline.items.map((event) => {
                const copy = eventCopy(event);
                const Icon = copy.icon;
                return (
                  <li key={`${event.sourceKind}-${event.sourceId}`} className="relative pl-12">
                    <div className="absolute left-0 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/30 bg-slate-950 text-emerald-200"><Icon className="h-4 w-4" /></div>
                    <article className="grid gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300">{copy.label}</span>
                          {event.dataMode ? <span className={event.dataMode.toLowerCase() === "demo" ? "rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-black uppercase text-violet-200" : "rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase text-slate-400"}>Modo: {event.dataMode}</span> : <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase text-amber-200">Modo no informado</span>}
                        </div>
                        <h3 className="mt-2 text-base font-black text-white">{copy.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{copy.description}</p>
                        {copy.context ? <p className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-300"><MapPin className="h-3.5 w-3.5 text-slate-500" />{copy.context}</p> : null}
                      </div>
                      <div className="lg:text-right">
                        <time dateTime={event.occurredAt} className="text-xs font-bold text-slate-300">{formatMoment(event.occurredAt)}</time>
                        <p className="mt-1 text-[10px] text-slate-500">Persistencia durable · {event.provenance.relation}</p>
                        <p className="mt-1 text-[10px] text-slate-500">Vínculo: {event.correlation.basis.join(" + ")}</p>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
              <p id="customer-member-timeline-page-status" className="max-w-2xl text-xs leading-5 text-slate-400" aria-live="polite">
                {pageLoadStateCopy(pageLoadState) || (visibleTimeline.hasMore
                  ? "La próxima página usa el cursor confirmado por la fuente y conserva este tenant y miembro."
                  : "No quedan páginas anteriores informadas por la fuente.")}
              </p>
              {visibleTimeline.hasMore ? (
                <button
                  type="button"
                  onClick={loadEarlierActivity}
                  disabled={pageLoadState === "loading"}
                  aria-busy={pageLoadState === "loading"}
                  aria-describedby="customer-member-timeline-page-status"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-sm font-black text-cyan-100 transition hover:bg-cyan-400/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw className={pageLoadState === "loading" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {pageLoadState === "loading" ? "Cargando…" : pageLoadState === "idle" ? "Cargar actividad anterior" : "Reintentar carga"}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/70 px-5 py-10 text-center" role="status">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-300" />
            <p className="mt-3 text-base font-black text-white">Sin actividad durable registrada para este miembro.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">El vacío fue confirmado por el endpoint del historial; no se agregaron ejemplos ni correlaciones por contacto.</p>
          </div>
        )}
      </div>
    </section>
  );
}
