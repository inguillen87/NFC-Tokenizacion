"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Inbox,
  MessageSquare,
  Package,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import type {
  CustomerSignal,
  CustomerSignalCollections,
  CustomerSignalKind,
} from "../lib/customer-signal-timeline";
import { customerSignalMatchesQuery } from "../lib/customer-signal-timeline";
import { SupportTicketDetails } from "./support-ticket-details";

type CustomerSignalTimelineProps = {
  signals: CustomerSignal[];
  collections: CustomerSignalCollections;
  query?: string;
  ticketEntry?: { label: string; available: (reference: unknown) => boolean; disabled: boolean; onOpen: (reference: string) => void };
};

const KIND_COPY: Record<CustomerSignalKind, { label: string; plural: string; icon: typeof Inbox }> = {
  lead: { label: "Prospecto", plural: "Prospectos", icon: Inbox },
  ticket: { label: "Ticket", plural: "Tickets", icon: MessageSquare },
  order: { label: "Pedido", plural: "Pedidos", icon: Package },
};

const SOURCE_COPY = {
  leads: { label: "Prospectos", kind: "lead" as const },
  tickets: { label: "Tickets", kind: "ticket" as const },
  orders: { label: "Pedidos", kind: "order" as const },
};

function formatMoment(value: string | null) {
  if (!value) return "Fecha no informada";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Fecha no informada";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function availabilityCopy(
  availability: CustomerSignalCollections[keyof CustomerSignalCollections]["availability"],
  source: CustomerSignalCollections[keyof CustomerSignalCollections]["source"],
  count: number,
) {
  if (availability === "access_denied") return { label: "Sin permiso", tone: "amber" };
  if (availability === "upstream_error") return { label: "Error de origen", tone: "rose" };
  if (availability === "invalid_payload") return { label: "Respuesta no válida", tone: "rose" };
  if (availability === "unreachable") return { label: "Fuente sin conexión", tone: "rose" };
  if (source === "demo") return { label: count ? `Demo · ${count}` : "Demo sin registros", tone: "violet" };
  return { label: count ? `Producción · ${count}` : "Vacío confirmado", tone: "emerald" };
}

export function CustomerSignalTimeline({ signals, collections, query = "", ticketEntry }: CustomerSignalTimelineProps) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [kindFilter, setKindFilter] = useState<"all" | CustomerSignalKind>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("es");

  const filteredSignals = useMemo(() => signals.filter((signal) => {
    if (kindFilter !== "all" && signal.kind !== kindFilter) return false;
    return customerSignalMatchesQuery(signal, normalizedQuery);
  }), [kindFilter, normalizedQuery, signals]);

  const counts = useMemo(() => signals.reduce<Record<CustomerSignalKind, number>>((result, signal) => {
    result[signal.kind] += 1;
    return result;
  }, { lead: 0, ticket: 0, order: 0 }), [signals]);

  const sourceEntries = Object.entries(SOURCE_COPY) as Array<[keyof CustomerSignalCollections, typeof SOURCE_COPY[keyof typeof SOURCE_COPY]]>;
  const unavailableCount = sourceEntries.filter(([key]) => collections[key].availability !== "ready").length;
  const demoCount = sourceEntries.filter(([key]) => collections[key].source === "demo").length;
  const readyCount = sourceEntries.length - unavailableCount;

  return (
    <section
      className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-[0_26px_80px_rgba(15,23,42,0.16)]"
      data-testid="customer-signal-timeline"
    >
      <header className="border-b border-white/10 bg-slate-900/70 px-5 py-6 sm:px-7">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-start">
          <div className="max-w-3xl">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Señales de cliente</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Qué pasó, con qué contexto y qué falta decidir.
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Un historial cronológico de prospectos, consultas y pedidos. Cada dato conserva su fuente;
              nexID no completa responsables ni acciones por inferencia.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <button
              type="button"
              onClick={() => startRefresh(() => router.refresh())}
              disabled={isRefreshing}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-slate-200 transition hover:border-cyan-300/30 hover:text-cyan-200 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Actualizando" : "Actualizar snapshot"}
            </button>
            <p className="text-[11px] text-slate-500">Snapshot confirmado al cargar. Esta vista no afirma tiempo real.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3" aria-label="Estado de fuentes">
          {sourceEntries.map(([key, copy]) => {
            const state = collections[key];
            const stateCopy = availabilityCopy(state.availability, state.source, counts[copy.kind]);
            return (
              <div key={key} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" data-source-state={state.availability}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-300">{copy.label}</span>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                    stateCopy.tone === "emerald"
                      ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                      : stateCopy.tone === "violet"
                        ? "border-violet-300/25 bg-violet-400/10 text-violet-200"
                        : stateCopy.tone === "amber"
                          ? "border-amber-300/25 bg-amber-400/10 text-amber-200"
                          : "border-rose-300/25 bg-rose-400/10 text-rose-200"
                  }`}>
                    {stateCopy.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {unavailableCount ? (
          <div className="mt-4 flex gap-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm text-amber-100" role="status">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Vista parcial: {unavailableCount} {unavailableCount === 1 ? "fuente no confirmó" : "fuentes no confirmaron"} su estado.
              Sus ausencias no se contabilizan como cero actividad.
            </p>
          </div>
        ) : null}

        {demoCount ? (
          <div className="mt-4 rounded-2xl border border-violet-300/25 bg-violet-400/10 p-4 text-sm text-violet-100" role="status">
            Los registros marcados como demo están aislados y no representan clientes ni actividad productiva.
          </div>
        ) : null}
      </header>

      <div className="px-5 py-6 sm:px-7">
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar señales por tipo">
          <button type="button" aria-pressed={kindFilter === "all"} onClick={() => setKindFilter("all")} className={kindFilter === "all" ? "rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-200" : "rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-xs font-bold text-slate-400"}>
            Todas · {signals.length}
          </button>
          {(Object.keys(KIND_COPY) as CustomerSignalKind[]).map((kind) => (
            <button key={kind} type="button" aria-pressed={kindFilter === kind} onClick={() => setKindFilter(kind)} className={kindFilter === kind ? "rounded-full border border-cyan-300/30 bg-cyan-400/10 px-4 py-2 text-xs font-black text-cyan-200" : "rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-xs font-bold text-slate-400"}>
              {KIND_COPY[kind].plural} · {counts[kind]}
            </button>
          ))}
        </div>

        {filteredSignals.length ? (
          <ol className="relative space-y-4 before:absolute before:bottom-5 before:left-[19px] before:top-5 before:w-px before:bg-gradient-to-b before:from-cyan-300/70 before:via-violet-300/35 before:to-transparent">
            {filteredSignals.map((signal) => {
              const kind = KIND_COPY[signal.kind];
              const Icon = kind.icon;
              return (
                <li key={`${signal.kind}-${signal.id}`} className="relative grid gap-4 pl-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
                  <div className="absolute left-0 top-4 z-10 grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/30 bg-slate-950 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.16)]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <article className="min-w-0 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">{kind.label}</span>
                      <span className={signal.source === "demo" ? "rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-violet-200" : "rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-emerald-200"}>
                        {signal.source === "demo" ? "Demo" : "Producción"}
                      </span>
                      {signal.status ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400">{signal.status}</span> : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">{signal.title}</h3>
                    <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-300">
                      <UserRound className="h-4 w-4 text-slate-500" />
                      {signal.subject}
                    </p>
                    {signal.ticket ? <SupportTicketDetails ticket={signal.ticket} /> : signal.summary ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">{signal.summary}</p> : null}
                    {signal.kind === "ticket" && signal.source === "production" && signal.ticket?.reference && ticketEntry?.available(signal.ticket.reference) ? (
                      <button type="button" data-testid="ticket-entry-signal" disabled={ticketEntry.disabled}
                        className="mt-4 min-h-11 rounded-xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 disabled:opacity-50"
                        onClick={() => { if (!ticketEntry.disabled && ticketEntry.available(signal.ticket!.reference)) ticketEntry.onOpen(signal.ticket!.reference!); }}>{ticketEntry.label}</button>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      <time dateTime={signal.occurredAt || undefined}>{formatMoment(signal.occurredAt)}</time>
                      {signal.company && signal.company !== signal.subject ? <span>Empresa: {signal.company}</span> : null}
                      {signal.channel ? <span>Canal informado: {signal.channel}</span> : null}
                    </div>
                  </article>

                  <aside className="rounded-2xl border border-white/10 bg-slate-950/70 p-4" aria-label={`Contexto operativo de ${signal.title}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Contexto para actuar</p>
                    <dl className="mt-3 space-y-3">
                      {signal.owner ? (
                        <div><dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Responsable informado</dt><dd className="mt-1 text-sm font-bold text-white">{signal.owner}</dd></div>
                      ) : null}
                      {signal.objective ? (
                        <div><dt className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{signal.objectiveLabel}</dt><dd className="mt-1 text-sm font-bold text-white">{signal.objective}</dd></div>
                      ) : null}
                      {signal.nextAction ? (
                        <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-3"><dt className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-cyan-200"><ArrowRight className="h-3.5 w-3.5" />Próxima acción informada</dt><dd className="mt-1 text-sm font-black text-white">{signal.nextAction}</dd></div>
                      ) : null}
                    </dl>
                    {!signal.owner && !signal.objective && !signal.nextAction ? (
                      <p className="mt-3 text-xs leading-5 text-slate-400">La fuente no informó responsable, objetivo operativo ni próxima acción.</p>
                    ) : null}
                    {!signal.nextAction ? (
                      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-3.5 w-3.5" />Próxima acción no informada por la fuente.</p>
                    ) : null}
                  </aside>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/20 bg-slate-900/70 px-5 py-12 text-center" role="status">
            <Inbox className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-base font-black text-white">
              {signals.length
                ? "No hay señales que coincidan con este filtro."
                : readyCount
                  ? "No hay señales registradas en las fuentes confirmadas."
                  : "No hay una fuente confirmada para construir la línea de tiempo."}
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-400">
              {signals.length
                ? "Cambiá el tipo de señal o la búsqueda para ampliar el resultado."
                : readyCount
                  ? "Este es un vacío confirmado para el alcance actual, no datos de ejemplo."
                  : "Reintentá las fuentes o solicitá el permiso correspondiente; nexID no reemplaza datos faltantes con registros sintéticos."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
